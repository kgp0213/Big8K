import { Network, Wifi, Cable, Globe } from "lucide-react";

export default function NetworkTab() {
  return (
    <div className="space-y-4">
      <div className="panel">
        <div className="panel-header flex items-center gap-2">
          <Network className="w-4 h-4" />
          网络配置说明
        </div>
        <div className="panel-body space-y-4 text-sm text-gray-600 dark:text-gray-300">
          <p>当前版本的实际连接入口统一放在右侧连接面板：</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900/30">
              <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100"><Cable className="w-4 h-4" />USB / ADB</div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">用于本地直连调试、屏幕显示和脚本下发。</div>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900/30">
              <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100"><Wifi className="w-4 h-4" />局域网 SSH</div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">用于远程命令执行和辅助排查，地址由右侧连接面板管理。</div>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900/30">
              <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100"><Globe className="w-4 h-4" />静态 IP</div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">如需固定 IP、网络切换或 ADB over TCP，请结合系统网络设置手动处理。</div>
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-4 text-xs text-gray-500 dark:text-gray-400">
            本页当前只保留网络相关说明，不再放置未接通的占位按钮，避免误导后续维护。
          </div>
        </div>
      </div>
    </div>
  );
}
