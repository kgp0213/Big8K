import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  Image,
  Play,
  Monitor,
  Palette,
  Film,
  Loader2,
  FolderOpen,
  Search,
  Check,
} from "lucide-react";
import { useConnection } from "../App";
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

let imagePanelCache: {
  entries: LocalImageEntry[];
  imagePath: string;
  imageSearch: string;
  resolutionFilterEnabled: boolean;
  sortMode: ImageSortMode;
  viewMode: ImageViewMode;
  uploadedImageMap: Record<string, string>;
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
  const [uploadedImageMap, setUploadedImageMap] = useState<Record<string, string>>(imagePanelCache?.uploadedImageMap || {});
  const [disconnectedLogged, setDisconnectedLogged] = useState(false);

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
      uploadedImageMap,
    };
  }, [folderImageEntries, imagePath, imageSearch, resolutionFilterEnabled, sortMode, viewMode, uploadedImageMap]);

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
    const cacheKey = selectedEntry?.realPath || selectedEntry?.path || requestedPath;
    const remoteFileName = `${cacheKey.replace(/[^a-zA-Z0-9._-]/g, "_")}.png`;
    const remotePath = `/data/local/tmp/big8k_images/${remoteFileName}`;
    const cachedRemote = uploadedImageMap[cacheKey];

    if (cachedRemote) {
      appendLog(`显示图片 -> ${selectedEntry?.name || pathToUse.split(/[\\/]/).pop() || pathToUse}`, "info");
      if (debugMode) appendLog(`-> adb shell python3 /data/local/tmp/fb_image_display.py ${cachedRemote}`, "debug");
      await runCommand("display_remote_image", { remoteImagePath: cachedRemote }, "display_image", "图片上屏（缓存）");
      return;
    }

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
          setUploadedImageMap((prev) => ({ ...prev, [cacheKey]: remotePath }));
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
      setUploadedImageMap((prev) => ({ ...prev, [cacheKey]: remotePath }));
    }
  };

  const handleChooseImage = () => fileInputRef.current?.click();

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
  const currentImageMatched = currentImage ? isResolutionMatched(currentImage) : false;
  const displayFullPath = currentImage?.realPath || currentImage?.path || "";

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
          <Film className="w-4 h-4" /> 视频播放
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
                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">步骤 3：确认并显示</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">当前选中的图片会显示在这里，确认后上屏。</div>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">老手可直接双击左侧图片快速上屏</span>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="aspect-video rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                        {currentImage?.previewUrl ? <img src={currentImage.previewUrl} alt={currentImage.name} className="w-full h-full object-contain bg-black/5" /> : <Monitor className="w-12 h-12 text-gray-400" />}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">即将上屏的图片</div>
                          <input value={imagePath} onChange={(e) => setImagePath(e.target.value)} className="input text-sm" placeholder="从左侧图片列表中选择，或手动输入完整路径" />
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50/60 dark:bg-gray-800/40">
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">文件名</div>
                            <div className="mt-1 font-medium text-gray-800 dark:text-gray-100 break-all">{currentImage?.name || "尚未选择图片"}</div>
                          </div>
                          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50/60 dark:bg-gray-800/40">
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">分辨率</div>
                            <div className="mt-1 font-medium text-gray-800 dark:text-gray-100">{currentImage?.width && currentImage?.height ? `${currentImage.width} × ${currentImage.height}` : "未读取尺寸"}</div>
                          </div>
                          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50/60 dark:bg-gray-800/40">
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">当前设备</div>
                            <div className="mt-1 font-medium text-gray-800 dark:text-gray-100">{currentResolution ? currentResolution.label : "未读取分辨率"}</div>
                          </div>
                          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50/60 dark:bg-gray-800/40">
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">上屏状态</div>
                            <div className="mt-1"><span className={`text-[11px] px-2 py-1 rounded-full ${currentImage ? (currentImageMatched ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300") : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>{currentImage ? (currentImageMatched ? "适配分辨率" : "未适配" ) : "待选择图片"}</span></div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <button onClick={() => void handleDisplayImage()} disabled={!isConnected || loading === "display_image" || !imagePath.trim()} className="btn-primary flex items-center justify-center gap-2">
                          {loading === "display_image" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} 显示到屏幕
                        </button>
                      </div>

                      <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-3 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                        <div>· 当前仅支持 BMP 图片上屏</div>
                        <div>· 适配分辨率表示与当前设备分辨率完全一致</div>
                        <div>· 图片显示时不缩放，只做屏幕居中；四周不加白边</div>
                        <div>· 同一张已发送图片再次显示时，不会重复上传</div>
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
              <p>· 选择 BMP 后，会把本次选中的 BMP 文件载入列表中供预览和上屏</p>
              <p>· 顶部路径框显示当前选中图片的完整路径</p>
              <p>· 图片首次显示会发送到板端；再次显示同一张图时直接复用板端缓存</p>
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
        <div className="grid grid-cols-2 gap-4">
          <div className="panel">
            <div className="panel-header">视频列表</div>
            <div className="panel-body">
              <div className="space-y-2">
                {["demo_video.mp4", "test_video.avi"].map((video, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                    <Film className="w-8 h-8 text-primary-600" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{video}</div>
                      <div className="text-xs text-gray-500">1920×1080, 30fps</div>
                    </div>
                    <Play className="w-5 h-5 text-gray-400" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-header">视频控制</div>
            <div className="panel-body space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <p>视频播放相关功能待后续接入。</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
