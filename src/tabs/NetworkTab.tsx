import { Globe, Wifi, Cable, Network, RefreshCw, PlugZap } from "lucide-react";

export default function NetworkTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 panel">
          <div className="panel-header flex items-center gap-2">
            <Network className="w-4 h-4" />
            网络 / ADB 通信设置
          </div>
          <div className="panel-body space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <label className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer">
                <input type="radio" name="iface" defaultChecked />
                <Cable className="w-4 h-4" />
                <span>ADB</span>
              </label>
              <label className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer">
                <input type="radio" name="iface" />
                <Wifi className="w-4 h-4" />
                <span>ETH 192.168.1.x</span>
              </label>
              <label className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer">
                <input type="radio" name="iface" />
                <Globe className="w-4 h-4" />
                <span>ETH 192.168.137.x</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                <div className="font-semibold text-sm">静态 IP 快捷配置</div>
                <button className="w-full btn-secondary text-sm">设置 192.168.1.100</button>
                <button className="w-full btn-secondary text-sm">设置 192.168.137.100</button>
                <button className="w-full btn-secondary text-sm">查看本机 IP</button>
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                <div className="font-semibold text-sm">通信检查</div>
                <button className="w-full btn-primary text-sm flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  网络测试
                </button>
                <button className="w-full btn-secondary text-sm flex items-center justify-center gap-2">
                  <PlugZap className="w-4 h-4" />
                  断开网络 ADB
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">说明</div>
          <div className="panel-body text-sm text-gray-600 dark:text-gray-300 space-y-2">
            <p>· 这里对齐原 C# 上位机的 ADB / 网络通信切换逻辑。</p>
            <p>· 后续会把静态 IP 设置、网络检测、断开网络 ADB 逐步接成真功能。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
