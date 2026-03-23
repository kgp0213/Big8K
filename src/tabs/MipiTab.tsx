import { useMemo, useState } from "react";
import {
  Play,
  FolderOpen,
  FileCode,
  Monitor,
  Upload,
  Download,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { useConnection } from "../App";
import { tauriInvoke } from "../utils/tauri";

interface TimingConfig {
  hact: number;
  vact: number;
  pclk: number;
  hfp: number;
  hbp: number;
  hsync: number;
  vfp: number;
  vbp: number;
  vsync: number;
  hsPolarity: boolean;
  vsPolarity: boolean;
  dePolarity: boolean;
  clkPolarity: boolean;
  interfaceType: string;
  mipiMode: string;
  videoType: string;
  lanes: number;
  format: string;
  phyMode: string;
  dscEnable: boolean;
  dscVersion: string;
  sliceWidth: number;
  sliceHeight: number;
  scramblingEnable: boolean;
  dualChannel: boolean;
}

interface PatternResult {
  success: boolean;
  message?: string;
  error?: string;
}

interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
}

interface ReadStatusResult {
  success: boolean;
  output?: string;
  error?: string;
}

const defaultTiming: TimingConfig = {
  hact: 3036,
  vact: 1952,
  pclk: 150560,
  hfp: 200,
  hbp: 36,
  hsync: 2,
  vfp: 62,
  vbp: 36,
  vsync: 2,
  hsPolarity: true,
  vsPolarity: true,
  dePolarity: true,
  clkPolarity: true,
  interfaceType: "MIPI",
  mipiMode: "Video",
  videoType: "NON_BURST_SYNC_PULSES",
  lanes: 4,
  format: "RGB888",
  phyMode: "DPHY",
  dscEnable: true,
  dscVersion: "Ver1.1",
  sliceWidth: 1518,
  sliceHeight: 8,
  scramblingEnable: false,
  dualChannel: false,
};

const grayButtons = [16, 32, 64, 128, 192, 224];

const logicPatternOptions = [
  { value: 0, label: "0 - 垂直 ColorBar" },
  { value: 1, label: "1 - 水平 ColorBar" },
  { value: 2, label: "2 - 横向 256 渐变 1" },
  { value: 3, label: "3 - 横向 256 渐变 2" },
  { value: 4, label: "4 - 竖向 256 渐变 1" },
  { value: 5, label: "5 - 竖向 256 渐变 2" },
  { value: 6, label: "6 - 横向 ColorBar + 256 渐变 1" },
  { value: 7, label: "7 - 横向 ColorBar + 256 渐变 2" },
  { value: 8, label: "8 - 竖向 ColorBar + 256 渐变 1" },
  { value: 9, label: "9 - 竖向 ColorBar + 256 渐变 2" },
  { value: 10, label: "10 - 黑底白边框" },
  { value: 11, label: "11 - Crosstalk 1" },
  { value: 12, label: "12 - Crosstalk 2" },
  { value: 13, label: "13 - Crosstalk 3" },
  { value: 14, label: "14 - Crosstalk 4" },
  { value: 15, label: "15 - 1Dot Inversion" },
  { value: 16, label: "16 - 棋盘格 1" },
  { value: 17, label: "17 - 棋盘格 2" },
  { value: 18, label: "18 - 棋盘格 3" },
  { value: 19, label: "19 - 棋盘格 4" },
  { value: 20, label: "20 - 蓝 256 渐变" },
  { value: 21, label: "21 - 绿 256 渐变" },
  { value: 22, label: "22 - 红 256 渐变" },
  { value: 23, label: "23 - 正方向 F 字" },
  { value: 24, label: "24 - 线条" },
  { value: 25, label: "25 - 圆形" },
  { value: 26, label: "26 - 放射灰阶" },
  { value: 27, label: "27 - 255 灰阶" },
  { value: 28, label: "28 - 128 灰阶" },
  { value: 29, label: "29 - 64 灰阶" },
  { value: 30, label: "30 - 32 灰阶" },
  { value: 31, label: "31 - 16 灰阶" },
  { value: 32, label: "32 - 黑屏" },
  { value: 33, label: "33 - 单黑线" },
  { value: 34, label: "34 - 炫彩 1" },
  { value: 35, label: "35 - 炫彩 2" },
  { value: 36, label: "36 - 炫彩 3" },
  { value: 37, label: "37 - 炫彩 4" },
  { value: 38, label: "38 - 黑白 1" },
  { value: 39, label: "39 - 255 灰阶（备用）" },
];

export default function MipiTab() {
  const { appendLog, debugMode } = useConnection();
  const [driverCode, setDriverCode] = useState<string[]>([
    "05 00 01 28",
    "05 00 01 10",
    "39 00 03 F0 5A 5A",
    "39 00 03 F1 5A 5A",
    "29 00 02 35 00",
    "05 00 01 11",
    "05 00 01 29",
  ]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [editValue, setEditValue] = useState("");
  const [driverCodeText, setDriverCodeText] = useState([
    "05 00 01 28",
    "05 00 01 10",
    "39 00 03 F0 5A 5A",
    "39 00 03 F1 5A 5A",
    "29 00 02 35 00",
    "05 00 01 11",
    "05 00 01 29",
  ].join("\n"));
  const [timing, setTiming] = useState<TimingConfig>(defaultTiming);
  const [showBasicSection, setShowBasicSection] = useState(true);
  const [selectedLogicPattern, setSelectedLogicPattern] = useState(0);

  const updateTiming = <K extends keyof TimingConfig>(key: K, value: TimingConfig[K]) => {
    setTiming((prev) => ({ ...prev, [key]: value }));
  };

  const derived = useMemo(() => {
    const htotal = timing.hact + timing.hfp + timing.hbp + timing.hsync;
    const vtotal = timing.vact + timing.vfp + timing.vbp + timing.vsync;
    const fps = htotal > 0 && vtotal > 0 ? (timing.pclk * 1000) / htotal / vtotal : 0;
    return { htotal, vtotal, fps };
  }, [timing]);

  const syncDriverCodeText = (nextDriverCode: string[]) => {
    setDriverCode(nextDriverCode);
    setDriverCodeText(nextDriverCode.join("\n"));
  };

  const parseDriverCodeLines = (text: string) => {
    return text
      .split("\n")
      .map((line) => line.trim().toUpperCase())
      .filter(Boolean);
  };

  const validateDriverCodeLine = (line: string, lineNumber: number) => {
    if (/^\s*\d+\./.test(line)) {
      return `第${lineNumber}行 不能包含行号`;
    }

    if (!/^[0-9A-F\s]+$/.test(line)) {
      return `第${lineNumber}行 存在非法字符，只允许十六进制字符和空格`;
    }

    const normalized = line.replace(/\s+/g, " ").trim();
    const parts = normalized.split(" ");

    if (parts.length < 4) {
      return `第${lineNumber}行 字段数量不足，至少需要 4 个字段`;
    }

    for (const part of parts) {
      if (!/^[0-9A-F]{2}$/.test(part)) {
        return `第${lineNumber}行 字段 ${part} 格式错误`;
      }
    }

    const allowedHeaders = new Set(["05", "39", "29", "0A"]);
    if (!allowedHeaders.has(parts[0])) {
      return `第${lineNumber}行 mipi包头错误，只能是 05 / 39 / 29 / 0A`;
    }

    const declaredCount = parseInt(parts[2], 16);
    const actualCount = parts.length - 3;
    if (declaredCount !== actualCount) {
      return `第${lineNumber}行 长度字段 ${parts[2]} 与后续数据数量不一致，声明 ${declaredCount}，实际 ${actualCount}`;
    }

    return null;
  };

  const formatHexByte = (value: number) => value.toString(16).toUpperCase().padStart(2, "0");

  const normalizeSourceLine = (line: string) => {
    const commentTrimmed = line.replace(/\/\/.*$/, "");
    return commentTrimmed
      .replace(/[，,;；]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const convertRightTextToInitCode = (text: string) => {
    const sourceLines = text.split("\n");
    const convertedLines: string[] = [];

    for (let i = 0; i < sourceLines.length; i += 1) {
      const normalized = normalizeSourceLine(sourceLines[i]);
      if (!normalized) continue;

      const parts = normalized.split(" ").filter(Boolean);
      if (parts.length === 0) continue;

      const keyword = parts[0].toUpperCase();
      const rest = parts.slice(1).map((part) => part.toUpperCase());
      const lineNumber = i + 1;

      const ensureHexFields = (fields: string[]) => {
        for (const field of fields) {
          if (!/^[0-9A-F]{2}$/.test(field)) {
            throw new Error(`第${lineNumber}行 字段 ${field} 格式错误`);
          }
        }
      };

      if (keyword === "DELAY" || keyword === "DELAYMS") {
        if (convertedLines.length === 0) {
          throw new Error(`第${lineNumber}行 delay 不能出现在第一行`);
        }
        if (rest.length < 1) {
          throw new Error(`第${lineNumber}行 delay 缺少延时值`);
        }
        const delayRaw = rest[0];
        if (!/^\d+$/.test(delayRaw)) {
          throw new Error(`第${lineNumber}行 字段 ${delayRaw} 格式错误`);
        }
        const delayValue = Math.min(255, parseInt(delayRaw, 10));
        const previous = convertedLines[convertedLines.length - 1].split(" ");
        previous[1] = formatHexByte(delayValue);
        convertedLines[convertedLines.length - 1] = previous.join(" ");
        continue;
      }

      if (/^(05|39|29|0A)(\s+[0-9A-F]{2})+$/.test(normalized)) {
        const normalizedFields = parts.map((part) => part.toUpperCase());
        const error = validateDriverCodeLine(normalizedFields.join(" "), lineNumber);
        if (error) {
          throw new Error(error);
        }
        convertedLines.push(normalizedFields.join(" "));
        continue;
      }

      if (keyword === "REGW05" || keyword === "REGW29" || keyword === "REGW39" || keyword === "REGW0A") {
        ensureHexFields(rest);
        const header = keyword.replace("REGW", "");
        const count = formatHexByte(rest.length);
        convertedLines.push([header, "00", count, ...rest].join(" "));
        continue;
      }

      const fields = parts.map((part) => part.toUpperCase());
      ensureHexFields(fields);
      const count = formatHexByte(fields.length);
      convertedLines.push(["39", "00", count, ...fields].join(" "));
    }

    return convertedLines;
  };

  const handleRightFormatCheck = () => {
    const value = editValue.trim();
    if (!value) {
      appendLog("右侧文本框没有可检查的内容", "warning");
      return;
    }

    try {
      const converted = convertRightTextToInitCode(value);
      appendLog(`代码检查通过：共 ${converted.length} 行`, "success");
    } catch (error) {
      if (error instanceof Error) {
        appendLog(error.message, "error");
      }
      appendLog("格式检查，共发现 1 处问题", "error");
    }
  };

  const handleFormatConvert = () => {
    const value = editValue.trim();
    if (!value) {
      appendLog("没有可转换的内容", "warning");
      return;
    }

    try {
      const converted = convertRightTextToInitCode(value);
      const normalizedOriginal = parseDriverCodeLines(value).map((line) => line.replace(/\s+/g, " ").trim());
      const convertedText = converted.join("\n");
      setEditValue(convertedText);

      if (normalizedOriginal.join("\n") === convertedText) {
        appendLog(`代码已是目标格式：共 ${converted.length} 行`, "info");
        return;
      }

      appendLog(`已执行格式转换：共 ${converted.length} 行`, "success");
    } catch (error) {
      appendLog(error instanceof Error ? error.message : `格式转换失败: ${String(error)}`, "error");
    }
  };

  const handleFormatCheck = () => {
    const rawLines = driverCodeText.split("\n");
    const nonEmptyLines = rawLines.filter((line) => line.trim() !== "");

    if (nonEmptyLines.length === 0) {
      appendLog("没有可检查的初始化代码", "warning");
      return;
    }

    const errors = nonEmptyLines
      .map((line, index) => validateDriverCodeLine(line.toUpperCase(), index + 1))
      .filter((error): error is string => Boolean(error));

    if (errors.length > 0) {
      errors.forEach((error) => appendLog(error, "error"));
      appendLog(`格式检查，共发现 ${errors.length} 处问题`, "error");
      return;
    }

    const normalizedLines = parseDriverCodeLines(driverCodeText).map((line) => line.replace(/\s+/g, " ").trim());
    syncDriverCodeText(normalizedLines);
    if (normalizedLines.length > 0) {
      const nextIndex = Math.min(selectedIndex, normalizedLines.length - 1);
      setSelectedIndex(nextIndex);
      setEditValue(normalizedLines[nextIndex]);
    }
    appendLog(`代码检查通过：共 ${normalizedLines.length} 行`, "success");
  };

  const handleGenerateConfigDownload = () => {
    appendLog("已触发生成点屏配置下载（UI入口已就位，后续可接真实导出逻辑）", "info");
  };

  const handleMoveLeftToRight = () => {
    const value = driverCodeText.trim();
    if (!value) {
      appendLog("左侧文本框为空，无法转换到右侧", "warning");
      return;
    }

    try {
      const converted = convertRightTextToInitCode(value);
      const convertedText = converted.join("\n");
      setEditValue(convertedText);
      appendLog(`已将左侧内容转换并填充到右侧：共 ${converted.length} 行`, "success");
    } catch (error) {
      appendLog(error instanceof Error ? error.message : `左侧内容转换失败: ${String(error)}`, "error");
    }
  };

  const handleSendAll = async () => {
    const sourceText = editValue.trim();
    if (!sourceText) {
      appendLog("右侧文本框为空，无法代码下发", "warning");
      return;
    }

    try {
      const commands = convertRightTextToInitCode(sourceText);
      if (commands.length === 0) {
        appendLog("右侧文本框没有可下发的代码", "warning");
        return;
      }

      appendLog(`任务开始 -> 初始化代码下发（共 ${commands.length} 行）`, "info");
      if (debugMode) {
        commands.forEach((command) => appendLog(`-> adb shell vismpwr ${command}`, "debug"));
      }
      const result = await tauriInvoke<CommandResult>("mipi_send_commands", { commands });
      if (result.success) {
        appendLog(result.output || `代码下发完成：共 ${commands.length} 行`, "success");
      } else {
        appendLog(result.error || result.output || "代码下发失败", "error");
      }
    } catch (error) {
      appendLog(error instanceof Error ? error.message : `代码下发失败: ${String(error)}`, "error");
    }
  };

  const handleSolidColor = async (color: string, label: string) => {
    appendLog(`显示画面 -> ${label}`, "info");
    if (debugMode) {
      appendLog(`-> adb shell python3 /vismm/fbshow/big8k_runtime/render_patterns.py pure_${color}`, "debug");
    }
    try {
      const result = await tauriInvoke<PatternResult>("run_runtime_pattern", { request: { pattern: `pure_${color}` } });
      if (result.success) {
        appendLog(`显示完成 -> ${label}`, "success");
      } else {
        appendLog(result.error || result.message || `显示失败 -> ${label}`, "error");
      }
    } catch (e) {
      appendLog(`调用失败: ${String(e)}`, "error");
    }
  };

  const handleGray = async (value: number) => {
    appendLog(`显示画面 -> 灰阶 ${value}`, "info");
    if (debugMode) {
      appendLog(`-> adb shell python3 /vismm/fbshow/logicPictureShow.py ${value === 16 ? 31 : value === 32 ? 30 : value === 64 ? 29 : value === 128 ? 28 : 27}`, "debug");
    }
    const patternMap: Record<number, number> = { 16: 31, 32: 30, 64: 29, 128: 28, 192: 27, 224: 27 };
    const pattern = patternMap[value] ?? 27;
    const result = await tauriInvoke<PatternResult>("run_logic_pattern", { request: { pattern } });
    if (result.success) {
      appendLog(`显示完成 -> 灰阶 ${value}`, "success");
    } else {
      appendLog(result.error || result.message || `显示失败 -> 灰阶 ${value}`, "error");
    }
  };

  const handleSleepIn = async () => {
    appendLog("执行关屏序列：28 / 10", "info");
    try {
      const result = await tauriInvoke<CommandResult>("mipi_sleep_in");
      if (result.success) {
        appendLog(result.output || "已执行关屏序列", "success");
      } else {
        appendLog(result.error || result.output || "关屏序列执行失败", "error");
      }
    } catch (e) {
      appendLog(`调用关屏失败: ${String(e)}`, "error");
    }
  };

  const handleSleepOut = async () => {
    appendLog("执行开屏序列：11 / 29", "info");
    try {
      const result = await tauriInvoke<CommandResult>("mipi_sleep_out");
      if (result.success) {
        appendLog(result.output || "已执行开屏序列", "success");
      } else {
        appendLog(result.error || result.output || "开屏序列执行失败", "error");
      }
    } catch (e) {
      appendLog(`调用开屏失败: ${String(e)}`, "error");
    }
  };

  const handleSoftwareReset = async () => {
    appendLog("任务开始 -> Software Reset (01)", "info");
    if (debugMode) {
      appendLog("-> adb shell vismpwr 05 00 01 01", "debug");
    }
    try {
      const result = await tauriInvoke<CommandResult>("mipi_software_reset");
      if (result.success) {
        appendLog(result.output || "已执行 Software Reset (01)", "success");
      } else {
        appendLog(result.error || result.output || "Software Reset 执行失败", "error");
      }
    } catch (e) {
      appendLog(`调用 Software Reset 失败: ${String(e)}`, "error");
    }
  };

  const handleReadStatus = async () => {
    appendLog("读取状态 (0A)", "info");
    try {
      const result = await tauriInvoke<ReadStatusResult>("mipi_read_power_mode");
      if (result.success) {
        appendLog(result.output || "读取状态 (0A) 成功", "success");
      } else {
        appendLog(result.error || result.output || "读取状态 (0A) 失败", "error");
      }
    } catch (e) {
      appendLog(`调用读取状态失败: ${String(e)}`, "error");
    }
  };

  const handleGrayPattern = async () => {
    appendLog("显示画面 -> 灰阶渐变", "info");
    if (debugMode) {
      appendLog("-> adb shell python3 /vismm/fbshow/big8k_runtime/render_patterns.py gray_gradient", "debug");
    }
    try {
      const result = await tauriInvoke<PatternResult>("run_runtime_pattern", { request: { pattern: "gray_gradient" } });
      if (result.success) {
        appendLog("显示完成 -> 灰阶渐变", "success");
      } else {
        appendLog(result.error || result.message || "显示失败 -> 灰阶渐变", "error");
      }
    } catch (e) {
      appendLog(`调用灰阶画面失败: ${String(e)}`, "error");
    }
  };

  const showLogicPattern = async (pattern: number) => {
    const current = logicPatternOptions.find((item) => item.value === pattern);
    appendLog(`显示逻辑图 -> ${current?.label || pattern}`, "info");
    if (debugMode) {
      appendLog(`-> adb shell python3 /vismm/fbshow/logicPictureShow.py ${pattern}`, "debug");
    }
    try {
      const result = await tauriInvoke<PatternResult>("run_logic_pattern", { request: { pattern } });
      if (result.success) {
        appendLog(result.message || `已显示逻辑图案 ${pattern}`, "success");
      } else {
        appendLog(result.error || result.message || `逻辑图案 ${pattern} 显示失败`, "error");
      }
    } catch (e) {
      appendLog(`调用逻辑图案失败: ${String(e)}`, "error");
    }
  };


  const timingField = (label: string, key: keyof TimingConfig, type: "number" | "text" = "number") => (
    <div>
      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={String(timing[key])}
        onChange={(e) => {
          const value = type === "number" ? Number(e.target.value) : e.target.value;
          updateTiming(key, value as TimingConfig[typeof key]);
        }}
        className="input text-sm py-1.5"
      />
    </div>
  );

  const radioOption = <K extends keyof TimingConfig>(key: K, value: string, label: string) => (
    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
      <input type="radio" name={String(key)} checked={String(timing[key]) === value} onChange={() => updateTiming(key, value as TimingConfig[K])} />
      {label}
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="panel">
        <div className="panel-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4" />
            屏参配置（Timing / DSC）
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary text-sm flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              打开最近配置
            </button>
            <button className="btn-secondary text-sm flex items-center gap-2">
              <Download className="w-4 h-4" />
              打开点屏配置
            </button>
            <button className="btn-primary text-sm flex items-center gap-2">
              <Upload className="w-4 h-4" />
              导出点屏配置
            </button>
          </div>
        </div>
        <div className="panel-body space-y-3">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3 bg-white/80 dark:bg-gray-900/20 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
              <div className="font-semibold text-sm text-gray-800 dark:text-gray-100">基础参数</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBasicSection((prev) => !prev)}
                  className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                >
                  {showBasicSection ? "隐藏" : "展开"}
                </button>
                <div className="text-xs text-gray-400">Timing</div>
              </div>
            </div>
            {showBasicSection && (
              <>
                <div className="grid grid-cols-4 gap-3">
                  {timingField("HACT", "hact")}
                  {timingField("HFP", "hfp")}
                  {timingField("HBP", "hbp")}
                  {timingField("HSW", "hsync")}
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {timingField("VACT", "vact")}
                  {timingField("VFP", "vfp")}
                  {timingField("VBP", "vbp")}
                  {timingField("VSW", "vsync")}
                </div>
                <div className="grid grid-cols-6 gap-3">
                  {timingField("PCLK (kHz)", "pclk")}
                  {timingField("Lanes", "lanes")}
                  {timingField("Format", "format", "text")}
                  {timingField("PHY Mode", "phyMode", "text")}
                  <div />
                  <div />
                </div>
                <div className="grid grid-cols-7 gap-3 items-start">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Interface</label>
                    <div className="flex flex-wrap gap-3">{radioOption("interfaceType", "MIPI", "MIPI")}</div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">MIPI Mode</label>
                    <div className="flex flex-col gap-1">
                      {radioOption("mipiMode", "Video", "Video")}
                      {radioOption("mipiMode", "Command", "CMD")}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Video Type</label>
                    <div className="flex flex-col gap-1">
                      {radioOption("videoType", "NON_BURST_SYNC_PULSES", "Sync Pulses")}
                      {radioOption("videoType", "NON_BURST_SYNC_EVENTS", "Sync Events")}
                      {radioOption("videoType", "BURST_MODE", "Burst")}
                    </div>
                  </div>
                  <div className="col-span-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 px-4 py-3 mt-2 max-w-[520px]">
                    <div className="grid grid-cols-3 gap-4 items-start">
                      <div className="flex flex-col gap-2">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={timing.dePolarity} onChange={(e) => updateTiming("dePolarity", e.target.checked)} />
                          DE Pol
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={timing.clkPolarity} onChange={(e) => updateTiming("clkPolarity", e.target.checked)} />
                          CLK Pol
                        </label>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={timing.vsPolarity} onChange={(e) => updateTiming("vsPolarity", e.target.checked)} />
                          VS Pol
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={timing.hsPolarity} onChange={(e) => updateTiming("hsPolarity", e.target.checked)} />
                          HS Pol
                        </label>
                      </div>
                      <div className="flex flex-col gap-2 min-w-[220px]">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={timing.dualChannel} onChange={(e) => updateTiming("dualChannel", e.target.checked)} />
                          Dual Channel
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={timing.scramblingEnable} onChange={(e) => updateTiming("scramblingEnable", e.target.checked)} />
                          Scrambling
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 pt-6 min-w-[140px]">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={timing.dscEnable} onChange={(e) => updateTiming("dscEnable", e.target.checked)} />
                      启用DSC
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3 text-sm font-medium text-gray-800 dark:text-gray-100 bg-gray-100 dark:bg-gray-800/70 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700">
                  <div>HTotal: {derived.htotal}</div>
                  <div>VTotal: {derived.vtotal}</div>
                  <div>FPS: {derived.fps.toFixed(2)}</div>
                  <div>Resolution: {timing.hact} × {timing.vact}</div>
                </div>
              </>
            )}
          </div>

          {showBasicSection && timing.dscEnable && (
            <div className="panel">
              <div className="panel-header">VESA DSC</div>
              <div className="panel-body grid grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">DSC Version</label>
                  <div className="flex items-center gap-4 h-[38px]">
                    {radioOption("dscVersion", "Ver1.1", "Ver1.1")}
                    {radioOption("dscVersion", "Vesa1.2", "Ver1.2")}
                  </div>
                </div>
                {timingField("Slice Width", "sliceWidth")}
                {timingField("Slice Height", "sliceHeight")}
              </div>
            </div>
          )}

          <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-4 items-start max-w-[1180px]">
            <div className="panel">
            <div className="panel-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4" />
                Driver IC 初始化代码
              </div>
              <div className="flex gap-2">
                <button onClick={handleSendAll} className="btn-primary text-sm flex items-center gap-1">
                  <Play className="w-4 h-4" />
                  代码下发
                </button>
              </div>
            </div>
            <div className="panel-body grid grid-cols-2 gap-3 items-start">
              <div className="space-y-3 min-w-0">
                <textarea
                  value={driverCodeText}
                  onChange={(e) => {
                    const text = e.target.value;
                    setDriverCodeText(text);
                    const parsed = parseDriverCodeLines(text);
                    setDriverCode(parsed);
                    if (parsed.length > 0) {
                      const nextIndex = Math.min(selectedIndex, parsed.length - 1);
                      setSelectedIndex(nextIndex);
                      setEditValue(parsed[nextIndex]);
                    } else {
                      setSelectedIndex(0);
                      setEditValue("");
                    }
                  }}
                  className="input min-h-[360px] font-mono text-sm"
                  placeholder="初始化代码列表"
                />
                <div className="w-full max-w-[172px] space-y-2">
                  <div className="grid grid-cols-[120px_44px] gap-2 w-full">
                    <button
                      onClick={handleFormatCheck}
                      className="btn-secondary text-sm flex items-center justify-center gap-2 h-[38px]"
                    >
                      <FileCode className="w-4 h-4" />
                      格式检查
                    </button>
                    <button
                      onClick={handleMoveLeftToRight}
                      title="将左侧代码转换后填充到右侧，便于继续编辑"
                      className="btn-primary text-sm flex items-center justify-center min-w-[44px] h-[38px] px-2 self-center"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                  <button
                    onClick={handleGenerateConfigDownload}
                    className="btn-secondary text-base font-semibold flex items-center justify-center gap-2 h-[42px] w-full whitespace-nowrap"
                  >
                    <Download className="w-4.5 h-4.5" />
                    点屏配置下载
                  </button>
                </div>
              </div>
              <div className="space-y-3 min-w-0">
                <textarea
                  value={editValue || driverCode[selectedIndex] || ""}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="input w-full min-h-[360px] font-mono text-sm"
                  placeholder="输入指令，例如：05 00 01 28"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const value = editValue.trim();
                      if (!value) {
                        appendLog("没有可添加的初始化代码", "warning");
                        return;
                      }

                      try {
                        const converted = convertRightTextToInitCode(value);
                        if (converted.length === 0) {
                          appendLog("没有可添加的初始化代码", "warning");
                          return;
                        }
                        syncDriverCodeText(converted);
                        setDriverCode(converted);
                        setSelectedIndex(converted.length - 1);
                        appendLog(`已生成初始化代码并填充到左侧文本框：共 ${converted.length} 行`, "success");
                      } catch (error) {
                        appendLog(error instanceof Error ? error.message : `添加初始化代码失败: ${String(error)}`, "error");
                      }
                    }}
                    title="将右侧代码转换后填充到左侧，作为初始化点屏代码使用"
                    className="btn-primary text-sm flex items-center justify-center min-w-[44px] h-[38px] px-2 self-center"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleRightFormatCheck}
                    className="btn-secondary text-sm flex items-center justify-center gap-2 min-w-[120px]"
                  >
                    <FileCode className="w-4 h-4" />
                    格式检查
                  </button>
                  <button
                    onClick={handleFormatConvert}
                    className="btn-secondary text-sm flex items-center justify-center gap-2 min-w-[120px]"
                  >
                    <FileCode className="w-4 h-4" />
                    格式转换
                  </button>
                </div>
              </div>
            </div>
            </div>

            <div className="space-y-4">
              <div className="panel">
                <div className="panel-header">快捷命令</div>
                <div className="panel-body space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => handleSolidColor("red", "红屏")} className="btn-secondary text-sm py-1.5">红屏</button>
                    <button onClick={() => handleSolidColor("green", "绿屏")} className="btn-secondary text-sm py-1.5">绿屏</button>
                    <button onClick={() => handleSolidColor("blue", "蓝屏")} className="btn-secondary text-sm py-1.5">蓝屏</button>
                    <button onClick={() => handleSolidColor("black", "黑屏")} className="btn-secondary text-sm py-1.5">黑屏</button>
                    {grayButtons.map((value) => (
                      <button key={value} onClick={() => handleGray(value)} className="btn-secondary text-sm py-1.5">{value}</button>
                    ))}
                    <button onClick={() => handleSolidColor("white", "白屏")} className="btn-secondary text-sm py-1.5">白屏</button>
                    <button onClick={handleGrayPattern} className="btn-secondary text-sm py-1.5">灰阶画面</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={handleSleepIn} className="btn-secondary text-sm py-1.5">关屏 (28 / 10)</button>
                    <button onClick={handleSleepOut} className="btn-secondary text-sm py-1.5">开屏 (11 / 29)</button>
                    <button onClick={handleSoftwareReset} className="btn-secondary text-sm py-1.5">Software Reset (01)</button>
                    <button onClick={handleReadStatus} className="btn-secondary text-sm py-1.5">读取状态 (0A)</button>
                  </div>
                  <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400">逻辑测试图（选中即显示）</div>
                    <div className="flex items-center">
                      <select
                        value={selectedLogicPattern}
                        onChange={async (e) => {
                          const next = Number(e.target.value);
                          setSelectedLogicPattern(next);
                          await showLogicPattern(next);
                        }}
                        className="input text-sm flex-1"
                        title="选中后立即显示"
                      >
                        {logicPatternOptions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
