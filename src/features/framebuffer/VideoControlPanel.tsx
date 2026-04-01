import { Play, Square } from "lucide-react";

export function VideoControlPanel(props: {
  isVisible: boolean;
  videoControlStatus: "idle" | "playing" | "paused";
  isCheckingVideoPlayback: boolean;
  videoZoomMode: 0 | 1 | 2;
  showVideoFramerate: boolean;
  canVideoPlay: boolean;
  canVideoPause: boolean;
  canVideoStop: boolean;
  onVideoZoomModeChange: (value: 0 | 1 | 2) => void;
  onShowVideoFramerateChange: (checked: boolean) => void;
  onVideoAction: (action: "play" | "pause" | "stop") => void;
}) {
  const {
    isVisible,
    videoControlStatus,
    isCheckingVideoPlayback,
    videoZoomMode,
    showVideoFramerate,
    canVideoPlay,
    canVideoPause,
    canVideoStop,
    onVideoZoomModeChange,
    onShowVideoFramerateChange,
    onVideoAction,
  } = props;

  if (!isVisible) return null;

  return (
    <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">视频控制</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">选择视频文件后，可执行播放 / 暂停 / 停止。</div>
        </div>
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full ${videoControlStatus === "playing" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : videoControlStatus === "paused" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}
        >
          {isCheckingVideoPlayback ? "检测中" : videoControlStatus === "playing" ? "播放中" : videoControlStatus === "paused" ? "已暂停" : "未开始"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/20 px-3 py-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">缩放</label>
          <select value={videoZoomMode} onChange={(e) => onVideoZoomModeChange(Number(e.target.value) as 0 | 1 | 2)} className="input text-sm">
            <option value={0}>原始大小</option>
            <option value={1}>适应屏幕</option>
            <option value={2}>填充屏幕</option>
          </select>
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input type="checkbox" checked={showVideoFramerate} onChange={(e) => onShowVideoFramerateChange(e.target.checked)} />
            显示分辨率 / 帧率信息
          </label>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => onVideoAction("play")} disabled={!canVideoPlay} className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-green-100 dark:hover:bg-green-900/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          <Play className="w-4 h-4" />
          播放
        </button>
        <button onClick={() => onVideoAction("pause")} disabled={!canVideoPause} className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          <Square className="w-4 h-4" />
          暂停
        </button>
        <button onClick={() => onVideoAction("stop")} disabled={!canVideoStop} className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          <Square className="w-4 h-4" />
          停止
        </button>
      </div>
    </div>
  );
}
