import { FileCode, FolderTree, Image, Loader2, Play, Settings2, Trash2, Upload, Video } from "lucide-react";
import { VideoControlPanel } from "./VideoControlPanel";

export type WorkspaceFileType = "script" | "image" | "video";

export const WORKSPACE_FILE_TYPE_CONFIG: Record<
  WorkspaceFileType,
  { label: string; path: string; extensions: string[] }
> = {
  script: {
    label: "脚本",
    path: "/vismm/fbshow/",
    extensions: [".py"],
  },
  image: {
    label: "图片",
    path: "/vismm/fbshow/bmp_online/",
    extensions: [".bmp", ".jpg", ".jpeg", ".png"],
  },
  video: {
    label: "视频",
    path: "/vismm/fbshow/movie_online/",
    extensions: [".mp4", ".avi", ".mov"],
  },
};

export function WorkspaceFilePanel(props: {
  isConnected: boolean;
  fileType: WorkspaceFileType;
  onFileTypeChange: (type: WorkspaceFileType) => void;
  remotePath: string;
  onRemotePathChange: (value: string) => void;
  selectedFileInput: string;
  onSelectedFileInputChange: (value: string) => void;
  remoteFileList: string[];
  onSelectRemoteFile: (file: string) => void;
  isLoadingFiles: boolean;
  onLoadFiles: () => void;
  isUploading: boolean;
  onUploadFile: () => void;
  isScriptWorkspaceActive: boolean;
  isVideoWorkspaceActive: boolean;
  hasWorkspaceSelection: boolean;
  isScriptRunning: boolean;
  onRunScript: () => void;
  onDeleteFile: () => void;
  onSetAutorun: () => void;
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
    isConnected,
    fileType,
    onFileTypeChange,
    remotePath,
    onRemotePathChange,
    selectedFileInput,
    onSelectedFileInputChange,
    remoteFileList,
    onSelectRemoteFile,
    isLoadingFiles,
    onLoadFiles,
    isUploading,
    onUploadFile,
    isScriptWorkspaceActive,
    isVideoWorkspaceActive,
    hasWorkspaceSelection,
    isScriptRunning,
    onRunScript,
    onDeleteFile,
    onSetAutorun,
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

  return (
    <div className="panel">
      <div className="panel-header flex items-center gap-2">
        <FolderTree className="w-4 h-4" />
        文件工作区
      </div>
      <div className="panel-body space-y-4">
        <div className="flex gap-2">
          {(["script", "image", "video"] as WorkspaceFileType[]).map((type) => (
            <button
              key={type}
              onClick={() => onFileTypeChange(type)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                fileType === type
                  ? "border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              {WORKSPACE_FILE_TYPE_CONFIG[type].label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">远端路径</label>
            <input value={remotePath} onChange={(e) => onRemotePathChange(e.target.value)} className="input text-sm" placeholder="/vismm/fbshow/" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">选择文件</label>
            <input value={selectedFileInput} onChange={(e) => onSelectedFileInputChange(e.target.value)} className="input text-sm" placeholder="从下方列表选中或手动输入" readOnly />
          </div>
        </div>

        <div>
          <div className="space-y-2 mb-2">
            <label className="block text-xs text-gray-500 dark:text-gray-400">
              文件列表 ({remoteFileList.length} 个{WORKSPACE_FILE_TYPE_CONFIG[fileType].label}文件)
            </label>
            <button onClick={onLoadFiles} disabled={!isConnected || isLoadingFiles} className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 px-4 py-2.5 text-sm font-medium text-primary-700 dark:text-primary-300 transition-colors hover:bg-primary-100 dark:hover:bg-primary-900/30 disabled:opacity-60 disabled:cursor-not-allowed">
              {isLoadingFiles ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderTree className="w-4 h-4" />}
              查看目录
            </button>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 max-h-[240px] overflow-auto">
            {remoteFileList.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">点击"查看目录"加载文件列表</div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {remoteFileList.map((file, index) => (
                  <li key={`${file}-${index}`}>
                    <button
                      onClick={() => onSelectRemoteFile(file)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-2 ${
                        selectedFileInput === file ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300" : ""
                      }`}
                    >
                      {fileType === "script" && <FileCode className="w-4 h-4 text-gray-400" />}
                      {fileType === "image" && <Image className="w-4 h-4 text-gray-400" />}
                      {fileType === "video" && <Video className="w-4 h-4 text-gray-400" />}
                      <span className="truncate">{file}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <VideoControlPanel
          isVisible={isVideoWorkspaceActive}
          videoControlStatus={videoControlStatus}
          isCheckingVideoPlayback={isCheckingVideoPlayback}
          videoZoomMode={videoZoomMode}
          showVideoFramerate={showVideoFramerate}
          canVideoPlay={canVideoPlay}
          canVideoPause={canVideoPause}
          canVideoStop={canVideoStop}
          onVideoZoomModeChange={onVideoZoomModeChange}
          onShowVideoFramerateChange={onShowVideoFramerateChange}
          onVideoAction={onVideoAction}
        />

        <div className="grid grid-cols-2 gap-2">
          <button onClick={onUploadFile} disabled={!isConnected || isUploading} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary-300 dark:hover:border-primary-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            上传文件
          </button>
          {isScriptWorkspaceActive ? (
            <button onClick={onRunScript} disabled={!isConnected || !hasWorkspaceSelection || isScriptRunning} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary-300 dark:hover:border-primary-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <Play className="w-4 h-4" />
              运行脚本
            </button>
          ) : null}
          <button onClick={onDeleteFile} disabled={!isConnected || !hasWorkspaceSelection} className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <Trash2 className="w-4 h-4" />
            删除文件
          </button>
          {isScriptWorkspaceActive ? (
            <button onClick={onSetAutorun} disabled={!isConnected || !hasWorkspaceSelection} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary-300 dark:hover:border-primary-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <Settings2 className="w-4 h-4" />
              设置开机运行
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
