import { Globe, Loader2, Server, Wifi } from "lucide-react";
import { STATIC_IP_PRESETS, type HostNetworkCard, type LocalNetworkInfo, type StaticIpPreset } from "./types";

type DeployNetworkPanelProps = {
  adbReady: boolean;
  isSettingIp: boolean;
  isLoadingLocalIp: boolean;
  selectedPresetIp: string | null;
  localNetworkInfo: LocalNetworkInfo | null;
  networkCards: HostNetworkCard[];
  onSetStaticIp: (preset: StaticIpPreset) => Promise<void> | void;
  onViewLocalIp: () => Promise<void> | void;
};

export function DeployNetworkPanel({
  adbReady,
  isSettingIp,
  isLoadingLocalIp,
  selectedPresetIp,
  localNetworkInfo,
  networkCards,
  onSetStaticIp,
  onViewLocalIp,
}: DeployNetworkPanelProps) {
  return (
    <div className="space-y-4">
      <div className="panel sticky top-0">
        <div className="panel-header flex items-center gap-2">
          <Globe className="w-4 h-4" />
          网络 / IP 配置
        </div>
        <div className="panel-body space-y-4">
          <div className="rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-900/10 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
            常用部署场景保留为一键切换，点击后直接把 8K 平台设置成对口 IP。
          </div>
          <div className="space-y-3">
            {STATIC_IP_PRESETS.map((preset) => (
              <button
                key={preset.ip}
                type="button"
                onClick={() => void onSetStaticIp(preset)}
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
            点击后快速读取本机有线 / 无线网卡 IPv4，虚拟网卡与蓝牙网卡会自动过滤。
          </div>
          <button
            type="button"
            onClick={() => void onViewLocalIp()}
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
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {networkCards.length > 0 ? `已筛选出 ${networkCards.length} 个有线 / 无线网卡` : localNetworkInfo.error ?? "未找到有线/无线网卡"}
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs text-gray-500 dark:text-gray-400">
                {networkCards.map((item) => (
                  <div key={`${item.name}-${item.ipv4}`} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-3 space-y-1">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{item.name}</div>
                    <div>IPv4：{item.ipv4}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
