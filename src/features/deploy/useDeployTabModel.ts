import { useMemo, useState } from "react";
import { useConnection } from "../../App";
import { isTauri, tauriInvoke } from "../../utils/tauri";
import type { ActionResult } from "../connection/types";
import { deployActions, type DeployAction, type LocalNetworkInfo, type StaticIpPreset } from "./types";

export function useDeployTabModel() {
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
          success: true,
          cards: [
            { name: "以太网 1", ipv4: "192.168.137.10" },
            { name: "Wi‑Fi", ipv4: "172.20.10.5" },
          ],
        }
      : null,
  );

  const adbReady = connection.type === "adb" && connection.connected;
  const actionMap = useMemo(() => new Map(deployActions.map((item) => [item.command, item] as const)), []);

  const stepSummary = useMemo(() => {
    const total = deployActions.length;
    const done = completedActions.length;
    return { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
  }, [completedActions]);

  const readyHint = adbReady ? "已满足 ADB 前置条件，可继续执行脚本。" : "此页多数脚本依赖 ADB，建议先在右侧连接面板接上 8K 平台。";

  const networkCards = useMemo(() => localNetworkInfo?.cards ?? [], [localNetworkInfo]);

  const handleViewLocalIp = async () => {
    if (browserPreview) {
      const previewInfo: LocalNetworkInfo = {
        success: true,
        cards: [
          { name: "以太网 1", ipv4: "192.168.137.10" },
          { name: "USB 网卡", ipv4: "192.168.1.23" },
        ],
      };
      setLocalNetworkInfo(previewInfo);
      setLastActionMessage("浏览器预览：已读取演示网络信息。");
      appendLog("浏览器预览：已读取演示网络信息。", "success");
      return;
    }

    setIsLoadingLocalIp(true);
    try {
      const result = await tauriInvoke<LocalNetworkInfo>("get_local_network_info");
      if (result.success) {
        setLocalNetworkInfo(result);
        const message = result.cards.length > 0
          ? `已读取本机 IP 地址，筛选出 ${result.cards.length} 个有线/无线网卡。`
          : "已执行本机网络读取，但未发现符合条件的有线/无线 IPv4 网卡。";
        setLastActionMessage(message);
        appendLog(message, result.cards.length > 0 ? "success" : "warning");
      } else {
        setLocalNetworkInfo(result);
        setLastActionMessage(result.error || "读取本机 IP 地址失败");
        appendLog(result.error || "读取本机 IP 地址失败", "error");
      }
    } catch (error) {
      const message = `读取本机 IP 地址异常: ${String(error)}`;
      setLastActionMessage(message);
      appendLog(message, "error");
    } finally {
      setIsLoadingLocalIp(false);
    }
  };

  const handleSetStaticIp = async (preset: StaticIpPreset) => {
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
        const message = result.output || `静态 IP 已设置为 ${preset.ip}`;
        setLastActionMessage(message);
        appendLog(message, "success");
      } else {
        const message = result.error || result.output || "设置静态 IP 失败";
        setLastActionMessage(message);
        appendLog(message, "error");
      }
    } catch (error) {
      const message = `设置静态 IP 异常: ${String(error)}`;
      setLastActionMessage(message);
      appendLog(message, "error");
    } finally {
      setIsSettingIp(false);
    }
  };

  const handleDeployAction = async (action: DeployAction) => {
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
        const message = result.output || `${action.label} 执行完成`;
        setLastActionMessage(message);
        appendLog(message, "success");
      } else {
        const message = result.error || result.output || `${action.label} 执行失败`;
        setLastActionMessage(message);
        appendLog(message, "error");
      }
    } catch (error) {
      const message = `${action.label} 异常: ${String(error)}`;
      setLastActionMessage(message);
      appendLog(message, "error");
    } finally {
      setRunningAction(null);
    }
  };

  return {
    browserPreview,
    adbReady,
    actionMap,
    stepSummary,
    readyHint,
    networkCards,
    localNetworkInfo,
    lastActionMessage,
    runningAction,
    completedActions,
    isLoadingLocalIp,
    isSettingIp,
    selectedPresetIp,
    handleViewLocalIp,
    handleSetStaticIp,
    handleDeployAction,
  };
}
