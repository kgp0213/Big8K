import { useEffect, useState } from "react";
import { Monitor, Terminal, Activity, Loader2, Cpu, Thermometer, ScanSearch } from "lucide-react";
import { useConnection } from "../App";
import { isTauri, tauriInvoke } from "../utils/tauri";

type ScreenProbeInfo = {
  success: boolean;
  model?: string;
  panel_name?: string;
  virtual_size?: string;
  bits_per_pixel?: string;
  mipi_mode?: string;
  mipi_lanes?: number;
  fb0_available: boolean;
  vismpwr_available: boolean;
  python3_available: boolean;
  cpu_usage?: string;
  memory_usage?: string;
  temperature_c?: string;
  error?: string;
};

const previewProbe: ScreenProbeInfo = {
  success: true,
  model: "RK3588 Dev Preview",
  panel_name: "M559-CMD4201280x",
  virtual_size: "900,960",
  bits_per_pixel: "32",
  mipi_mode: "VIDEO",
  mipi_lanes: 4,
  fb0_available: true,
  vismpwr_available: true,
  python3_available: true,
  cpu_usage: "18.0%",
  memory_usage: "42.0% (1680MB / 4096MB)",
  temperature_c: "51.2°C",
};

export default function HomeTab() {
  const { connection, logs } = useConnection();
  const browserPreview = !isTauri();
  const [isLoadingProbe, setIsLoadingProbe] = useState(false);
  const [probeInfo, setProbeInfo] = useState<ScreenProbeInfo | null>(browserPreview ? previewProbe : null);

  const recentLogs = logs.slice(-5).reverse();
  const statusColor = connection.connected ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400";
  const statusText = connection.connected
    ? connection.type === "adb"
      ? `ADB (${connection.deviceId ?? "未识别设备"})`
      : `SSH (${connection.ip ?? "未知 IP"})`
    : "未连接";
  const adbActive = connection.type === "adb" && connection.connected;

  useEffect(() => {
    if (browserPreview) return;
    if (!adbActive) {
      setProbeInfo(null);
      return;
    }

    let cancelled = false;
    const loadProbe = async () => {
      setIsLoadingProbe(true);
      try {
        const result = await tauriInvoke<ScreenProbeInfo>("adb_probe_device");
        if (!cancelled) setProbeInfo(result);
      } catch (error) {
        if (!cancelled) {
          setProbeInfo({
            success: false,
            fb0_available: false,
            vismpwr_available: false,
            python3_available: false,
            error: String(error),
          });
        }
      } finally {
        if (!cancelled) setIsLoadingProbe(false);
      }
    };

    void loadProbe();
    return () => {
      cancelled = true;
    };
  }, [adbActive, browserPreview]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 space-y-4">
          <div className="panel">
            <div className="panel-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                总览
              </div>
              <div className={`text-sm font-semibold ${statusColor}`}>{statusText}</div>
            </div>
            <div className="panel-body space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/60">
                  <div className="text-xs text-gray-500 dark:text-gray-400">当前会话</div>
                  <div className="mt-2 text-sm font-semibold text-gray-800 dark:text-gray-100">{statusText}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/60">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"><Cpu className="w-4 h-4" />CPU</div>
                  <div className="mt-2 text-sm font-semibold text-gray-800 dark:text-gray-100">{probeInfo?.cpu_usage || "未读取"}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/60">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"><Thermometer className="w-4 h-4" />温度</div>
                  <div className="mt-2 text-sm font-semibold text-gray-800 dark:text-gray-100">{probeInfo?.temperature_c || "未读取"}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/60 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                    <ScanSearch className="w-4 h-4 text-primary-500" />
                    屏幕信息
                  </div>
                  {isLoadingProbe ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : null}
                </div>
                {probeInfo ? (
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30 px-3 py-3">
                      <div className="text-[11px] text-gray-400">型号</div>
                      <div className="mt-1 font-medium text-gray-800 dark:text-gray-100">{probeInfo.panel_name || probeInfo.model || "未识别"}</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30 px-3 py-3">
                      <div className="text-[11px] text-gray-400">分辨率</div>
                      <div className="mt-1 font-medium text-gray-800 dark:text-gray-100">{probeInfo.virtual_size || "未读取"}</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30 px-3 py-3">
                      <div className="text-[11px] text-gray-400">位深</div>
                      <div className="mt-1 font-medium text-gray-800 dark:text-gray-100">{probeInfo.bits_per_pixel || "未读取"}</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30 px-3 py-3">
                      <div className="text-[11px] text-gray-400">MIPI</div>
                      <div className="mt-1 font-medium text-gray-800 dark:text-gray-100">{probeInfo.mipi_mode || "未识别"}{probeInfo.mipi_lanes ? ` / ${probeInfo.mipi_lanes} lanes` : ""}</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30 px-3 py-3">
                      <div className="text-[11px] text-gray-400">内存</div>
                      <div className="mt-1 font-medium text-gray-800 dark:text-gray-100">{probeInfo.memory_usage || "未读取"}</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30 px-3 py-3">
                      <div className="text-[11px] text-gray-400">fb0</div>
                      <div className="mt-1 font-medium text-gray-800 dark:text-gray-100">{probeInfo.fb0_available ? "可用" : "不可用"}</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30 px-3 py-3">
                      <div className="text-[11px] text-gray-400">vismpwr</div>
                      <div className="mt-1 font-medium text-gray-800 dark:text-gray-100">{probeInfo.vismpwr_available ? "可用" : "不可用"}</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30 px-3 py-3">
                      <div className="text-[11px] text-gray-400">Python3</div>
                      <div className="mt-1 font-medium text-gray-800 dark:text-gray-100">{probeInfo.python3_available ? "就绪" : "缺失"}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400">ADB 连接后自动读取 3588 屏幕、CPU、内存和温度信息。</div>
                )}
                {probeInfo?.error ? <div className="text-xs text-amber-600 dark:text-amber-300">{probeInfo.error}</div> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-4 space-y-4">
          <div className="panel">
            <div className="panel-header flex items-center gap-2">
              <Activity className="w-4 h-4" />
              连接摘要
            </div>
            <div className="panel-body space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-3">
                <div className="text-xs text-gray-400">ADB</div>
                <div className="mt-1 font-medium text-gray-800 dark:text-gray-100">{adbActive ? connection.deviceId ?? "未识别设备" : "未连接"}</div>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-3">
                <div className="text-xs text-gray-400">资源占用</div>
                <div className="mt-1 font-medium text-gray-800 dark:text-gray-100">{probeInfo?.cpu_usage || "未读取"} / {probeInfo?.memory_usage || "未读取"}</div>
              </div>
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
