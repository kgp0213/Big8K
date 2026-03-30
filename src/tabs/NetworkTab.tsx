import { useMemo, useState } from "react";
import { Globe, Loader2, Wifi, Wrench, Upload, Play, TerminalSquare, Settings2, RefreshCw, CheckCircle2, Server, MonitorSmartphone } from "lucide-react";
import { useConnection } from "../App";
import { isTauri, tauriInvoke } from "../utils/tauri";
import type { ActionResult } from "../features/connection/types";

type InitAction = {
  label: string;
  description: string;
  icon: typeof Wrench;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
  command?: string;
};

const initActions: InitAction[] = [
  { label: "Install tools", description: "部署 Python 库和工具", icon: Upload, command: "deploy_install_tools" },
  { label: "Install App", description: "部署刷图应用", icon: Upload, command: "deploy_install_app" },
  { label: "Set default pattern L128", description: "设置默认灰阶画面", icon: Play, command: "deploy_set_default_pattern" },
  { label: "CMD line: multi-user", description: "命令行模式", icon: TerminalSquare, command: "deploy_set_multi_user" },
  { label: "graphical 图形界面", description: "图形界面模式（执行后自动重启）", icon: RefreshCw, command: "deploy_set_graphical" },
  { label: "开启SSH登录", description: "配置 SSH 并设置 root 密码", icon: Settings2, tone: "warning", command: "deploy_enable_ssh" },
];

const STATIC_IP_PRESETS = [
  { label: "192.168.1.100", ip: "192.168.1.100", gateway: "192.168.1.1", description: "对应旧版 SetStaticIPaddress1p100ToolStripMenuItem_Click" },
  { label: "192.168.137.100", ip: "192.168.137.100", gateway: "192.168.137.1", description: "对应旧版 SetStaticIPaddress137100ToolStripMenuItem_Click" },
];

const ACTION_GROUPS = [
  {
    title: "基础环境",
    description: "先把脚本和依赖装齐，后续画面同步、应用下发都依赖这里。",
    actions: ["deploy_install_tools", "deploy_install_app"],
  },
  {
    title: "默认显示与模式",
    description: "部署后把平台切到适合联调的默认显示内容与运行模式；需要远程排查时也可先开启 SSH。",
    actions: ["deploy_set_default_pattern", "deploy_set_multi_user", "deploy_enable_ssh"],
  },
  {
    title: "系统UI",
    description: "图形界面模式切换。执行后会自动重启。",
    actions: ["deploy_set_graphical"],
  },
] as const;

type LocalNetworkInfo = {
  summary: string;
  adapters: string[];
};

function getButtonToneClass(tone?: InitAction["tone"]) {
  switch (tone) {
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300";
    case "danger":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300";
    default:
      return "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-200";
  }
}

export default function NetworkTab() {
  const { connection, appendLog } = useConnection();
  const browserPreview = !isTauri();
  const [isSettingIp, setIsSettingIp] = useState(false);
  const [isLoadingLocalIp, setIsLoadingLocalIp] = useState(false);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [completedActions, setCompletedActions] = useState<string[]>([]);
  const [selectedPresetIp, setSelectedPresetIp] = useState<string | null>(null);
  const [lastActionMessage, setLastActionMessage] = useState<string>(browserPreview ? "浏览器预览模式下会使用演示结果，不会真正下发脚本。" : "");
  const [localNetworkInfo, setLocalNetworkInfo] = useState<LocalNetworkInfo | null>(
    browserPreview
      ? {
          summary: "当前电脑已接入 192.168.137.x 调试网段，可直接和 8K 平台联调。",
          adapters: ["以太网 1：192.168.137.10 / 255.255.255.0", "Wi-Fi：172.20.10.5 / 255.255.255.240"],
        }
      : null,
  );

  const adbReady = connection.type === "adb" && connection.connected;
  const connectionSummary = useMemo(() => {
    if (connection.type === "adb" && connection.connected) {
      return `当前通过 ADB 连接：${connection.deviceId ?? "未识别设备"}`;
    }
    if (connection.type === "ssh" && connection.connected) {
      return `当前通过 SSH 连接：${connection.ip ?? "未知地址"}`;
    }
    return "";
  }, [connection]);

  const actionMap = useMemo(() => new Map(initActions.map((item) => [item.command, item] as const)), []);

  const stepSummary = useMemo(() => {
    const total = initActions.length;
    const done = completedActions.length;
    return { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
  }, [completedActions]);

  const readyHint = adbReady ? "已满足 ADB 前置条件，可继续执行脚本。" : "此页多数脚本依赖 ADB，建议先在右侧连接面板接上 8K 平台。";

  const handleSetStaticIp = async (preset: typeof STATIC_IP_PRESETS[0]) => {
    setSelectedPresetIp(preset.ip);

    if (browserPreview) {
      const message = `浏览器预览：已模拟将 8K 平台静态 IP 设置为 ${preset.ip}，网关 ${preset.gateway}`;
      setLastActionMessage(message);
      appendLog(message, "success");
      return;
    }

    if (!adbReady) {
      appendLog("请先通过 ADB 连接 8K 平台，再设置静态 IP", "warning");
      return;
    }
    setIsSettingIp(true);
    appendLog(`开始设置 8K 平台静态 IP：${preset.ip}，网关：${preset.gateway}`, "info");
    try {
      const result = await tauriInvoke<ActionResult>("set_static_ip", { request: { ip: preset.ip, gateway: preset.gateway } });
      if (result.success) {
        appendLog(result.output || `静态 IP 已设置为 ${preset.ip}`, "success");
      } else {
        appendLog(result.error || result.output || "设置静态 IP 失败", "error");
      }
    } catch (error) {
      appendLog(`设置静态 IP 异常: ${String(error)}`, "error");
    } finally {
      setIsSettingIp(false);
    }
  };

  const handleViewLocalIp = async () => {
    if (browserPreview) {
      const previewInfo = {
        summary: "浏览器预览：当前演示主机已准备好本地网络信息。",
        adapters: ["以太网 1：192.168.137.10 / 255.255.255.0", "USB 网卡：192.168.1.23 / 255.255.255.0"],
      };
      setLocalNetworkInfo(previewInfo);
      setLastActionMessage("浏览器预览：已读取演示网络信息。");
      appendLog("浏览器预览：已读取演示网络信息。", "success");
      return;
    }

    setIsLoadingLocalIp(true);
    try {
      const result = await tauriInvoke<{ success: boolean; output: string; error?: string }>("get_local_network_info");
      if (result.success) {
        const adapters = (result.output || "")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        setLocalNetworkInfo({
          summary: adapters[0] || "已读取本机网络信息",
          adapters,
        });
        setLastActionMessage("已读取本机 IP 地址与网卡信息。");
        appendLog(result.output || "已读取本机 IP 地址", "success");
      } else {
        appendLog(result.error || result.output || "读取本机 IP 地址失败", "error");
      }
    } catch (error) {
      appendLog(`读取本机 IP 地址异常: ${String(error)}`, "error");
    } finally {
      setIsLoadingLocalIp(false);
    }
  };

  const handleInitAction = async (action: InitAction) => {
    if (!action.command) {
      appendLog(`「${action.label}」当前先完成 UI 占位，功能接线待补。`, "warning");
      return;
    }

    if (browserPreview) {
      setRunningAction(action.command);
      window.setTimeout(() => {
        setCompletedActions((prev) => (prev.includes(action.command!) ? prev : [...prev, action.command!]));
        setLastActionMessage(`浏览器预览：已模拟执行「${action.label}」`);
        appendLog(`浏览器预览：已模拟执行「${action.label}」`, "success");
        setRunningAction(null);
      }, 450);
      return;
    }

    if (!adbReady) {
      appendLog(`请先通过 ADB 连接 8K 平台，再执行「${action.label}」`, "warning");
      return;
    }
    setRunningAction(action.command);
    appendLog(`开始执行：${action.label}`, "info");
    try {
      const result = await tauriInvoke<ActionResult>(action.command);
      if (result.success) {
        setCompletedActions((prev) => (prev.includes(action.command!) ? prev : [...prev, action.command!]));
        setLastActionMessage(result.output || `${action.label} 执行完成`);
        appendLog(result.output || `${action.label} 执行完成`, "success");
      } else {
        appendLog(result.error || result.output || `${action.label} 执行失败`, "error");
      }
    } catch (error) {
      appendLog(`${action.label} 异常: ${String(error)}`, "error");
    } finally {
      setRunningAction(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="panel">
        <div className="panel-header flex items-center gap-2">
          <Wrench className="w-4 h-4" />
          配置部署
        </div>
        <div className="panel-body space-y-3">
          {connectionSummary ? (
            <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-800 dark:text-blue-200">
              {connectionSummary}
            </div>
          ) : null}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-900/30">
              <div className="text-xs text-gray-500 dark:text-gray-400">页面定位</div>
              <div className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-100">脚本部署 / 网络初始化 / 平台模式切换</div>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-900/30">
              <div className="text-xs text-gray-500 dark:text-gray-400">执行前提</div>
              <div className={`mt-1 text-sm font-semibold ${adbReady ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>{readyHint}</div>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-900/30">
              <div className="text-xs text-gray-500 dark:text-gray-400">部署进度</div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{stepSummary.done} / {stepSummary.total}</div>
                <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div className="h-full bg-primary-500 transition-all" style={{ width: `${stepSummary.percent}%` }} />
                </div>
                <div className="text-xs text-gray-500">{stepSummary.percent}%</div>
              </div>
            </div>
          </div>

          {lastActionMessage ? (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
              {lastActionMessage}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.2fr)_420px] gap-4 items-start">
        <div className="panel">
          <div className="panel-header flex items-center gap-2">
            <Upload className="w-4 h-4" />
            刷机后依次点击
          </div>
          <div className="panel-body space-y-4">
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
              刷机后的快速初始化流程，按顺序执行更稳妥。
            </div>
            <div className="space-y-4">
              {ACTION_GROUPS.map((group) => (
                <div key={group.title} className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{group.title}</div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{group.description}</div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {group.actions.map((command) => {
                      const item = actionMap.get(command);
                      if (!item) return null;

                      const Icon = item.icon;
                      const isRunning = runningAction === item.command;
                      const isDone = Boolean(item.command && completedActions.includes(item.command));
                      const itemIndex = initActions.findIndex((candidate) => candidate.command === item.command);

                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => void handleInitAction(item)}
                          disabled={(!adbReady && !browserPreview) || Boolean(runningAction)}
                          className={`rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${getButtonToneClass(item.tone)}`}
                          title={adbReady || browserPreview ? item.description : "请先连接 8K 平台"}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/5 text-xs font-semibold dark:bg-white/10">
                              {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isDone ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" /> : itemIndex + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-sm font-semibold">
                                  <Icon className="w-4 h-4" />
                                  {item.label}
                                </div>
                                <span className={`text-[11px] px-2 py-0.5 rounded-full ${isDone ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
                                  {isDone ? "已完成" : "待执行"}
                                </span>
                              </div>
                              <div className="mt-1 text-xs opacity-80">{item.description}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel sticky top-0">
            <div className="panel-header flex items-center gap-2">
              <Globe className="w-4 h-4" />
              网络 / IP 配置
            </div>
            <div className="panel-body space-y-4">
              <div className="rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-900/10 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
                常用部署场景保留为一键切换，点击后直接把 8K 平台设置成对应 IP。
              </div>
              <div className="space-y-3">
                {STATIC_IP_PRESETS.map((preset) => (
                  <button
                    key={preset.ip}
                    type="button"
                    onClick={() => handleSetStaticIp(preset)}
                    disabled={isSettingIp || !adbReady}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${selectedPresetIp === preset.ip ? "border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20" : "border-blue-200 dark:border-blue-800 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30"}`}
                    title={preset.description}
                  >
                    <div>
                      <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">设置 8K 平台 IP：{preset.ip}</div>
                      <div className="mt-1 text-xs text-blue-600/80 dark:text-blue-300/80">网关 {preset.gateway}</div>
                    </div>
                    <Globe className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-300" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header flex items-center gap-2">
              <Wifi className="w-4 h-4" />
              本机网络信息
            </div>
            <div className="panel-body space-y-4">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/20 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                用于查看当前电脑的网卡与 IP 地址，便于和 8K 平台联调。
              </div>
              <button
                type="button"
                onClick={() => void handleViewLocalIp()}
                disabled={isLoadingLocalIp}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 px-4 text-sm font-medium text-gray-700 dark:text-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoadingLocalIp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                查看本机 IP 地址
              </button>

              {localNetworkInfo && (
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 px-4 py-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                    <Server className="w-4 h-4 text-primary-500" />
                    本机网卡摘要
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">{localNetworkInfo.summary}</div>
                  <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                    {localNetworkInfo.adapters.map((item) => (
                      <div key={item} className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">{item}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header flex items-center gap-2">
              <MonitorSmartphone className="w-4 h-4" />
              使用建议
            </div>
            <div className="panel-body space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <div>· 这一页主要负责脚本部署、平台网络初始化，以及把 8K 平台切到合适的工作模式。</div>
              <div>· “点屏配置 / 命令调试”更偏向点亮屏幕与直接控制屏幕；“配置部署”更像环境准备与脚本下发。</div>
              <div>· 如果当前只是浏览器看 UI，可以直接点击按钮体验流程；切回 Tauri 后再接真实命令。</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}