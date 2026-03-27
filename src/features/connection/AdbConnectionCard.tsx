import { Activity, CheckCircle, Cpu, Link, Power, RefreshCw, Usb, XCircle } from "lucide-react";
import { DEFAULT_SCREEN_RESOLUTION } from "./constants";
import { getAdbStatusBadgeClass, getAdbStatusLabel, getAdbStatusTone } from "./helpers";
import type { AdbDevice } from "./types";

type Props = {
  checking: boolean;
  adbConnected: boolean;
  deviceId: string;
  deviceList: AdbDevice[];
  adbTcpAddress: string;
  selectedDevice?: AdbDevice;
  selectedDeviceStatusLabel: string;
  connection: {
    deviceModel?: string;
    screenResolution?: string;
    bitsPerPixel?: string;
    mipiMode?: string;
    mipiLanes?: number;
  };
  onSelectDevice: (selectedId: string) => void | Promise<void>;
  onAdbTcpAddressChange: (value: string) => void;
  onAdbTcpConnect: () => void | Promise<void>;
  onRefreshOrConnect: () => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
  onDisconnect: () => void | Promise<void>;
};

export default function AdbConnectionCard({
  checking,
  adbConnected,
  deviceId,
  deviceList,
  adbTcpAddress,
  selectedDevice,
  selectedDeviceStatusLabel,
  connection,
  onSelectDevice,
  onAdbTcpAddressChange,
  onAdbTcpConnect,
  onRefreshOrConnect,
  onRefresh,
  onDisconnect,
}: Props) {
  return (
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
          <select value={deviceId} onChange={(e) => void onSelectDevice(e.target.value)} className="input text-sm" disabled={deviceList.length === 0}>
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
            {connection.deviceModel ? <div>设备型号：{connection.deviceModel}</div> : null}
            <div>屏幕分辨率：{connection.screenResolution || DEFAULT_SCREEN_RESOLUTION}</div>
            {connection.bitsPerPixel ? <div>位深：{connection.bitsPerPixel}</div> : null}
            <div>MIPI 类型：{connection.mipiMode || "未读取"}；MIPI Lane：{typeof connection.mipiLanes === "number" ? connection.mipiLanes : "未读取"}</div>
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
            <input type="text" value={adbTcpAddress} onChange={(e) => onAdbTcpAddressChange(e.target.value)} placeholder="192.168.137.100:5555" className="input text-sm flex-1" />
            <button onClick={() => void onAdbTcpConnect()} disabled={checking} className="btn-secondary px-3">
              <Link className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={adbConnected ? () => void onDisconnect() : () => void onRefreshOrConnect()} disabled={checking} className={`flex-1 btn ${adbConnected ? "btn-danger" : "btn-success"}`}>
            <Power className="w-4 h-4 inline mr-1" />
            {checking ? "处理中..." : adbConnected ? "断开" : "刷新并连接"}
          </button>
          <button onClick={() => void onRefresh()} disabled={checking} className="btn-secondary px-3">
            <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
