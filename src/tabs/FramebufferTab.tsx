import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Image,
  Play,
  Square,
  Monitor,
  Palette,
  Film,
  Trash2,
  FolderOpen,
  Plus,
  Loader2,
  Sparkles,
  Type,
  PanelTop,
  Send,
  ScanSearch,
} from "lucide-react";
import { useConnection } from "../App";
import { tauriInvoke } from "../utils/tauri";

interface PatternResult {
  success: boolean;
  message: string;
  error?: string;
}

export default function FramebufferTab() {
  const { connection, appendLog, debugMode } = useConnection();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"image" | "pattern" | "video">("pattern");
  const [images] = useState<string[]>(["test_pattern_1.bmp", "test_pattern_2.bmp", "gradient.bmp", "color_bar.bmp"]);
  const [loading, setLoading] = useState<string | null>(null);
  const [customText, setCustomText] = useState("电子设计部");
  const [customSubtitle, setCustomSubtitle] = useState("Big8K Custom Text");
  const [disconnectedLogged, setDisconnectedLogged] = useState(false);
  const [textStyle, setTextStyle] = useState<"clean" | "poster">("clean");
  const [imagePath, setImagePath] = useState("");

  const isConnected = connection.connected && connection.type === "adb";

  useEffect(() => {
    if (!isConnected && !disconnectedLogged) {
      appendLog("连接状态 -> 未连接 ADB 设备，显示画面功能当前不可用", "warning");
      setDisconnectedLogged(true);
    }
    if (isConnected && disconnectedLogged) {
      setDisconnectedLogged(false);
    }
  }, [isConnected, disconnectedLogged, appendLog]);

  const showMessage = (type: "success" | "error", text: string) => {
    appendLog(text, type === "success" ? "success" : "error");
  };

  const runCommand = async (cmd: string, args?: Record<string, unknown>, loadingKey?: string, actionLabel?: string) => {
    if (!isConnected) {
      showMessage("error", "连接检查 -> 未连接 ADB 设备，请先在右侧完成连接");
      return;
    }

    const effectiveKey = loadingKey || cmd;
    const effectiveLabel = actionLabel || cmd;
    appendLog(`任务开始 -> ${effectiveLabel}`, "info");
    if (debugMode) {
      if (cmd === "sync_runtime_patterns") {
        appendLog("-> adb shell mkdir -p /vismm/fbshow/big8k_runtime", "debug");
        appendLog("-> adb push python/runtime_fbshow/render_patterns.py /vismm/fbshow/big8k_runtime/render_patterns.py", "debug");
        appendLog("-> adb shell chmod 755 /vismm/fbshow/big8k_runtime/render_patterns.py", "debug");
      } else {
        appendLog(`-> invoke ${cmd}`, "debug");
      }
    }
    setLoading(effectiveKey);
    try {
      const result = await tauriInvoke<PatternResult>(cmd, args);
      if (result.success) {
        showMessage("success", `执行完成 -> ${effectiveLabel}`);
      } else {
        showMessage("error", result.error || result.message || `执行失败 -> ${effectiveLabel}`);
      }
    } catch (err) {
      showMessage("error", `${effectiveLabel}异常: ${String(err)}`);
    } finally {
      setLoading(null);
    }
  };

  const handlePatternDisplay = async (pattern: string) => {
    if (!isConnected) {
      showMessage("error", "连接检查 -> 未连接 ADB 设备，请先在右侧完成连接");
      return;
    }

    const patternLabels: Record<string, string> = {
      pure_red: "纯红",
      pure_green: "纯绿",
      pure_blue: "纯蓝",
      pure_black: "纯黑",
      pure_white: "纯白",
      gray_gradient: "灰阶渐变",
      red_gradient: "红渐变",
      green_gradient: "绿渐变",
      blue_gradient: "蓝渐变",
      h_gradient_1: "横向渐变 1",
      h_gradient_2: "横向渐变 2",
      v_gradient_1: "竖向渐变 1",
      v_gradient_2: "竖向渐变 2",
      h_colorbar_gradient_1: "横向彩条渐变 1",
      h_colorbar_gradient_2: "横向彩条渐变 2",
      v_colorbar_gradient_1: "竖向彩条渐变 1",
      v_colorbar_gradient_2: "竖向彩条渐变 2",
      radial_gray: "放射灰阶",
      color_bar: "彩条",
      checkerboard: "棋盘格",
      logic_34: "炫彩 1",
    };

    const boardCommand = pattern === "logic_34"
      ? "python3 /vismm/fbshow/logicPictureShow.py 34"
      : `python3 /vismm/fbshow/big8k_runtime/render_patterns.py ${pattern}`;

    appendLog(`显示画面 -> ${patternLabels[pattern] || pattern}`, "info");
    if (debugMode) {
      appendLog(`-> adb shell ${boardCommand}`, "debug");
    }
    try {
      let result: PatternResult;

      switch (pattern) {
        case "pure_red":
        case "pure_green":
        case "pure_blue":
        case "pure_white":
        case "pure_black":
        case "gray_gradient":
        case "red_gradient":
        case "green_gradient":
        case "blue_gradient":
        case "h_gradient_1":
        case "h_gradient_2":
        case "v_gradient_1":
        case "v_gradient_2":
        case "h_colorbar_gradient_1":
        case "h_colorbar_gradient_2":
        case "v_colorbar_gradient_1":
        case "v_colorbar_gradient_2":
        case "radial_gray":
        case "color_bar":
        case "checkerboard": {
          result = await tauriInvoke<PatternResult>("run_runtime_pattern", { request: { pattern } });
          break;
        }
        case "logic_34": {
          const logicPattern = Number(pattern.replace("logic_", ""));
          result = await tauriInvoke<PatternResult>("run_logic_pattern", { request: { pattern: logicPattern } });
          break;
        }
        default:
          result = { success: false, message: "", error: "未知图案类型" };
      }

      if (result.success) {
        showMessage("success", `显示完成 -> ${patternLabels[pattern] || pattern}`);
      } else {
        showMessage("error", result.error || result.message || `显示失败 -> ${patternLabels[pattern] || pattern}`);
      }
    } catch (err) {
      showMessage("error", String(err));
    }
  };

  const handleClearScreen = async () => {
    await runCommand("clear_screen", undefined, "clear", "清屏");
  };

  const handleDisplayText = async () => {
    if (debugMode) {
      appendLog(`-> adb push python/fb_text_custom.py /data/local/tmp/fb_text_custom.py`, "debug");
      appendLog(`-> adb shell python3 /data/local/tmp/fb_text_custom.py \"${customText}\" \"${customSubtitle}\" ${textStyle}`, "debug");
    }
    await runCommand(
      "display_text",
      {
        request: {
          text: customText,
          subtitle: customSubtitle,
          style: textStyle,
        },
      },
      "display_text",
      "文字上屏"
    );
  };

  const handleDisplayImage = async () => {
    if (debugMode) {
      appendLog(`-> adb push \"${imagePath}\" /data/local/tmp/selected_image`, "debug");
      appendLog(`-> adb push python/fb_image_display.py /data/local/tmp/fb_image_display.py`, "debug");
      appendLog(`-> adb shell python3 /data/local/tmp/fb_image_display.py /data/local/tmp/selected_image`, "debug");
    }
    await runCommand(
      "display_image",
      {
        request: {
          image_path: imagePath,
        },
      },
      "display_image",
      "图片上屏"
    );
  };

  const handleChooseImage = () => {
    fileInputRef.current?.click();
  };

  const handleImageSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const maybePath = (file as File & { path?: string }).path;
    if (maybePath) {
      setImagePath(maybePath);
      showMessage("success", `已选择图片: ${maybePath}`);
    } else {
      setImagePath(file.name);
      showMessage("error", "当前环境未返回文件完整路径；请在 Tauri 桌面版中使用该功能");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        <button
          onClick={() => setActiveSubTab("image")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeSubTab === "image"
              ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          <Image className="w-4 h-4" />
          图片显示
        </button>
        <button
          onClick={() => setActiveSubTab("pattern")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeSubTab === "pattern"
              ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          <Palette className="w-4 h-4" />
          测试图案
        </button>
        <button
          onClick={() => setActiveSubTab("video")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeSubTab === "video"
              ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          <Film className="w-4 h-4" />
          视频播放
        </button>
      </div>

      {activeSubTab === "image" && (
        <div className="space-y-4">
          <div className="panel">
            <div className="panel-header flex items-center gap-2">
              <Type className="w-4 h-4" />
              自定义文字上屏
            </div>
            <div className="panel-body space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">主文字</label>
                  <input value={customText} onChange={(e) => setCustomText(e.target.value)} className="input text-sm" placeholder="输入要显示的文字" />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">副标题</label>
                  <input value={customSubtitle} onChange={(e) => setCustomSubtitle(e.target.value)} className="input text-sm" placeholder="可选副标题" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <select value={textStyle} onChange={(e) => setTextStyle(e.target.value as "clean" | "poster")} className="input text-sm max-w-[220px]">
                  <option value="clean">简洁风</option>
                  <option value="poster">海报风</option>
                </select>
                <button onClick={handleDisplayText} disabled={!isConnected || loading === "display_text"} className="btn-primary flex items-center gap-2">
                  {loading === "display_text" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  文字上屏
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 panel">
              <div className="panel-header flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                本地图片显示到屏幕
              </div>
              <div className="panel-body space-y-3">
                <input ref={fileInputRef} type="file" accept="image/*,.bmp" className="hidden" onChange={handleImageSelected} />
                <div>
                  <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">图片完整路径</label>
                  <div className="flex gap-2">
                    <input
                      value={imagePath}
                      onChange={(e) => setImagePath(e.target.value)}
                      className="input text-sm flex-1"
                      placeholder="例如：E:\\Resource\\8Big8K\\demo.png"
                    />
                    <button onClick={handleChooseImage} className="btn-secondary flex items-center gap-2">
                      <FolderOpen className="w-4 h-4" />
                      选择文件
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleDisplayImage} disabled={!isConnected || loading === "display_image"} className="btn-primary flex items-center gap-2">
                    {loading === "display_image" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    上传并显示
                  </button>
                  <button onClick={handleClearScreen} disabled={!isConnected || loading === "clear"} className="btn-secondary flex items-center gap-2">
                    {loading === "clear" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                    清屏
                  </button>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">说明</div>
              <div className="panel-body text-sm space-y-2 text-gray-600 dark:text-gray-300">
                <p>· 图片会先通过 ADB 上传到板端</p>
                <p>· 然后自动缩放并居中显示</p>
                <p>· 支持 PNG / JPG / BMP 等常见格式</p>
                <p>· 文字支持简洁风 / 海报风</p>
                <p>· 文件选择器建议在 Tauri 桌面版里使用</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 opacity-70">
            <div className="col-span-2 panel">
              <div className="panel-header flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" />
                  历史图片列表（占位）
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary text-sm flex items-center gap-1 px-3 py-1" disabled>
                    <ScanSearch className="w-3.5 h-3.5" />
                    扫描
                  </button>
                  <button className="btn-danger text-sm flex items-center gap-1 px-3 py-1" disabled>
                    <Trash2 className="w-3.5 h-3.5" />
                    清空
                  </button>
                </div>
              </div>
              <div className="panel-body">
                <div className="grid grid-cols-4 gap-3">
                  {images.map((img, idx) => (
                    <div key={idx} className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center relative overflow-hidden">
                      <Image className="w-8 h-8 text-gray-400" />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">{img}</div>
                    </div>
                  ))}
                  <div className="aspect-video border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center cursor-not-allowed opacity-60">
                    <Plus className="w-8 h-8 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">预览占位</div>
              <div className="panel-body">
                <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <Monitor className="w-12 h-12 text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "pattern" && (
        <div className="space-y-5">
          <div className="panel">
            <div className="panel-header flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                实用 Demo
              </div>
              <button
                onClick={() => runCommand("sync_runtime_patterns", undefined, "sync_runtime_patterns", "同步画面脚本")}
                disabled={loading === "sync_runtime_patterns" || !isConnected}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {loading === "sync_runtime_patterns" ? "同步中..." : "同步画面"}
              </button>
            </div>
            <div className="panel-body grid grid-cols-3 gap-4">
              {[
                { key: "demo", title: "综合 Demo", desc: "标题 + 彩条 + 灰阶 + 棋盘格", icon: Sparkles, cmd: "run_demo_screen" },
                { key: "text", title: "文字 Demo", desc: "居中大字显示（中文）", icon: Type, cmd: "run_text_demo" },
                { key: "poster", title: "海报风 Demo", desc: "大字海报 + 发光效果", icon: PanelTop, cmd: "run_poster_demo" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => runCommand(item.cmd, undefined, item.key)}
                    disabled={!isConnected}
                    className="text-left panel hover:ring-2 hover:ring-primary-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="panel-body space-y-3">
                      <div className="flex items-center justify-between">
                        <Icon className="w-6 h-6 text-primary-600" />
                      </div>
                      <div className="font-semibold text-base">{item.title}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-5 gap-4">
            {[
              { name: "横向渐变 1", color: "h_gradient_1", bg: "bg-gradient-to-r from-black via-gray-400 to-white" },
              { name: "横向渐变 2", color: "h_gradient_2", bg: "bg-gradient-to-r from-white via-gray-400 to-black" },
              { name: "竖向渐变 1", color: "v_gradient_1", bg: "bg-gradient-to-b from-black to-white" },
              { name: "竖向渐变 2", color: "v_gradient_2", bg: "bg-gradient-to-b from-white to-black" },
              { name: "放射灰阶", color: "radial_gray", bg: "bg-radial-[at_center] from-white via-gray-400 to-black" },
              { name: "棋盘格", color: "checkerboard", bg: "bg-[linear-gradient(45deg,#111_25%,#fff_25%,#fff_50%,#111_50%,#111_75%,#fff_75%,#fff_100%)] bg-[length:24px_24px]" },
              { name: "炫彩 1", color: "logic_34", bg: "bg-gradient-to-r from-red-500 via-yellow-400 via-green-400 via-cyan-400 via-blue-500 via-pink-500 to-red-500" },
              { name: "横向彩条渐变 1", color: "h_colorbar_gradient_1", bg: "bg-gradient-to-r from-blue-500 via-green-500 to-red-500" },
              { name: "横向彩条渐变 2", color: "h_colorbar_gradient_2", bg: "bg-gradient-to-r from-red-500 via-green-500 to-blue-500" },
              { name: "竖向彩条渐变 1", color: "v_colorbar_gradient_1", bg: "bg-gradient-to-b from-blue-500 via-green-500 to-red-500" },
              { name: "竖向彩条渐变 2", color: "v_colorbar_gradient_2", bg: "bg-gradient-to-b from-red-500 via-green-500 to-blue-500" },
              { name: "红渐变", color: "red_gradient", bg: "bg-gradient-to-r from-black to-red-600" },
              { name: "绿渐变", color: "green_gradient", bg: "bg-gradient-to-r from-black to-green-600" },
              { name: "蓝渐变", color: "blue_gradient", bg: "bg-gradient-to-r from-black to-blue-600" },
              { name: "彩条", color: "color_bar", bg: "bg-[linear-gradient(to_right,#ffffff_0%,#ffffff_12.5%,#ffff00_12.5%,#ffff00_25%,#00ffff_25%,#00ffff_37.5%,#00ff00_37.5%,#00ff00_50%,#ff00ff_50%,#ff00ff_62.5%,#0000ff_62.5%,#0000ff_75%,#ff0000_75%,#ff0000_87.5%,#000000_87.5%,#000000_100%)]" },
              { name: "纯红", color: "pure_red", bg: "bg-red-500" },
              { name: "纯绿", color: "pure_green", bg: "bg-green-500" },
              { name: "纯蓝", color: "pure_blue", bg: "bg-blue-500" },
              { name: "纯黑", color: "pure_black", bg: "bg-black" },
              { name: "纯白", color: "pure_white", bg: "bg-white border" },
            ].map((pattern, idx) => (
              <button
                key={idx}
                onClick={() => handlePatternDisplay(pattern.color)}
                disabled={!isConnected}
                className="panel cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className={`h-24 rounded-t-lg ${pattern.bg} flex items-center justify-center`}>
                </div>
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
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <Film className="w-8 h-8 text-primary-600" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{video}</div>
                      <div className="text-xs text-gray-500">1920×1080, 30fps</div>
                    </div>
                    <Play className="w-5 h-5 text-gray-400" />
                  </div>
                ))}
              </div>
              <button className="w-full mt-4 btn-secondary flex items-center justify-center gap-2 disabled:opacity-50" disabled>
                <Upload className="w-4 h-4" />
                上传视频
              </button>
            </div>
          </div>
          <div className="panel">
            <div className="panel-header">播放控制</div>
            <div className="panel-body space-y-3">
              <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <Film className="w-12 h-12 text-gray-400" />
              </div>
              <div className="flex gap-2">
                <button className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50" disabled>
                  <Play className="w-4 h-4" />
                  播放
                </button>
                <button className="flex-1 btn-secondary flex items-center justify-center gap-2 disabled:opacity-50" disabled>
                  <Square className="w-4 h-4" />
                  停止
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
