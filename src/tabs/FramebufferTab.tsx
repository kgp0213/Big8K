import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  Image,
  Monitor,
  Palette,
  Film,
  Loader2,
  FolderOpen,
  Search,
  Check,
  FolderTree,
  Video,
} from "lucide-react";
import { useConnection } from "../App";
import { WorkspaceFilePanel } from "../features/framebuffer/WorkspaceFilePanel";
import { tauriInvoke } from "../utils/tauri";

interface PatternResult {
  success: boolean;
  message: string;
  error?: string;
}

interface LocalImageEntry {
  id: string;
  name: string;
  path: string;
  realPath?: string;
  file?: File;
  ext: string;
  width?: number;
  height?: number;
  lastModified?: number;
  previewUrl?: string;
}

type ImageSortMode = "name" | "mtime";
type ImageViewMode = "grid" | "list";
type SubTab = "image" | "pattern" | "video";

const IMAGE_EXTENSIONS = new Set([".bmp"]);

const patternOptions = [
  { name: "横向渐变 1", color: "h_gradient_1", bg: "bg-gradient-to-r from-black via-gray-400 to-white" },
  { name: "横向渐变 2", color: "h_gradient_2", bg: "bg-gradient-to-r from-white via-gray-400 to-black" },
  { name: "竖向渐变 1", color: "v_gradient_1", bg: "bg-gradient-to-b from-black to-white" },
  { name: "竖向渐变 2", color: "v_gradient_2", bg: "bg-gradient-to-b from-white to-black" },
  { name: "放射灰阶", color: "radial_gray", bg: "bg-[radial-gradient(circle_at_center,_#ffffff_0%,_#9ca3af_45%,_#000000_100%)]" },
  { name: "棋盘格", color: "checkerboard", bg: "bg-[linear-gradient(45deg,#111_25%,#fff_25%,#fff_50%,#111_50%,#111_75%,#fff_75%,#fff_100%)] bg-[length:24px_24px]" },
  { name: "炫彩 1", color: "logic_34", bg: "bg-[linear-gradient(120deg,#ff0040_0%,#ffb000_18%,#53ff00_36%,#00ffd0_54%,#0066ff_72%,#b000ff_88%,#ff3366_100%)]" },
  { name: "横向彩条渐变 1", color: "h_colorbar_gradient_1", bg: "bg-[linear-gradient(to_right,#ff0000_0%,#ffff00_20%,#00ff00_40%,#00ffff_60%,#0000ff_80%,#ff00ff_100%)]" },
  { name: "横向彩条渐变 2", color: "h_colorbar_gradient_2", bg: "bg-[linear-gradient(to_right,#ff00ff_0%,#0000ff_20%,#00ffff_40%,#00ff00_60%,#ffff00_80%,#ff0000_100%)]" },
  { name: "竖向彩条渐变 1", color: "v_colorbar_gradient_1", bg: "bg-[linear-gradient(to_bottom,#ff0000_0%,#ffff00_20%,#00ff00_40%,#00ffff_60%,#0000ff_80%,#ff00ff_100%)]" },
  { name: "竖向彩条渐变 2", color: "v_colorbar_gradient_2", bg: "bg-[linear-gradient(to_bottom,#ff00ff_0%,#0000ff_20%,#00ffff_40%,#00ff00_60%,#ffff00_80%,#ff0000_100%)]" },
  { name: "红渐变", color: "red_gradient", bg: "bg-gradient-to-r from-black to-red-600" },
  { name: "绿渐变", color: "green_gradient", bg: "bg-gradient-to-r from-black to-green-600" },
  { name: "蓝渐变", color: "blue_gradient", bg: "bg-gradient-to-r from-black to-blue-600" },
  { name: "彩条", color: "color_bar", bg: "bg-[linear-gradient(to_right,#ffffff_0%,#ffffff_12.5%,#ffff00_12.5%,#ffff00_25%,#00ffff_25%,#00ffff_37.5%,#00ff00_37.5%,#00ff00_50%,#ff00ff_50%,#ff00ff_62.5%,#0000ff_62.5%,#0000ff_75%,#ff0000_75%,#ff0000_87.5%,#000000_87.5%,#000000_100%)]" },
  { name: "纯红", color: "pure_red", bg: "bg-red-500" },
  { name: "纯绿", color: "pure_green", bg: "bg-green-500" },
  { name: "纯蓝", color: "pure_blue", bg: "bg-blue-500" },
  { name: "纯黑", color: "pure_black", bg: "bg-black" },
  { name: "综合 Demo", color: "demo", bg: "bg-gradient-to-br from-slate-900 via-cyan-900 to-blue-700" },
] as const;

const patternLabels = Object.fromEntries(patternOptions.map((item) => [item.color, item.name])) as Record<string, string>;

// 文件类型配置
const FILE_TYPE_CONFIG = {
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
} as const;

type FileType = keyof typeof FILE_TYPE_CONFIG;

let imagePanelCache: {
  entries: LocalImageEntry[];
  imagePath: string;
  imageSearch: string;
  resolutionFilterEnabled: boolean;
  sortMode: ImageSortMode;
  viewMode: ImageViewMode;
} | null = null;

function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

export default function FramebufferTab() {
  const { connection, appendLog, debugMode } = useConnection();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<SubTab>("pattern");
  const [loading, setLoading] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState(imagePanelCache?.imagePath || "");
  const [folderImageEntries, setFolderImageEntries] = useState<LocalImageEntry[]>(imagePanelCache?.entries || []);
  const [imageSearch, setImageSearch] = useState(imagePanelCache?.imageSearch || "");
  const [resolutionFilterEnabled, setResolutionFilterEnabled] = useState(imagePanelCache?.resolutionFilterEnabled || false);
  const [sortMode, setSortMode] = useState<ImageSortMode>(imagePanelCache?.sortMode || "name");
  const [viewMode, setViewMode] = useState<ImageViewMode>(imagePanelCache?.viewMode || "grid");
  const [remoteBmpFiles, setRemoteBmpFiles] = useState<string[]>([]);
  const [selectedRemoteBmp, setSelectedRemoteBmp] = useState<string>("");
  const [isLoadingRemoteBmpFiles, setIsLoadingRemoteBmpFiles] = useState(false);
  const [disconnectedLogged, setDisconnectedLogged] = useState(false);

  // 文件工作区状态
  const [fileType, setFileType] = useState<FileType>("script");
  const [remotePath, setRemotePath] = useState<string>(FILE_TYPE_CONFIG.script.path);
  const [selectedFileInput, setSelectedFileInput] = useState<string>("");
  const [remoteFileList, setRemoteFileList] = useState<string[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isScriptRunning, setIsScriptRunning] = useState(false);
  const [videoControlStatus, setVideoControlStatus] = useState<"idle" | "playing" | "paused">("idle");
  const [videoZoomMode, setVideoZoomMode] = useState<0 | 1 | 2>(1);
  const [showVideoFramerate, setShowVideoFramerate] = useState(false);
  const [isCheckingVideoPlayback, setIsCheckingVideoPlayback] = useState(false);
  const [isSwitchingVideoPlayback, setIsSwitchingVideoPlayback] = useState(false);

  const isConnected = connection.connected && connection.type === "adb";

  const currentResolution = useMemo(() => {
    const raw = connection.screenResolution?.trim();
    if (!raw) return null;
    const normalized = raw.replace(/×/g, "x").replace(/,/g, "x").replace(/\s+/g, "");
    const parts = normalized.split("x");
    if (parts.length !== 2) return null;
    const width = Number(parts[0]);
    const height = Number(parts[1]);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    return { width, height, label: `${width} × ${height}` };
  }, [connection.screenResolution]);

  useEffect(() => {
    if (!isConnected && !disconnectedLogged) {
      appendLog("连接状态 -> 未连接 ADB 设备，显示画面功能当前不可用", "warning");
      setDisconnectedLogged(true);
    }
    if (isConnected && disconnectedLogged) setDisconnectedLogged(false);
  }, [isConnected, disconnectedLogged, appendLog]);

  useEffect(() => {
    imagePanelCache = {
      entries: folderImageEntries,
      imagePath,
      imageSearch,
      resolutionFilterEnabled,
      sortMode,
      viewMode,
    };
  }, [folderImageEntries, imagePath, imageSearch, resolutionFilterEnabled, sortMode, viewMode]);

  useEffect(() => {
    return () => {
      folderImageEntries.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, [folderImageEntries]);

  const showMessage = (type: "success" | "error", text: string) => {
    appendLog(text, type === "success" ? "success" : "error");
  };

  const runCommand = async (cmd: string, args?: Record<string, unknown>, loadingKey?: string, actionLabel?: string) => {
    if (!isConnected) {
      showMessage("error", "连接检查 -> 未连接 ADB 设备，请先在右侧完成连接");
      return false;
    }
    const effectiveKey = loadingKey || cmd;
    const effectiveLabel = actionLabel || cmd;
    appendLog(`任务开始 -> ${effectiveLabel}`, "info");
    if (debugMode) appendLog(`-> invoke ${cmd}`, "debug");
    setLoading(effectiveKey);
    try {
      const result = await tauriInvoke<PatternResult>(cmd, args);
      if (result.success) {
        showMessage("success", `执行完成 -> ${effectiveLabel}`);
        return true;
      }
      showMessage("error", result.error || result.message || `执行失败 -> ${effectiveLabel}`);
      return false;
    } catch (err) {
      showMessage("error", `${effectiveLabel}异常: ${String(err)}`);
      return false;
    } finally {
      setLoading(null);
    }
  };

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        resolve(result.includes(",") ? result.split(",")[1] : result);
      };
      reader.onerror = () => reject(reader.error || new Error("文件读取失败"));
      reader.readAsDataURL(file);
    });

  const handleDisplayImage = async (targetPath?: string) => {
    const requestedPath = (targetPath || imagePath).trim();
    if (!requestedPath) {
      showMessage("error", "请先选择一张图片");
      return;
    }

    const selectedEntry = folderImageEntries.find((item) => item.path === requestedPath || item.realPath === requestedPath);
    const pathToUse = (selectedEntry?.realPath || requestedPath).trim();
    const originalName = (selectedEntry?.name || pathToUse.split(/[\\/]/).pop() || "input.bmp").trim();
    const remoteFileName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_") || "input.bmp";

    if (selectedEntry?.file && !selectedEntry?.realPath) {
      try {
        const base64Data = await fileToBase64(selectedEntry.file);
        const ok = await runCommand(
          "display_image_from_base64",
          {
            request: {
              filename: selectedEntry.name,
              remoteName: remoteFileName,
              base64Data,
            },
          },
          "display_image",
          "图片上屏"
        );
        if (ok) {
          appendLog(`已重新推送并显示 -> ${remoteFileName}`, "success");
        }
      } catch (err) {
        showMessage("error", `图片读取失败: ${String(err)}`);
      }
      return;
    }

    if (!pathToUse) {
      showMessage("error", "当前图片缺少可访问的本地路径，无法上屏");
      return;
    }

    const ok = await runCommand(
      "display_image",
      { request: { image_path: pathToUse, remote_name: remoteFileName } },
      "display_image",
      "图片上屏"
    );
    if (ok) {
      appendLog(`已重新推送并显示 -> ${remoteFileName}`, "success");
    }
  };

  const handleChooseImage = () => fileInputRef.current?.click();

  const handleLoadRemoteBmpFiles = async () => {
    if (!isConnected) {
      appendLog("请先连接 ADB 设备", "warning");
      return;
    }

    setIsLoadingRemoteBmpFiles(true);
    appendLog("查看目录: /vismm/fbshow/bmp_online/", "info");
    try {
      const result = await tauriInvoke<{ success: boolean; files: string[]; error?: string }>("list_remote_files", {
        request: { path: "/vismm/fbshow/bmp_online/" },
      });
      if (result.success && result.files) {
        const files = result.files.filter((file: string) => getFileExtension(file) === ".bmp");
        setRemoteBmpFiles(files);
        appendLog(`找到 ${files.length} 个远端 BMP 文件`, "success");
      } else {
        setRemoteBmpFiles([]);
        appendLog(result.error || "获取远端 BMP 列表失败", "error");
      }
    } catch (err) {
      setRemoteBmpFiles([]);
      appendLog(`获取远端 BMP 列表异常: ${String(err)}`, "error");
    } finally {
      setIsLoadingRemoteBmpFiles(false);
    }
  };

  const handleDisplayRemoteBmp = async (file: string) => {
    const fileName = file.trim();
    if (!fileName) return;
    setSelectedRemoteBmp(fileName);
    await runCommand(
      "display_remote_image",
      { remoteImagePath: `/vismm/fbshow/bmp_online/${fileName}` },
      "display_image",
      `显示远端 BMP: ${fileName}`,
    );
  };

  const handlePatternDisplay = async (pattern: string) => {
    if (!isConnected) {
      appendLog("连接检查 -> 未连接 ADB 设备，请先在右侧完成连接", "error");
      return;
    }

    if (pattern === "demo") {
      await runCommand("run_demo_screen", undefined, "demo", "综合 Demo");
      return;
    }

    const boardCommand = `python3 /vismm/fbshow/big8k_runtime/render_patterns.py ${pattern}`;
    appendLog(`显示画面 -> ${patternLabels[pattern] || pattern}`, "info");
    if (debugMode) appendLog(`-> adb shell ${boardCommand}`, "debug");
    try {
      const result = await tauriInvoke<PatternResult>("run_runtime_pattern", { request: { pattern } });
      if (result.success) {
        appendLog(`显示完成 -> ${patternLabels[pattern] || pattern}`, "success");
      } else {
        appendLog(result.error || result.message || `显示失败 -> ${patternLabels[pattern] || pattern}`, "error");
      }
    } catch (err) {
      appendLog(String(err), "error");
    }
  };

  // 文件类型切换时更新路径
  const handleFileTypeChange = (type: FileType) => {
    setFileType(type);
    setRemotePath(FILE_TYPE_CONFIG[type].path);
    setSelectedFileInput("");
    setRemoteFileList([]);
  };

  // 查看目录 - 获取远程文件列表
  const handleListRemoteFiles = async () => {
    if (!isConnected) {
      appendLog("请先连接 ADB 设备", "warning");
      return;
    }

    setIsLoadingFiles(true);
    appendLog(`查看目录: ${remotePath}`, "info");

    try {
      const result = await tauriInvoke<{ success: boolean; files: string[]; error?: string }>("list_remote_files", {
        request: { path: remotePath }
      });

      if (result.success && result.files) {
        // 根据文件类型过滤
        const extensions = FILE_TYPE_CONFIG[fileType].extensions;
        const filteredFiles = result.files.filter(file => {
          const ext = getFileExtension(file);
          return extensions.some(e => ext === e.toLowerCase());
        });
        setRemoteFileList(filteredFiles);
        appendLog(`找到 ${filteredFiles.length} 个${FILE_TYPE_CONFIG[fileType].label}文件`, "success");
      } else {
        appendLog(result.error || "获取文件列表失败", "error");
        setRemoteFileList([]);
      }
    } catch (err) {
      appendLog(`获取文件列表异常: ${String(err)}`, "error");
      setRemoteFileList([]);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // 上传文件
  const handleUploadFile = async () => {
    if (!isConnected) {
      appendLog("请先连接 ADB 设备", "warning");
      return;
    }

    // 触发文件选择对话框
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = FILE_TYPE_CONFIG[fileType].extensions.join(",");

    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      setIsUploading(true);
      appendLog(`开始上传 ${files.length} 个文件到 ${remotePath}`, "info");

      try {
        for (const file of Array.from(files)) {
          const arrayBuffer = await file.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
          );

          const result = await tauriInvoke<{ success: boolean; error?: string }>("upload_file_base64", {
            request: {
              base64_data: base64,
              remote_path: `${remotePath}${file.name}`,
            }
          });

          if (result.success) {
            appendLog(`上传成功: ${file.name}`, "success");
          } else {
            appendLog(`上传失败: ${file.name} - ${result.error}`, "error");
          }
        }

        // 上传完成后刷新列表
        await handleListRemoteFiles();
      } catch (err) {
        appendLog(`上传异常: ${String(err)}`, "error");
      } finally {
        setIsUploading(false);
      }
    };

    input.click();
  };

  // 运行脚本
  const handleRunScript = async () => {
    if (!isConnected) {
      appendLog("请先连接 ADB 设备", "warning");
      return;
    }
    if (!selectedFileInput) {
      appendLog("请先从列表中选择一个脚本", "warning");
      return;
    }

    const scriptPath = `${remotePath}${selectedFileInput}`;
    appendLog(`运行脚本: ${selectedFileInput}`, "info");
    if (debugMode) {
      appendLog(`DEBUG CMD -> adb shell python3 ${scriptPath}`, "debug");
    }
    setIsScriptRunning(true);
    try {
      const result = await tauriInvoke<{ success: boolean; output?: string; error?: string }>("run_remote_script", {
        request: { script_path: scriptPath }
      });

      if (result.success) {
        appendLog(result.output || "脚本已后台启动", "success");
      } else {
        appendLog(result.error || "脚本执行失败", "error");
      }
    } catch (err) {
      appendLog(`脚本执行异常: ${String(err)}`, "error");
    } finally {
      setIsScriptRunning(false);
    }
  };

  // 设置开机运行脚本
  const handleSetAutorun = async () => {
    if (!isConnected) {
      appendLog("请先连接 ADB 设备", "warning");
      return;
    }
    if (!selectedFileInput) {
      appendLog("请先从列表中选择一个脚本", "warning");
      return;
    }

    appendLog(`设置开机运行: ${selectedFileInput}`, "info");
    try {
      const result = await tauriInvoke<{ success: boolean; error?: string }>("set_script_autorun", {
        request: { script_name: selectedFileInput }
      });

      if (result.success) {
        appendLog(`开机运行设置成功，重启后生效`, "success");
      } else {
        appendLog(result.error || "设置开机运行失败", "error");
      }
    } catch (err) {
      appendLog(`设置开机运行异常: ${String(err)}`, "error");
    }
  };

  // 删除文件
  const handleDeleteFile = async () => {
    if (!isConnected) {
      appendLog("请先连接 ADB 设备", "warning");
      return;
    }
    if (!selectedFileInput) {
      appendLog("请先从列表中选择一个文件", "warning");
      return;
    }

    appendLog(`删除文件: ${selectedFileInput}`, "info");
    try {
      const result = await tauriInvoke<{ success: boolean; error?: string }>("delete_remote_file", {
        request: { file_path: `${remotePath}${selectedFileInput}` }
      });

      if (result.success) {
        appendLog(`文件删除成功`, "success");
        setSelectedFileInput("");
        await handleListRemoteFiles();
      } else {
        appendLog(result.error || "删除文件失败", "error");
      }
    } catch (err) {
      appendLog(`删除文件异常: ${String(err)}`, "error");
    }
  };

  // 视频播放（严格对齐 C# btn_graphical_target_Click，独立于下方视频工作区）
  const handleVideoPlay = async () => {
    if (!isConnected) {
      appendLog("请先连接 ADB 设备", "warning");
      return;
    }

    appendLog("视频播放 -> 按 C# btn_graphical_target_Click 独立部署 default_movie", "info");
    try {
      const result = await tauriInvoke<{ success: boolean; output?: string; error?: string }>("deploy_set_default_movie");
      if (result.success) {
        appendLog(result.output || "开机自动播放视频脚本添加完成", "success");
      } else {
        appendLog(result.error || result.output || "视频播放失败", "error");
      }
    } catch (err) {
      appendLog(`视频播放异常: ${String(err)}`, "error");
    }
  };

  const handleDemoSetDefaultPattern = async () => {
    if (!isConnected) {
      appendLog("请先连接 ADB 设备", "warning");
      return;
    }
    appendLog("设置默认灰阶画面 -> Set default pattern L128", "info");
    try {
      const result = await tauriInvoke<{ success: boolean; output?: string; error?: string }>("deploy_set_default_pattern");
      if (result.success) {
        appendLog(result.output || "开机刷白脚本推送完成并运行！", "success");
      } else {
        appendLog(result.error || result.output || "设置默认灰阶失败", "error");
      }
    } catch (err) {
      appendLog(`设置默认灰阶异常: ${String(err)}`, "error");
    }
  };

  const handleVideoWorkspaceControl = async (action: "play" | "pause" | "stop") => {
    if (!isConnected) {
      appendLog("请先连接 ADB 设备", "warning");
      return;
    }
    if (fileType !== "video" || !selectedFileInput.trim()) {
      appendLog("请先在文件工作区选择一个视频文件", "warning");
      return;
    }

    try {
      if (action === "play") {
        setIsSwitchingVideoPlayback(true);
        setIsCheckingVideoPlayback(true);
        const playbackStatus = await tauriInvoke<{ success: boolean; is_running: boolean; output: string; error?: string }>("get_video_playback_status");
        setIsCheckingVideoPlayback(false);

        if (playbackStatus.success && playbackStatus.is_running) {
          appendLog("检测到远端已有视频在播放，先停止旧视频，再切换到新视频。", "info");
          if (debugMode) {
            appendLog("DEBUG CMD -> adb shell echo > /dev/shm/stop_signal", "debug");
          }
          const stopResult = await tauriInvoke<{ success: boolean; output?: string; error?: string }>("send_video_control", {
            request: { action: "stop" }
          });
          if (!stopResult.success) {
            appendLog(stopResult.error || stopResult.output || "停止旧视频失败", "error");
            return;
          }

          let stopped = false;
          for (let i = 0; i < 10; i += 1) {
            await new Promise((resolve) => window.setTimeout(resolve, 250));
            const nextStatus = await tauriInvoke<{ success: boolean; is_running: boolean; output: string; error?: string }>("get_video_playback_status");
            if (nextStatus.success && !nextStatus.is_running) {
              stopped = true;
              break;
            }
          }
          if (!stopped) {
            appendLog("旧视频停止超时，本次切换已取消。", "error");
            return;
          }
        }

        appendLog(`视频控制 -> 播放 ${selectedFileInput}（缩放=${videoZoomMode}，显示分辨率/帧率=${showVideoFramerate ? "开" : "关"}）`, "info");
        if (debugMode) {
          appendLog(`DEBUG CMD -> adb shell /usr/bin/python3 /vismm/fbshow/videoPlay.py /vismm/fbshow/movie_online/${selectedFileInput} ${videoZoomMode} ${showVideoFramerate ? 1 : 0}`, "debug");
        }
        const result = await tauriInvoke<{ success: boolean; output?: string; error?: string }>("play_video", {
          request: {
            video_path: `${remotePath}${selectedFileInput}`,
            zoom_mode: videoZoomMode,
            show_framerate: showVideoFramerate ? 1 : 0,
          }
        });
        if (result.success) {
          setVideoControlStatus("playing");
          appendLog(result.output || `开始播放视频: ${selectedFileInput}`, "success");
        } else {
          appendLog(result.error || result.output || "视频播放失败", "error");
        }
        return;
      }

      appendLog(`视频控制 -> ${action === "pause" ? "暂停" : "停止"} ${selectedFileInput}`, "info");
      if (debugMode) {
        appendLog(`DEBUG CMD -> adb shell ${action === "pause" ? 'echo > /dev/shm/pause_signal' : 'echo > /dev/shm/stop_signal'}`, "debug");
      }
      const result = await tauriInvoke<{ success: boolean; output?: string; error?: string }>("send_video_control", {
        request: { action }
      });
      if (result.success) {
        setVideoControlStatus(action === "pause" ? "paused" : "idle");
        appendLog(result.output || `视频${action === "pause" ? "暂停" : "停止"}成功`, "success");
      } else {
        appendLog(result.error || result.output || `视频${action === "pause" ? "暂停" : "停止"}失败`, "error");
      }
    } catch (err) {
      appendLog(`视频控制异常: ${String(err)}`, "error");
    } finally {
      setIsCheckingVideoPlayback(false);
      setIsSwitchingVideoPlayback(false);
    }
  };

  // 循环播放图片
  const handleLoopImages = async () => {
    if (!isConnected) {
      appendLog("请先连接 ADB 设备", "warning");
      return;
    }
    appendLog("循环播放图片脚本生成中...", "info");
    try {
      const result = await tauriInvoke<{ success: boolean; output?: string; error?: string }>("setup_loop_images", {
        request: { image_path: FILE_TYPE_CONFIG.image.path }
      });
      if (result.success) {
        appendLog(result.output || "循环播放图片脚本推送完成并运行！", "success");
      } else {
        appendLog(result.error || result.output || "设置循环播放失败", "error");
      }
    } catch (err) {
      appendLog(`设置循环播放异常: ${String(err)}`, "error");
    }
  };

  const isResolutionMatched = (item: LocalImageEntry) => {
    if (!currentResolution || !item.width || !item.height) return false;
    return item.width === currentResolution.width && item.height === currentResolution.height;
  };

  const handleImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const readImageSize = (file: File) =>
      new Promise<{ width?: number; height?: number; previewUrl?: string }>((resolve) => {
        const previewUrl = URL.createObjectURL(file);
        const img = new window.Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight, previewUrl });
        img.onerror = () => resolve({ previewUrl });
        img.src = previewUrl;
      });

    try {
      const entries = (await Promise.all(files.map(async (file, index) => {
        const rawPath = (file as File & { path?: string }).path;
        const ext = getFileExtension(file.name);
        if (!IMAGE_EXTENSIONS.has(ext)) return null;
        const info = await readImageSize(file);
        return {
          id: `${file.name}-${index}`,
          name: file.name,
          path: rawPath || file.name,
          realPath: rawPath,
          file,
          ext,
          width: info.width,
          height: info.height,
          lastModified: file.lastModified,
          previewUrl: info.previewUrl,
        } as LocalImageEntry;
      }))).filter((item): item is LocalImageEntry => item !== null);

      if (entries.length === 0) {
        showMessage("error", "未识别到可用 BMP 图片");
        return;
      }

      setFolderImageEntries((prev) => {
        prev.forEach((item) => {
          if (item.previewUrl) {
            URL.revokeObjectURL(item.previewUrl);
          }
        });
        return entries;
      });
      setImagePath(entries[0]?.path || "");
      setImageSearch("");
      showMessage("success", `已载入图片，共 ${entries.length} 张`);
    } catch (err) {
      showMessage("error", `载入图片失败: ${String(err)}`);
    } finally {
      event.target.value = "";
    }
  };

  const filteredFolderImages = useMemo(() => {
    const keyword = imageSearch.trim().toLowerCase();
    let next = folderImageEntries.filter((item) => {
      if (keyword && !item.name.toLowerCase().includes(keyword)) return false;
      if (resolutionFilterEnabled) {
        if (!currentResolution || !item.width || !item.height) return false;
        return item.width === currentResolution.width && item.height === currentResolution.height;
      }
      return true;
    });

    next = [...next].sort((a, b) => {
      if (sortMode === "mtime") {
        return (b.lastModified || 0) - (a.lastModified || 0) || a.name.localeCompare(b.name, "zh-CN", { numeric: true, sensitivity: "base" });
      }
      return a.name.localeCompare(b.name, "zh-CN", { numeric: true, sensitivity: "base" });
    });

    return next;
  }, [folderImageEntries, imageSearch, resolutionFilterEnabled, currentResolution, sortMode]);

  const currentImage = folderImageEntries.find((item) => item.path === imagePath);
  const displayFullPath = currentImage?.realPath || currentImage?.path || "";
  const hasWorkspaceSelection = selectedFileInput.trim().length > 0;
  const isScriptWorkspaceActive = fileType === "script";
  const isVideoWorkspaceActive = fileType === "video";
  const canVideoPlay = isConnected && isVideoWorkspaceActive && hasWorkspaceSelection && !isCheckingVideoPlayback && !isSwitchingVideoPlayback;
  const canVideoPause = isConnected && isVideoWorkspaceActive && hasWorkspaceSelection && videoControlStatus === "playing" && !isCheckingVideoPlayback && !isSwitchingVideoPlayback;
  const canVideoStop = isConnected && isVideoWorkspaceActive && hasWorkspaceSelection && videoControlStatus !== "idle" && !isCheckingVideoPlayback && !isSwitchingVideoPlayback;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        <button onClick={() => setActiveSubTab("image")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeSubTab === "image" ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
          <Image className="w-4 h-4" /> BMP显示
        </button>
        <button onClick={() => setActiveSubTab("pattern")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeSubTab === "pattern" ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
          <Palette className="w-4 h-4" /> 测试图案
        </button>
        <button onClick={() => setActiveSubTab("video")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeSubTab === "video" ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
          <Film className="w-4 h-4" /> DEMO 设置
        </button>
      </div>

      {activeSubTab === "image" && (
        <div className="space-y-4">
          <div className="panel">
            <div className="panel-header flex items-center gap-2">
              <FolderOpen className="w-4 h-4" /> 本地 BMP 上屏
            </div>
            <div className="panel-body space-y-4">
              <input ref={fileInputRef} type="file" accept=".bmp,image/bmp" multiple className="hidden" onChange={handleImageSelected} />

              <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
                <div className="space-y-4 min-w-0">
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">步骤 1：选择 BMP</div>
                      <button onClick={handleChooseImage} className="btn-secondary flex items-center gap-2 shrink-0"><Image className="w-4 h-4" /> 选择 BMP</button>
                    </div>
                    <div>
                      <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">当前图片完整路径</label>
                      <input value={displayFullPath} readOnly className="input text-sm w-full" placeholder="先选择一个或多个 BMP 文件" title={displayFullPath} />
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 overflow-hidden">
                    <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                          <Image className="w-4 h-4" /> 步骤 2：选择 BMP
                          <span className="text-xs text-gray-400">共 {folderImageEntries.length} 张，当前显示 {filteredFolderImages.length} 张</span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{currentResolution ? `当前设备：${currentResolution.label}` : "当前设备分辨率未读取"}</div>
                      </div>

                      <div className="grid grid-cols-[minmax(0,1fr)_180px_180px] gap-3 items-center">
                        <div className="relative min-w-0">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input value={imageSearch} onChange={(e) => setImageSearch(e.target.value)} className="input text-sm pl-9" placeholder="搜索文件名" />
                        </div>
                        <select value={sortMode} onChange={(e) => setSortMode(e.target.value as ImageSortMode)} className="input text-sm">
                          <option value="name">按文件名</option>
                          <option value="mtime">按修改时间</option>
                        </select>
                        <select value={viewMode} onChange={(e) => setViewMode(e.target.value as ImageViewMode)} className="input text-sm">
                          <option value="grid">预览网格</option>
                          <option value="list">紧凑列表</option>
                        </select>
                      </div>

                      <label className={`inline-flex items-center gap-2 text-sm ${currentResolution ? "text-gray-700 dark:text-gray-200" : "text-gray-400 cursor-not-allowed"}`}>
                        <input type="checkbox" checked={resolutionFilterEnabled} disabled={!currentResolution} onChange={(e) => setResolutionFilterEnabled(e.target.checked)} />
                        适配分辨率
                      </label>
                    </div>

                    <div className="max-h-[520px] overflow-auto p-3">
                      {folderImageEntries.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">先点击“选择 BMP”，把需要上屏测试的 BMP 文件载入列表。</div>
                      ) : filteredFolderImages.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">当前筛选条件下没有匹配图片。</div>
                      ) : viewMode === "grid" ? (
                        <div className="grid grid-cols-3 gap-3">
                          {filteredFolderImages.map((item) => {
                            const selected = item.path === imagePath;
                            const matched = isResolutionMatched(item);
                            return (
                              <button key={item.id} onClick={() => setImagePath(item.path)} onDoubleClick={() => { setImagePath(item.path); void handleDisplayImage(item.path); }} className={`group text-left rounded-xl border transition-all overflow-hidden ${selected ? "border-primary-500 ring-2 ring-primary-300/60 dark:ring-primary-700/40 bg-primary-50/70 dark:bg-primary-900/20" : matched ? "border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-900/30 hover:border-emerald-400 dark:hover:border-emerald-600" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 hover:border-primary-300 dark:hover:border-primary-700"}`} title={item.path}>
                                <div className="h-28 flex items-center justify-center bg-gradient-to-br from-gray-100 via-white to-gray-200 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 relative overflow-hidden">
                                  {item.previewUrl ? <img src={item.previewUrl} alt={item.name} className="w-full h-full object-cover" /> : <Image className="w-8 h-8 text-gray-400" />}
                                  {selected && <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center shadow-sm"><Check className="w-3 h-3" /></div>}
                                </div>
                                <div className="p-2.5 space-y-1.5">
                                  <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{item.name}</div>
                                  <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400">
                                    <span className="uppercase tracking-wide">{item.ext.replace(".", "")}</span>
                                    <span>{item.width && item.height ? `${item.width}×${item.height}` : "未读取尺寸"}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${matched ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>{matched ? "适配分辨率" : "未适配"}</span>
                                    <span className="text-[11px] text-gray-400">双击可直接显示</span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredFolderImages.map((item) => {
                            const selected = item.path === imagePath;
                            const matched = isResolutionMatched(item);
                            return (
                              <button key={item.id} onClick={() => setImagePath(item.path)} onDoubleClick={() => { setImagePath(item.path); void handleDisplayImage(item.path); }} className={`w-full text-left rounded-xl border px-3 py-2 transition-all ${selected ? "border-primary-500 ring-2 ring-primary-300/60 dark:ring-primary-700/40 bg-primary-50/70 dark:bg-primary-900/20" : matched ? "border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-900/30 hover:border-emerald-400 dark:hover:border-emerald-600" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 hover:border-primary-300 dark:hover:border-primary-700"}`} title={item.path}>
                                <div className="grid grid-cols-[minmax(0,1fr)_120px_90px_110px] gap-3 items-center">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2"><span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{item.name}</span>{selected && <Check className="w-4 h-4 text-primary-600 shrink-0" />}</div>
                                    <div className="text-[11px] text-gray-400 truncate">{item.path}</div>
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 text-center">{item.width && item.height ? `${item.width} × ${item.height}` : "未读取尺寸"}</div>
                                  <div className="text-xs uppercase tracking-wide text-gray-400 text-center">{item.ext.replace(".", "")}</div>
                                  <div className="text-center"><span className={`text-[11px] px-2 py-0.5 rounded-full ${matched ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>{matched ? "适配分辨率" : "未适配"}</span></div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">远端 BMP 列表</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">读取 `/vismm/fbshow/bmp_online/` 目录，双击文件直接调用 fbShowBmp 显示。</div>
                      </div>
                      <button
                        onClick={() => void handleLoadRemoteBmpFiles()}
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
                                    onClick={() => setSelectedRemoteBmp(file)}
                                    onDoubleClick={() => void handleDisplayRemoteBmp(file)}
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
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">说明</div>
            <div className="panel-body text-sm space-y-2 text-gray-600 dark:text-gray-300">
              <p>· 步骤 1 选择本地 BMP 后，会把本次选中的 BMP 文件载入步骤 2 列表</p>
              <p>· 在步骤 2 双击本地 BMP，会重新推送到 `/vismm/fbshow/bmp_online/` 后再显示</p>
              <p>· 右侧可读取板端 `/vismm/fbshow/bmp_online/` 目录；双击任意远端 BMP 可直接显示</p>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "pattern" && (
        <div className="space-y-5">
          <div className="flex justify-end">
            <button onClick={() => runCommand("sync_runtime_patterns", undefined, "sync_runtime_patterns", "同步画面脚本")} disabled={loading === "sync_runtime_patterns" || !isConnected} className="btn-secondary text-sm flex items-center gap-2">
              <Upload className="w-4 h-4" /> {loading === "sync_runtime_patterns" ? "同步中..." : "同步画面"}
            </button>
          </div>

          <div className="grid grid-cols-5 gap-4">
            {patternOptions.map((pattern, idx) => (
              <button key={idx} onClick={() => handlePatternDisplay(pattern.color)} disabled={!isConnected} className="panel cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <div className={`h-24 rounded-t-lg ${pattern.bg} flex items-center justify-center`} />
                <div className="p-3 text-center text-sm font-medium">{pattern.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === "video" && (
        <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start">
          {/* DEMO 功能区 */}
          <div className="panel">
            <div className="panel-header flex items-center gap-2">
              <Film className="w-4 h-4" />
              DEMO
            </div>
            <div className="panel-body space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => void handleDemoSetDefaultPattern()}
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
                  onClick={() => void handleLoopImages()}
                  disabled={!isConnected}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 px-4 py-4 text-left transition-colors hover:border-primary-300 dark:hover:border-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                      <Image className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">循环播放图片</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">设置开机循环播放图片</div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => void handleVideoPlay()}
                  disabled={!isConnected}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 px-4 py-4 text-left transition-colors hover:border-primary-300 dark:hover:border-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                      <Video className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">视频播放</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">按 C# default_movie 流程设置</div>
                    </div>
                  </div>
                </button>
              </div>

            </div>
          </div>

          <WorkspaceFilePanel
            isConnected={isConnected}
            fileType={fileType}
            onFileTypeChange={handleFileTypeChange}
            remotePath={remotePath}
            onRemotePathChange={setRemotePath}
            selectedFileInput={selectedFileInput}
            onSelectedFileInputChange={setSelectedFileInput}
            remoteFileList={remoteFileList}
            onSelectRemoteFile={setSelectedFileInput}
            isLoadingFiles={isLoadingFiles}
            onLoadFiles={() => void handleListRemoteFiles()}
            isUploading={isUploading}
            onUploadFile={() => void handleUploadFile()}
            isScriptWorkspaceActive={isScriptWorkspaceActive}
            isVideoWorkspaceActive={isVideoWorkspaceActive}
            hasWorkspaceSelection={hasWorkspaceSelection}
            isScriptRunning={isScriptRunning}
            onRunScript={() => void handleRunScript()}
            onDeleteFile={() => void handleDeleteFile()}
            onSetAutorun={() => void handleSetAutorun()}
            videoControlStatus={videoControlStatus}
            isCheckingVideoPlayback={isCheckingVideoPlayback}
            videoZoomMode={videoZoomMode}
            showVideoFramerate={showVideoFramerate}
            canVideoPlay={canVideoPlay}
            canVideoPause={canVideoPause}
            canVideoStop={canVideoStop}
            onVideoZoomModeChange={setVideoZoomMode}
            onShowVideoFramerateChange={setShowVideoFramerate}
            onVideoAction={(action) => void handleVideoWorkspaceControl(action)}
          />
        </div>
      )}
    </div>
  );
}
