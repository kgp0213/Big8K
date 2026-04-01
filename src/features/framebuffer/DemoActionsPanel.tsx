import { Film, Image, Monitor, Video } from "lucide-react";

export function DemoActionsPanel(props: {
  isConnected: boolean;
  onSetDefaultPattern: () => void;
  onLoopImages: () => void;
  onVideoPlay: () => void;
}) {
  const { isConnected, onSetDefaultPattern, onLoopImages, onVideoPlay } = props;

  return (
    <div className="panel">
      <div className="panel-header flex items-center gap-2">
        <Film className="w-4 h-4" />
        DEMO
      </div>
      <div className="panel-body space-y-4">
        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={onSetDefaultPattern}
            disabled={!isConnected}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 px-4 py-4 text-left transition-colors hover:border-primary-300 dark:hover:border-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900/30">
                <Monitor className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <div className="text-sm font-semibold">Set default pattern L128</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">设置默认灰阶画面</div>
              </div>
            </div>
          </button>

          <button
            onClick={onLoopImages}
            disabled={!isConnected}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 px-4 py-4 text-left transition-colors hover:border-primary-300 dark:hover:border-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Image className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-sm font-semibold">循环播放图片</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">生成并运行循环图片脚本</div>
              </div>
            </div>
          </button>

          <button
            onClick={onVideoPlay}
            disabled={!isConnected}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 px-4 py-4 text-left transition-colors hover:border-primary-300 dark:hover:border-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <Video className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="text-sm font-semibold">视频播放</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">按 C# default_movie 行为部署运行</div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
