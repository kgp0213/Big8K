import { CheckCircle, Power, RefreshCw, Wifi, XCircle } from "lucide-react";

type Props = {
  checking: boolean;
  netConnected: boolean;
  ipAddress: string;
  lastSuccessfulSshIp: string;
  sshEndpoints: { label: string; host: string }[];
  onIpAddressChange: (value: string) => void;
  onConnectOrDisconnect: () => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
};

export default function SshConnectionCard({
  checking,
  netConnected,
  ipAddress,
  lastSuccessfulSshIp,
  sshEndpoints,
  onIpAddressChange,
  onConnectOrDisconnect,
  onRefresh,
}: Props) {
  return (
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
          <select value={ipAddress} onChange={(e) => onIpAddressChange(e.target.value)} className="input text-sm">
            {sshEndpoints.map((item) => (
              <option key={item.host} value={item.host}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void onConnectOrDisconnect()} disabled={checking} className={`flex-1 btn ${netConnected ? "btn-danger" : "btn-success"}`}>
            <Power className="w-4 h-4 inline mr-1" />
            {checking ? "连接中..." : netConnected ? "断开" : "连接"}
          </button>
          <button onClick={() => void onRefresh()} disabled={checking} className="btn-secondary px-3">
            <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
