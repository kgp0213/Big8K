import { Plug, Wifi, Monitor, Terminal, Play, UploadCloud, Image, Video, FileCode, Settings, Factory, Cpu, RefreshCw, Link2, Activity } from "lucide-react";
import { useConnection } from "../App";

const cardClass = "panel flex flex-col gap-3";

const quickActions = [
  { icon: Play, label: "一键推送 Pattern", hint: "把当前 Pattern/脚本一并下发" },
  { icon: UploadCloud, label: "上传素材", hint: "图片 / 视频 / 字体" },
  { icon: Terminal, label: "执行调试脚本", hint: "触发上次保存的脚本" },
  { icon: Settings, label: "切换屏参 (timing.bin)", hint: "选择并下发 timing.bin" },
  { icon: Factory, label: "开机自启配置", hint: "设置哪段脚本在设备重启后运行" },
];

const patternPresets = [
  { name: "色块循环", desc: "RGB+灰阶 12 组", type: "pattern" },
  { name: "网点排查", desc: "8×8 单像素切换", type: "pattern" },
  { name: "文字标定", desc: "指定字体/字号", type: "pattern" },
];

const runtimeInfo = {
  resolution: "3036 × 1952",
  pclk: "150560 kHz",
  horizontal: "HFP 200 / HBP 36 / HS 2 / HSA 2",
  vertical: "VFP 62 / VBP 36 / VS 2 / VSA 2",
  lanes: "4 lane",
  format: "RGB888",
  dsc: "Enable · v1.1 · 1518 × 8 · 2 slices",
  source: "ADB连接后可从设备日志中读取，仅供参考",
};

const resourceStats = [
  { icon: Image, label: "图片素材", path: "/vismm/fbshow/bmp_online", count: "12 个" },
  { icon: Video, label: "视频素材", path: "/vismm/fbshow/movie_online", count: "5 个" },
  { icon: FileCode, label: "脚本目录", path: "/vismm/program", count: "9 个" },
];

export default function HomeTab() {
  const { connection, logs } = useConnection();

  const statusColor = connection.connected ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400";
  const statusText = connection.connected
    ? connection.type === "adb"
      ? `ADB (${connection.deviceId ?? "未识别设备"})`
      : `SSH (${connection.ip ?? "未知 IP"})`
    : "未连接";

  const adbActive = connection.type === "adb" && connection.connected;
  const sshActive = connection.type === "ssh" && connection.connected;
  const recentLogs = logs.slice(-5).reverse();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-7 space-y-4">
          <div className="panel">
            <div className="panel-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                Big8K 总览
              </div>
              <div className={`text-sm font-semibold ${statusColor}`}>{statusText}</div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">当前屏参</div>
                <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">3036 × 1952 @150.56MHz</div>
                <div className="text-xs text-gray-500">DSC v1.1 · 2 Slice</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">驱动脚本</div>
                <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">槽位 #1</div>
                <div className="text-xs text-gray-500">晨检脚本 (自动推 Pattern)</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">素材缓存</div>
                <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">17 项</div>
                <div className="text-xs text-gray-500">图片 12 · 视频 5</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className={`rounded-2xl border p-4 ${adbActive ? "border-green-200 bg-green-50/70 dark:border-green-900/60 dark:bg-green-900/10" : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/60"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                  <Plug className="w-4 h-4 text-primary-500" />ADB 链路
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${adbActive ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
                  {adbActive ? "在线" : "未连接"}
                </span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="text-gray-800 dark:text-gray-100 font-medium">{connection.type === "adb" && connection.deviceId ? connection.deviceId : "等待设备接入"}</div>
                <div className="text-xs text-gray-500">当前连接方式：USB ADB / ADB over TCP</div>
              </div>
            </div>

            <div className={`rounded-2xl border p-4 ${sshActive ? "border-blue-200 bg-blue-50/70 dark:border-blue-900/60 dark:bg-blue-900/10" : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/60"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                  <Wifi className="w-4 h-4 text-primary-500" />SSH 链路
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${sshActive ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
                  {sshActive ? "在线" : "未连接"}
                </span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="text-gray-800 dark:text-gray-100 font-medium">{sshActive ? connection.ip : "等待网络连接"}</div>
                <div className="text-xs text-gray-500">当前连接方式：root / 22（内置账号）</div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/60">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                  <Link2 className="w-4 h-4 text-primary-500" />当前会话
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${connection.connected ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"}`}>
                  {connection.connected ? "已连通" : "待连接"}
                </span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="text-gray-800 dark:text-gray-100 font-medium">{statusText}</div>
                <div className="text-xs text-gray-500">右侧连接面板的状态会实时同步到这里</div>
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <div className="panel-header flex items-center gap-2">
              <Plug className="w-4 h-4" />
              快捷操作
            </div>
            <div className="grid grid-cols-5 gap-3">
              {quickActions.map((action) => (
                <button key={action.label} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-left hover:border-primary-500 hover:bg-primary-50/50 dark:hover:bg-primary-900/20 transition-colors">
                  <action.icon className="w-4 h-4 text-primary-500 mb-2" />
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{action.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{action.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4" />
                Pattern / 资源联动
              </div>
              <button className="btn-secondary text-xs">打开素材目录</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                {patternPresets.map((item) => (
                  <div key={item.name} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{item.name}</div>
                    <div className="text-xs text-gray-500">{item.desc}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {resourceStats.map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{stat.label}</div>
                      <div className="text-xs text-gray-500">{stat.path}</div>
                    </div>
                    <div className="text-sm text-gray-500">{stat.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-5 space-y-4">
          <div className="panel">
            <div className="panel-header flex items-center gap-2">
              <Wifi className="w-4 h-4" />
              连接状态
            </div>
            <div className="grid grid-cols-1 gap-3 panel-body">
              <div className={`rounded-xl border px-3 py-3 ${adbActive ? "border-green-200 bg-green-50/70 dark:border-green-900/50 dark:bg-green-900/10" : "border-gray-200 dark:border-gray-700"}`}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-100"><Plug className="w-4 h-4 text-primary-500" />ADB 连接</span>
                  <span className={`text-xs ${adbActive ? "text-green-600 dark:text-green-400" : "text-gray-500"}`}>{adbActive ? "已连接" : "未连接"}</span>
                </div>
                <div className="mt-2 text-xs text-gray-500">{adbActive ? `设备：${connection.deviceId ?? "未识别设备"}` : "等待 USB 插入或 ADB over TCP 连接"}</div>
              </div>

              <div className={`rounded-xl border px-3 py-3 ${sshActive ? "border-blue-200 bg-blue-50/70 dark:border-blue-900/50 dark:bg-blue-900/10" : "border-gray-200 dark:border-gray-700"}`}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-100"><Terminal className="w-4 h-4 text-primary-500" />SSH 连接</span>
                  <span className={`text-xs ${sshActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500"}`}>{sshActive ? "已连接" : "未连接"}</span>
                </div>
                <div className="mt-2 text-xs text-gray-500">{sshActive ? `地址：${connection.ip ?? "未知 IP"}` : "等待板卡 IP 连接成功"}</div>
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-100"><Activity className="w-4 h-4 text-primary-500" />链路摘要</span>
                  <span className={`text-xs ${connection.connected ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>{connection.connected ? "在线" : "待连接"}</span>
                </div>
                <div className="mt-2 text-xs text-gray-500">{connection.connected ? `当前正在使用 ${statusText}` : "右侧连接面板建立连接后，这里会实时同步"}</div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header flex items-center gap-2"><Cpu className="w-4 h-4" />当前屏参摘要（ADB参考）</div>
            <div className="panel-body space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">分辨率</span><span>{runtimeInfo.resolution}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">PCLK</span><span>{runtimeInfo.pclk}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Horizontal</span><span>{runtimeInfo.horizontal}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Vertical</span><span>{runtimeInfo.vertical}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Lanes</span><span>{runtimeInfo.lanes}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Format</span><span>{runtimeInfo.format}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">DSC</span><span>{runtimeInfo.dsc}</span></div>
              <div className="pt-2 text-xs text-gray-500 dark:text-gray-400">{runtimeInfo.source}</div>
              <button className="w-full btn-secondary text-sm flex items-center justify-center gap-2 mt-2"><RefreshCw className="w-4 h-4" />ADB 读取当前屏参</button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                最近日志
              </div>
              <span className="text-xs text-gray-400">最近 5 条</span>
            </div>
            <div className="panel-body space-y-2 text-xs text-gray-500">
              {recentLogs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 px-3 py-3 text-gray-400">暂无日志，右侧连接和操作记录会同步显示到这里。</div>
              ) : (
                recentLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-gray-400">{log.time}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${log.level === "error" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300" : log.level === "warning" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" : log.level === "success" ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>{log.level}</span>
                    </div>
                    <div className="mt-1 text-gray-600 dark:text-gray-300">{log.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
