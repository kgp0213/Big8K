import { useState, useEffect, useMemo, useRef } from "react";
import { Activity, MonitorSmartphone, Usb, Wifi } from "lucide-react";
import { useConnection } from "../App";
import { isTauri, tauriInvoke } from "../utils/tauri";
import { LAST_SUCCESSFUL_SSH_IP_KEY, SSH_ENDPOINTS } from "../features/connection/constants";
import { getAdbStatusLabel } from "../features/connection/helpers";
import AdbConnectionCard from "../features/connection/AdbConnectionCard";
import SshConnectionCard from "../features/connection/SshConnectionCard";
import LogPanel from "../features/connection/LogPanel";
import type { ActionResult, AdbDevice, AdbDevicesResult, ConnectionPanelProps, DeviceProbeResult } from "../features/connection/types";

export default function ConnectionPanel({ logs, clearLogs }: ConnectionPanelProps) {
  const { connection, setConnection, appendLog, debugMode, setDebugMode } = useConnection();
  const browserPreview = !isTauri();
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const handleClearLogs = () => {
    if (debugMode) {
      setConfirmClearOpen(true);
      return;
    }
    clearLogs();
  };

  const confirmClearLogs = () => {
    clearLogs();
    setConfirmClearOpen(false);
  };
  const [adbConnected, setAdbConnected] = useState(false);
  const [netConnected, setNetConnected] = useState(false);
  const [activeConnection, setActiveConnection] = useState<"adb" | "ssh">("adb");
  const [deviceId, setDeviceId] = useState("");
  const [deviceList, setDeviceList] = useState<AdbDevice[]>([]);
  const [ipAddress, setIpAddress] = useState(SSH_ENDPOINTS[0].host);
  const [adbTcpAddress, setAdbTcpAddress] = useState("192.168.137.100");
  const [sshPort] = useState(22);
  const [sshUser] = useState("root");
  const [sshPassword] = useState("Rk3588@2026!");
  const [checking, setChecking] = useState(false);
  const [lastSuccessfulSshIp, setLastSuccessfulSshIp] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const selectedDevice = useMemo(() => deviceList.find((d) => d.id === deviceId), [deviceList, deviceId]);
  const selectedDeviceStatusLabel = useMemo(() => getAdbStatusLabel(selectedDevice?.status || ""), [selectedDevice]);

  const enablePreviewAdb = (selectedId?: string) => {
    const previewDevices: AdbDevice[] = [
      { id: "BIG8K-DEMO-001", status: "device", model: "Big8K Demo Board" },
      { id: "BIG8K-DEMO-002", status: "offline", model: "Big8K Spare Board" },
    ];
    const activeId = selectedId || previewDevices[0].id;
    const activeDevice = previewDevices.find((device) => device.id === activeId) || previewDevices[0];

    setDeviceList(previewDevices);
    setDeviceId(activeDevice.id);
    setAdbConnected(activeDevice.status === "device");
    setNetConnected(false);
    setConnection({
      type: "adb",
      connected: activeDevice.status === "device",
      deviceId: activeDevice.id,
      deviceModel: activeDevice.model,
      screenResolution: "7680 × 4320",
      bitsPerPixel: "24",
      mipiMode: "video mode",
      mipiLanes: 8,
      fb0Available: true,
      vismpwrAvailable: true,
      python3Available: true,
    });
    appendLog(`浏览器预览：已载入 ADB 演示设备 ${activeDevice.id}`, "success");
  };

  const enablePreviewSsh = (host: string) => {
    setNetConnected(true);
    setAdbConnected(false);
    setConnection({
      type: "ssh",
      ip: host,
      connected: true,
      deviceModel: "Big8K Demo Board",
      screenResolution: "7680 × 4320",
      bitsPerPixel: "24",
      mipiMode: "video mode",
      mipiLanes: 8,
      fb0Available: true,
      vismpwrAvailable: true,
      python3Available: true,
    });
    appendLog(`浏览器预览：已模拟 SSH 连接 ${host}`, "success");
  };

  const showMessage = (type: "success" | "error", text: string, silent = false) => {
    if (!silent) {
      setMessage({ type, text });
      appendLog(text, type === "success" ? "success" : "error");
      window.setTimeout(() => setMessage(null), 3000);
    }
  };

  const syncSelectedDevice = async (selectedDeviceId: string) => {
    const result = await tauriInvoke<ActionResult>("adb_select_device", { deviceId: selectedDeviceId });
    if (!result.success) {
      throw new Error(result.error || "选择设备失败");
    }
  };

  const syncDeviceTime = async (silent = false) => {
    const now = new Date();
    const pad = (value: number) => value.toString().padStart(2, "0");
    const formatted = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    try {
      const result = await tauriInvoke<ActionResult>("adb_shell", { command: `date -s ${formatted}` });
      if (result.success) {
        if (!silent) {
          appendLog(`已同步电脑时间到开发板：${formatted}`, "success");
        }
      } else if (!silent) {
        appendLog(result.error || result.output || "开发板时间同步失败", "warning");
      }
    } catch (error) {
      if (!silent) {
        appendLog(`开发板时间同步异常: ${String(error)}`, "warning");
      }
    }
  };

  const applyProbeToConnection = (probe: DeviceProbeResult, base: { type: "adb" | "ssh"; connected: boolean; deviceId?: string; ip?: string }) => {
    const resolution = probe.virtual_size ? probe.virtual_size.replace(/[x,]/i, " × ") : undefined;
    const bitsPerPixel = probe.bits_per_pixel?.trim() === "32" ? undefined : probe.bits_per_pixel;
    const deviceModel = probe.model?.trim() ? probe.model : undefined;
    setConnection({
      ...base,
      screenResolution: resolution,
      bitsPerPixel,
      deviceModel,
      mipiMode: probe.mipi_mode,
      mipiLanes: probe.mipi_lanes,
      fb0Available: probe.fb0_available,
      vismpwrAvailable: probe.vismpwr_available,
      python3Available: probe.python3_available,
    });
  };

  const probeAdbDevice = async (baseDeviceId: string, silent = false) => {
    try {
      const probe = await tauriInvoke<DeviceProbeResult>("adb_probe_device");
      if (probe.success) {
        applyProbeToConnection(probe, { type: "adb", connected: true, deviceId: baseDeviceId });
        if (!silent) {
          appendLog(`已读取屏幕分辨率：${probe.virtual_size || "未知"}`, "success");
        }
      } else {
        setConnection({ type: "adb", connected: true, deviceId: baseDeviceId });
        if (!silent) {
          appendLog(probe.error || "读取屏幕分辨率失败", "warning");
        }
      }
    } catch (error) {
      setConnection({ type: "adb", connected: true, deviceId: baseDeviceId });
      if (!silent) {
        appendLog(`读取屏幕分辨率异常: ${String(error)}`, "warning");
      }
    }
  };

  const probeSshDevice = async (host: string, silent = false) => {
    try {
      const command = "MODEL=$(getprop ro.product.model 2>/dev/null); VSIZE=$(cat /sys/class/graphics/fb0/virtual_size 2>/dev/null); BPP=$(cat /sys/class/graphics/fb0/bits_per_pixel 2>/dev/null); MIPI_MODE=$(dmesg 2>/dev/null | grep -iE 'video mode|cmd mode|command mode' | tail -n 1 | sed -n 's/.*\(video mode\|cmd mode\|command mode\).*/\\1/p'); LANES=$(dmesg 2>/dev/null | grep -ioE 'lane[s]?[=: ]+[0-9]+' | tail -n 1 | grep -ioE '[0-9]+' ); [ -e /dev/fb0 ] && echo FB0=1 || echo FB0=0; command -v vismpwr >/dev/null 2>&1 && echo VISMPWR=1 || echo VISMPWR=0; command -v python3 >/dev/null 2>&1 && echo PYTHON3=1 || echo PYTHON3=0; echo MODEL=$MODEL; echo VSIZE=$VSIZE; echo BPP=$BPP; echo MIPI_MODE=$MIPI_MODE; echo LANES=$LANES";
      if (debugMode && !silent) {
        appendLog(`-> ssh ${sshUser}@${host}:${sshPort} \"${command}\"`, "debug");
      }
      const result = await tauriInvoke<{ success: boolean; output: string; error?: string }>("ssh_exec", {
        host,
        port: sshPort,
        username: sshUser,
        password: sshPassword,
        command,
      });

      if (!result.success) {
        setConnection({ type: "ssh", ip: host, connected: true });
        if (!silent) appendLog(result.error || result.output || "SSH 读取屏幕分辨率失败", "warning");
        return;
      }

      const lines = result.output.split(/\r?\n/);
      let model = "";
      let virtualSize = "";
      let bitsPerPixel = "";
      let fb0Available = false;
      let vismpwrAvailable = false;
      let python3Available = false;
      let mipiMode = "";
      let mipiLanes: number | undefined;

      for (const line of lines) {
        if (line.startsWith("MODEL=")) model = line.slice(6).trim();
        else if (line.startsWith("VSIZE=")) virtualSize = line.slice(6).trim();
        else if (line.startsWith("BPP=")) bitsPerPixel = line.slice(4).trim();
        else if (line.startsWith("MIPI_MODE=")) mipiMode = line.slice(10).trim();
        else if (line.startsWith("LANES=")) {
          const parsed = Number(line.slice(6).trim());
          if (Number.isFinite(parsed) && parsed > 0) mipiLanes = parsed;
        }
        else if (line.trim() === "FB0=1") fb0Available = true;
        else if (line.trim() === "VISMPWR=1") vismpwrAvailable = true;
        else if (line.trim() === "PYTHON3=1") python3Available = true;
      }

      setConnection({
        type: "ssh",
        ip: host,
        connected: true,
        screenResolution: virtualSize ? virtualSize.replace(/[x,]/i, " × ") : undefined,
        bitsPerPixel: bitsPerPixel === "32" ? undefined : bitsPerPixel,
        deviceModel: model || undefined,
        mipiMode: mipiMode || undefined,
        mipiLanes,
        fb0Available,
        vismpwrAvailable,
        python3Available,
      });

      if (!silent) {
        appendLog(`SSH 已读取屏幕分辨率：${virtualSize || "未知"}`, "success");
      }
    } catch (error) {
      setConnection({ type: "ssh", ip: host, connected: true });
      if (!silent) appendLog(`SSH 读取屏幕分辨率异常: ${String(error)}`, "warning");
    }
  };

  const applyAdbState = async (devices: AdbDevice[]) => {
    if (devices.length === 0) {
      setAdbConnected(false);
      setDeviceId("");
      setDeviceList([]);
      setConnection({ type: "disconnected", connected: false });
      return;
    }

    const selected = devices.find((d) => d.id === deviceId) || devices[0];
    await syncSelectedDevice(selected.id);
    setDeviceList(devices);
    setDeviceId(selected.id);
    setAdbConnected(selected.status === "device");
    if (selected.status === "device") {
      await probeAdbDevice(selected.id, true);
    } else {
      setConnection({ type: "adb", deviceId: selected.id, connected: false });
    }
  };

  const checkAdbConnection = async (silent = false) => {
    if (!silent) {
      setChecking(true);
      setMessage(null);
      appendLog("任务开始 -> ADB 设备检测", "info");
      if (debugMode) {
        appendLog("-> adb devices -l", "debug");
      }
    }

    try {
      const result = await tauriInvoke<AdbDevicesResult>("adb_devices");
      const devices = Array.isArray(result?.devices) ? result.devices : [];

      if (result.success) {
        await applyAdbState(devices);

        if (!silent) {
          if (devices.length > 0) {
            appendLog(`ADB 已刷新：发现 ${devices.length} 台设备`, "success");
          } else {
            showMessage("error", "未检测到 ADB 设备", true);
            appendLog("未检测到 ADB 设备", "warning");
          }
        }
      } else {
        setAdbConnected(false);
        setDeviceList([]);
        setConnection({ type: "disconnected", connected: false });
        if (!silent) {
          showMessage("error", result.error || "ADB 检测失败", true);
          appendLog(result.error || "ADB 检测失败", "error");
        }
      }
    } catch (err) {
      setAdbConnected(false);
      setDeviceList([]);
      setConnection({ type: "disconnected", connected: false });
      if (!silent) {
        showMessage("error", String(err), true);
        appendLog(String(err), "error");
      }
    } finally {
      if (!silent) setChecking(false);
    }
  };

  const handleSelectDevice = async (selectedId: string) => {
    setDeviceId(selectedId);
    if (!selectedId) return;

    if (browserPreview) {
      enablePreviewAdb(selectedId);
      return;
    }

    try {
      if (debugMode) {
        appendLog(`-> adb target ${selectedId}`, "debug");
      }
      await syncSelectedDevice(selectedId);
      setAdbConnected(true);
      await probeAdbDevice(selectedId);
      await syncDeviceTime();
      showMessage("success", `已切换设备: ${selectedId}`);
    } catch (err) {
      showMessage("error", String(err));
    }
  };

  const handleAdbTcpConnect = async () => {
    if (!adbTcpAddress.trim()) {
      showMessage("error", "请输入 ADB 设备地址");
      return;
    }

    if (browserPreview) {
      enablePreviewAdb(adbTcpAddress.includes(":") ? adbTcpAddress : `${adbTcpAddress}:5555`);
      setMessage({ type: "success", text: `浏览器预览：已模拟连接到 ${adbTcpAddress}` });
      window.setTimeout(() => setMessage(null), 3000);
      return;
    }

    setChecking(true);
    try {
      const target = adbTcpAddress.includes(":") ? adbTcpAddress : `${adbTcpAddress}:5555`;
      if (debugMode) {
        appendLog(`-> adb connect ${target}`, "debug");
      }
      const result = await tauriInvoke<ActionResult>("adb_connect", { target });
      if (result.success) {
        showMessage("success", result.output || `ADB 已连接到 ${target}`);
        await checkAdbConnection(true);
        await syncDeviceTime();
      } else {
        showMessage("error", result.error || result.output || "ADB connect 失败");
      }
    } catch (err) {
      showMessage("error", String(err));
    } finally {
      setChecking(false);
    }
  };

  const disconnectAdb = async () => {
    if (browserPreview) {
      setAdbConnected(false);
      setDeviceId("");
      setDeviceList([]);
      setConnection({ type: "disconnected", connected: false });
      showMessage("success", "浏览器预览：已断开 ADB 演示连接");
      return;
    }

    try {
      if (debugMode) {
        appendLog("-> adb disconnect", "info");
      }
      await tauriInvoke<ActionResult>("adb_disconnect", {});
    } catch {
      // ignore
    }
    setAdbConnected(false);
    setDeviceId("");
    setDeviceList([]);
    setConnection({ type: "disconnected", connected: false });
  };

  const checkSshConnection = async () => {
    if (browserPreview) {
      enablePreviewSsh(ipAddress);
      window.localStorage.setItem(LAST_SUCCESSFUL_SSH_IP_KEY, ipAddress);
      setLastSuccessfulSshIp(ipAddress);
      showMessage("success", `浏览器预览：SSH 演示连接成功 ${ipAddress}`);
      return;
    }

    setChecking(true);
    setMessage(null);
    appendLog(`任务开始 -> SSH 连接检查`, "info");
    if (debugMode) {
      appendLog(`-> ssh ${sshUser}@${ipAddress}:${sshPort}`, "info");
    }
    try {
      const result = await tauriInvoke<{ success: boolean; output: string; error?: string }>("ssh_connect", {
        host: ipAddress,
        port: sshPort,
        username: sshUser,
        password: sshPassword,
      });

      if (result.success) {
        setNetConnected(true);
        setConnection({ type: "ssh", ip: ipAddress, connected: true });
        await probeSshDevice(ipAddress);
        window.localStorage.setItem(LAST_SUCCESSFUL_SSH_IP_KEY, ipAddress);
        setLastSuccessfulSshIp(ipAddress);
        appendLog(`已记住最近成功 SSH 地址: ${ipAddress}`, "info");
        showMessage("success", `SSH 连接成功: ${ipAddress}`);
      } else {
        setNetConnected(false);
        showMessage("error", result.error || "SSH 连接失败");
      }
    } catch (err) {
      setNetConnected(false);
      showMessage("error", String(err));
    } finally {
      setChecking(false);
    }
  };

  const disconnectSsh = () => {
    setNetConnected(false);
    setConnection({ type: "disconnected", connected: false });
    showMessage("success", browserPreview ? "浏览器预览：已断开 SSH 演示连接" : "已断开 SSH 连接");
  };

  useEffect(() => {
    const lastSuccessfulIp = window.localStorage.getItem(LAST_SUCCESSFUL_SSH_IP_KEY);
    if (lastSuccessfulIp) {
      setIpAddress(lastSuccessfulIp);
      setLastSuccessfulSshIp(lastSuccessfulIp);
    }
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="p-4 space-y-4 relative">
      {message && (
        <div
          className={`p-2 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
              : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      {confirmClearOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/35" onClick={() => setConfirmClearOpen(false)} />
          <div className="relative w-[280px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl p-4 space-y-4">
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">确认清空日志</div>
            <div className="text-sm text-gray-600 dark:text-gray-300">调试模式已开启，确定要清空执行日志吗？</div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmClearOpen(false)}
                className="text-xs px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              >
                取消
              </button>
              <button
                autoFocus
                onClick={confirmClearLogs}
                className="text-xs px-3 py-1.5 rounded bg-red-600 text-white"
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header flex items-center gap-2">
          <Activity className="w-4 h-4" />
          连接模式
        </div>
        <div className="panel-body">
          {browserPreview && (
            <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-300">
              当前为浏览器预览：下面的连接按钮会注入演示数据，方便先看 UI 和页面联动。
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={async () => {
                setActiveConnection("adb");
                await checkAdbConnection(true);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeConnection === "adb"
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}
            >
              <Usb className="w-4 h-4" />
              ADB
            </button>
            <button
              onClick={() => setActiveConnection("ssh")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeConnection === "ssh"
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}
            >
              <Wifi className="w-4 h-4" />
              SSH
            </button>
          </div>
        </div>
      </div>

      {activeConnection === "adb" && (
        <AdbConnectionCard
          checking={checking}
          adbConnected={adbConnected}
          deviceId={deviceId}
          deviceList={deviceList}
          adbTcpAddress={adbTcpAddress}
          selectedDevice={selectedDevice}
          selectedDeviceStatusLabel={selectedDeviceStatusLabel}
          connection={connection}
          onSelectDevice={handleSelectDevice}
          onAdbTcpAddressChange={setAdbTcpAddress}
          onAdbTcpConnect={handleAdbTcpConnect}
          onRefreshOrConnect={() => checkAdbConnection(false)}
          onRefresh={() => checkAdbConnection(false)}
          onDisconnect={disconnectAdb}
        />
      )}

      {activeConnection === "ssh" && (
        <SshConnectionCard
          checking={checking}
          netConnected={netConnected}
          ipAddress={ipAddress}
          lastSuccessfulSshIp={lastSuccessfulSshIp}
          sshEndpoints={SSH_ENDPOINTS}
          onIpAddressChange={setIpAddress}
          onConnectOrDisconnect={netConnected ? disconnectSsh : checkSshConnection}
          onRefresh={checkSshConnection}
        />
      )}

      <LogPanel
        logs={logs}
        debugMode={debugMode}
        onDebugModeChange={setDebugMode}
        onClearLogs={handleClearLogs}
        logContainerRef={logContainerRef}
      />

      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-3 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
        <MonitorSmartphone className="w-4 h-4 mt-0.5" />
        <div>{browserPreview ? "浏览器预览会使用演示连接数据；切回 Tauri 环境后会恢复真实 ADB / SSH / 设备探测逻辑。" : "当前版本保留手动 ADB 刷新、SSH 网址选择和基础日志，界面尽量简化，先满足点屏调试使用。"}</div>
      </div>
    </div>
  );
}

