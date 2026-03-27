import { FolderOpen } from "lucide-react";
import type { RecentLcdConfigItem } from "./types";

type Props = {
  recentConfigs: RecentLcdConfigItem[];
  showRecentConfigs: boolean;
  onToggle: () => void;
  onLoadRecentConfig: (path: string) => void | Promise<void>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

export default function RecentConfigMenu({
  recentConfigs,
  showRecentConfigs,
  onToggle,
  onLoadRecentConfig,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  return (
    <div className="relative" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <button
        onClick={onToggle}
        className="inline-flex h-10 min-h-10 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors align-middle"
      >
        <FolderOpen className="w-4 h-4" />
        打开最近配置
      </button>
      {showRecentConfigs && (
        <div className="absolute top-full left-0 mt-0 z-20 w-[760px] max-h-80 overflow-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-2">
          {recentConfigs.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">暂无历史点屏配置</div>
          ) : (
            recentConfigs.map((item) => {
              const parts = item.path.split(/[/\\]/);
              const fileName = parts[parts.length - 1] || item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => void onLoadRecentConfig(item.path)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate" title={fileName}>{fileName}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1" title={item.path}>{item.path}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    最近使用：{new Date(item.lastUsedAt).toLocaleString("zh-CN", { hour12: false })}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
