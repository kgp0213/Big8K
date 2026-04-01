import { FolderTree, Image, Loader2 } from "lucide-react";

export function RemoteBmpPanel(props: {
  isConnected: boolean;
  isLoadingRemoteBmpFiles: boolean;
  remoteBmpFiles: string[];
  selectedRemoteBmp: string;
  onLoadRemoteBmpFiles: () => void;
  onSelectRemoteBmp: (file: string) => void;
  onDisplayRemoteBmp: (file: string) => void;
}) {
  const {
    isConnected,
    isLoadingRemoteBmpFiles,
    remoteBmpFiles,
    selectedRemoteBmp,
    onLoadRemoteBmpFiles,
    onSelectRemoteBmp,
    onDisplayRemoteBmp,
  } = props;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">远端 BMP 列表</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">读取 `/vismm/fbshow/bmp_online/` 目录，双击文件直接调用 fbShowBmp 显示。</div>
          </div>
          <button
            onClick={onLoadRemoteBmpFiles}
            disabled={!isConnected || isLoadingRemoteBmpFiles}
            className="btn-secondary flex items-center gap-2 shrink-0"
          >
            {isLoadingRemoteBmpFiles ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderTree className="w-4 h-4" />}
            {isLoadingRemoteBmpFiles ? "读取中..." : "读取远端 BMP"}
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-3 text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <div>· 步骤 1 选择本地 BMP；步骤 2 双击本地图片会重新推送并显示</div>
            <div>· 这里列的是板端 `/vismm/fbshow/bmp_online/` 目录里的 BMP 文件</div>
            <div>· 双击任意远端文件，将直接执行 `fbShowBmp` 显示</div>
          </div>

          <div className="max-h-[520px] overflow-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
            {remoteBmpFiles.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                先点“读取远端 BMP”，把 `/vismm/fbshow/bmp_online/` 目录文件加载出来。
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {remoteBmpFiles.map((file, index) => {
                  const selected = selectedRemoteBmp === file;
                  return (
                    <li key={`${file}-${index}`}>
                      <button
                        onClick={() => onSelectRemoteBmp(file)}
                        onDoubleClick={() => onDisplayRemoteBmp(file)}
                        className={`w-full px-4 py-3 text-left transition-colors ${selected ? "bg-primary-50 dark:bg-primary-900/20" : "hover:bg-white dark:hover:bg-gray-900/40"}`}
                        title={file}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex items-center gap-2">
                            <Image className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="truncate text-sm text-gray-800 dark:text-gray-100">{file}</span>
                          </div>
                          <span className="text-[11px] text-gray-400 shrink-0">双击显示</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
