import { useState, useEffect, useMemo, useRef } from "react";
import { Usb, Wifi, Activity, Power, RefreshCw, CheckCircle, XCircle, Link, Cpu, MonitorSmartphone } from "lucide-react";
import { useConnection } from "../App";
import { tauriInvoke } from "../utils/tauri";

const DEFAULT_MIPI_LANES = 4;
const DEFAULT_SCREEN_RESOLUTION = "未读取";
const DEFAULT_MIPI_MODE = "Video";

interface AdbDevice {
  id: string;
  status: string;
  product?: string;
  model?: string;
  transport_id?: string;
}

interface AdbDevicesResult {
  success: boolean;
  devices: AdbDevice[];
  error?: string;
}

interface ActionResult {
  success: boolean;
  output: string;
  error?: string;
}

interface DeviceProbeResult {
  success: boolean;
  model?: string;
  virtual_size?: string;
  bits_per_pixel?: string;
  fb0_available: boolean;
  vismpwr_available: boolean;
  python3_available: boolean;
  error?: string;
}

interface ConnectionPanelProps {
  logs: { id: string; time: string; level: "info" | "success" | "warning" | "error" | "debug"; message: string }[];
  clearLogs: () => void;
}

const SSH_ENDPOINTS = [
  { label: "192.168.137.100", host: "192.168.137.100" },
  { label: "192.168.1.100", host: "192.168.1.100" },
];

const LAST_SUCCESSFUL_SSH_IP_KEY = "big8k.lastSuccessfulSshIp";

const getAdbStatusLabel = (status: string) => {
  switch (status) {
    case "device":
      return "已连接";
    case "offline":
      return "设备已连接但离线";
    case "unauthorized":
      return "设备未授权，请在设备上确认调试授权";
    case "recovery":
      return "设备处于 Recovery 模式";
    case "sideload":
      return "设备处于 Sideload 模式";
    case "bootloader":
      return "设备处于 Bootloader 模式";
    default:
      return status || "未知状态";
  }
};

const getAdbStatusTone = (status: string) => {
  switch (status) {
    case "device":
      return "success";
    case "offline":
    case "unauthorized":
    case "recovery":
    case "sideload":
    case "bootloader":
      return "warning";
    default:
      return "error";
  }
};

const getAdbStatusBadgeClass = (status: string) => {
  const tone = getAdbStatusTone(status);
  if (tone === "success") {
    return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
  }
  if (tone === "warning") {
    return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300";
  }
  return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
};

export default function ConnectionPanel({ logs, clearLogs }: ConnectionPanelProps) {
  const { connection, setConnection, appendLog, debugMode, setDebugMode } = useConnection();
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

  const showMessage = (type: "success" | "error", text: string, silent = false) => {
    setMessage({ type, text });
    if (!silent) {
      appendLog(text, type === "success" ? "success" : "error");
    }
    window.setTimeout(() => setMessage(null), 3000);
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
    setConnection({
      ...base,
      screenResolution: resolution,
      bitsPerPixel: probe.bits_per_pixel,
      deviceModel: probe.model,
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
      const command = "MODEL=$(getprop ro.product.model 2>/dev/null); VSIZE=$(cat /sys/class/graphics/fb0/virtual_size 2>/dev/null); BPP=$(cat /sys/class/graphics/fb0/bits_per_pixel 2>/dev/null); [ -e /dev/fb0 ] && echo FB0=1 || echo FB0=0; command -v vismpwr >/dev/null 2>&1 && echo VISMPWR=1 || echo VISMPWR=0; command -v python3 >/dev/null 2>&1 && echo PYTHON3=1 || echo PYTHON3=0; echo MODEL=$MODEL; echo VSIZE=$VSIZE; echo BPP=$BPP";
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

      for (const line of lines) {
        if (line.startsWith("MODEL=")) model = line.slice(6).trim();
        else if (line.startsWith("VSIZE=")) virtualSize = line.slice(6).trim();
        else if (line.startsWith("BPP=")) bitsPerPixel = line.slice(4).trim();
        else if (line.trim() === "FB0=1") fb0Available = true;
        else if (line.trim() === "VISMPWR=1") vismpwrAvailable = true;
        else if (line.trim() === "PYTHON3=1") python3Available = true;
      }

      setConnection({
        type: "ssh",
        ip: host,
        connected: true,
        screenResolution: virtualSize ? virtualSize.replace(/[x,]/i, " × ") : undefined,
        bitsPerPixel,
        deviceModel: model || undefined,
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
            const selected = devices.find((d) => d.id === deviceId) || devices[0];
            showMessage("success", `ADB 已刷新：${selected.id} · ${getAdbStatusLabel(selected.status)}`, true);
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
    showMessage("success", "已断开 ADB 连接");
  };

  const checkSshConnection = async () => {
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
    showMessage("success", "已断开 SSH 连接");
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
        <div className="panel">
          <div className="panel-header flex items-center gap-2">
            <Usb className="w-4 h-4" />
            ADB设备管理
            <span
              className={`ml-auto px-2 py-0.5 text-xs rounded-full flex items-center gap-1 ${
                selectedDevice ? getAdbStatusBadgeClass(selectedDevice.status) : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
              }`}
            >
              {selectedDevice ? (
                getAdbStatusTone(selectedDevice.status) === "success" ? <CheckCircle className="w-3 h-3" /> : <Activity className="w-3 h-3" />
              ) : (
                <XCircle className="w-3 h-3" />
              )}
              {selectedDevice ? selectedDeviceStatusLabel : "未连接"}
            </span>
          </div>
          <div className="panel-body space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">已发现设备</label>
              <select value={deviceId} onChange={(e) => handleSelectDevice(e.target.value)} className="input text-sm" disabled={deviceList.length === 0}>
                {deviceList.length === 0 ? (
                  <option value="">未检测到设备</option>
                ) : (
                  deviceList.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.id} · {getAdbStatusLabel(device.status)}
                    </option>
                  ))
                )}
              </select>
            </div>

            {selectedDevice && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-xs space-y-2">
                <div className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-200">
                  <Cpu className="w-3.5 h-3.5" />
                  设备状态
                </div>
                <div>序列号：{selectedDevice.id}</div>
                <div>ADB 状态：{selectedDeviceStatusLabel}</div>
                <div>设备型号：{connection.deviceModel || "未读取"}</div>
                <div>屏幕分辨率：{connection.screenResolution || DEFAULT_SCREEN_RESOLUTION}</div>
                <div>位深：{connection.bitsPerPixel || "未读取"}</div>
                <div>MIPI Mode：{DEFAULT_MIPI_MODE}</div>
                <div>MIPI Lane：{DEFAULT_MIPI_LANES}</div>
                {selectedDevice.status === "unauthorized" && (
                  <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-2 py-2 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-200">
                    请看一下设备屏幕，确认 USB 调试授权弹窗，然后手动点击刷新。
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ADB over TCP 地址</label>
              <div className="flex gap-2">
                <input type="text" value={adbTcpAddress} onChange={(e) => setAdbTcpAddress(e.target.value)} placeholder="192.168.137.100:5555" className="input text-sm flex-1" />
                <button onClick={handleAdbTcpConnect} disabled={checking} className="btn-secondary px-3">
                  <Link className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={adbConnected ? disconnectAdb : () => checkAdbConnection(false)} disabled={checking} className={`flex-1 btn ${adbConnected ? "btn-danger" : "btn-success"}`}>
                <Power className="w-4 h-4 inline mr-1" />
                {checking ? "处理中..." : adbConnected ? "断开" : "刷新并连接"}
              </button>
              <button onClick={() => checkAdbConnection(false)} disabled={checking} className="btn-secondary px-3">
                <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeConnection === "ssh" && (
        <div className="panel">
          <div className="panel-header flex items-center gap-2">
            <Wifi className="w-4 h-4" />
            SSH连接
            <span
              className={`ml-auto px-2 py-0.5 text-xs rounded-full flex items-center gap-1 ${
                netConnected
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
              }`}
            >
              {netConnected ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {netConnected ? "已连接" : "未连接"}
            </span>
          </div>
          <div className="panel-body space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 bg-gray-50/70 dark:bg-gray-800/60">
                <div className="text-[11px] text-gray-500 dark:text-gray-400">当前目标</div>
                <div className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-100">{ipAddress}</div>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 bg-gray-50/70 dark:bg-gray-800/60">
                <div className="text-[11px] text-gray-500 dark:text-gray-400">上次成功</div>
                <div className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-100">{lastSuccessfulSshIp || "暂无"}</div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">8K平台网址</label>
              <select value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} className="input text-sm">
                {SSH_ENDPOINTS.map((item) => (
                  <option key={item.host} value={item.host}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={netConnected ? disconnectSsh : checkSshConnection} disabled={checking} className={`flex-1 btn ${netConnected ? "btn-danger" : "btn-success"}`}>
                <Power className="w-4 h-4 inline mr-1" />
                {checking ? "连接中..." : netConnected ? "断开" : "连接"}
              </button>
              <button onClick={checkSshConnection} disabled={checking} className="btn-secondary px-3">
                <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span>执行日志</span>
            <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap select-none">
              <input type="checkbox" checked={debugMode} onChange={(e) => setDebugMode(e.target.checked)} />
              调试模式
            </label>
          </div>
          <button onClick={handleClearLogs} className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            清空日志
          </button>
        </div>
        <div className="panel-body">
          <div ref={logContainerRef} className="space-y-1 overflow-auto max-h-56 text-xs">
            {logs.length === 0 ? (
              <div className="text-gray-400">暂无日志，后续 ADB / SSH / 屏幕操作会显示在这里。</div>
            ) : (
              logs.slice(-30).map((log) => (
                <div key={log.id} className="flex gap-2 font-mono">
                  <span className="text-gray-400">[{log.time}]</span>
                  <span
                    className={
                      log.level === "error"
                        ? "text-red-500"
                        : log.level === "warning"
                          ? "text-yellow-600"
                          : log.level === "success"
                            ? "text-green-600"
                            : log.level === "debug"
                              ? "text-blue-600 dark:text-blue-300"
                              : "text-gray-700 dark:text-gray-200"
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-3 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
        <MonitorSmartphone className="w-4 h-4 mt-0.5" />
        <div>当前版本保留手动 ADB 刷新、SSH 网址选择和基础日志，界面尽量简化，先满足点屏调试使用。</div>
      </div>
    </div>
  );
}

