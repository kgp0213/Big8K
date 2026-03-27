import { tauriInvoke } from "../../utils/tauri";
import {
  checkCodeFormatting,
  convertCodeToMipiCommands,
  convertFormattedToStandardCode,
  convertStandardToFormattedCode,
  normalizeToStandardCode,
} from "../../utils/codeFormatter";
import type {
  CommandResult,
  LegacyLcdConfigResult,
  PatternResult,
  ReadStatusResult,
  TimingBinRequest,
  TimingConfig,
} from "./types";

type LogLevel = "info" | "success" | "warning" | "error" | "debug";
type AppendLog = (message: string, level?: LogLevel) => void;

export const parseDriverCodeLines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim().toUpperCase())
    .filter(Boolean);

export const convertRightTextToInitCode = (text: string) => {
  const result = convertStandardToFormattedCode(text);
  if (!result.ok) {
    throw new Error(result.errors[0] || "代码转换失败");
  }
  return result.formattedLines;
};

export const handleRightFormatCheckAction = (value: string, appendLog: AppendLog) => {
  const trimmed = value.trim();
  if (!trimmed) {
    appendLog("右侧文本框没有可检查的内容", "warning");
    return;
  }

  const result = normalizeToStandardCode(trimmed);
  if (!result.ok) {
    result.errors.forEach((error) => appendLog(error, "error"));
    appendLog(`格式检查，共发现 ${result.errors.length} 处问题`, "error");
    return;
  }

  appendLog(`代码检查通过：共 ${result.standardLines.length} 行`, "success");
};

export const handleFormatConvertAction = (
  value: string,
  setEditValue: (value: string) => void,
  appendLog: AppendLog,
) => {
  const trimmed = value.trim();
  if (!trimmed) {
    appendLog("没有可转换的内容", "warning");
    return;
  }

  const result = normalizeToStandardCode(trimmed);
  if (!result.ok) {
    result.errors.forEach((error) => appendLog(error, "error"));
    appendLog(`格式转换失败：共 ${result.errors.length} 处问题`, "error");
    return;
  }

  const normalizedOriginal = parseDriverCodeLines(trimmed).map((line) => line.replace(/\s+/g, " ").trim());
  const convertedText = result.standardLines.join("\n");
  setEditValue(convertedText);

  if (normalizedOriginal.join("\n") === convertedText) {
    appendLog(`代码已是目标格式：共 ${result.standardLines.length} 行`, "info");
    return;
  }

  appendLog(`已执行格式转换：共 ${result.standardLines.length} 行`, "success");
};

export const handleFormatCheckAction = (
  value: string,
  selectedIndex: number,
  syncDriverCodeText: (nextDriverCode: string[]) => void,
  setSelectedIndex: (value: number) => void,
  setEditValue: (value: string) => void,
  appendLog: AppendLog,
) => {
  const trimmed = value.trim();
  if (!trimmed) {
    appendLog("没有可检查的初始化代码", "warning");
    return;
  }

  const result = checkCodeFormatting(trimmed);
  if (!result.ok) {
    result.errors.forEach((error) => appendLog(error, "error"));
    appendLog(`格式检查，共发现 ${result.errors.length} 处问题`, "error");
    return;
  }

  const normalizedLines = result.cleanedLines.map((line) => line.replace(/\s+/g, " ").trim());
  syncDriverCodeText(normalizedLines);
  if (normalizedLines.length > 0) {
    const nextIndex = Math.min(selectedIndex, normalizedLines.length - 1);
    setSelectedIndex(nextIndex);
    setEditValue(normalizedLines[nextIndex]);
  }
  appendLog(`代码检查通过：共 ${normalizedLines.length} 行`, "success");
};

export const applyOledConfig = async (
  path: string,
  options: {
    silent?: boolean;
    expandBasicSection?: boolean;
    setTiming: (value: TimingConfig) => void;
    setShowBasicSection: (value: boolean) => void;
    syncDriverCodeText: (nextDriverCode: string[]) => void;
    setSelectedIndex: (value: number) => void;
    setEditValue: (value: string) => void;
    persistRecentConfig: (path: string) => void;
    appendLog: AppendLog;
  },
) => {
  const result = await tauriInvoke<LegacyLcdConfigResult>("parse_legacy_lcd_bin", { path });
  if (!result.success || !result.timing) {
    throw new Error(result.error || "读取 OLED 配置失败");
  }

  const nextTiming: TimingConfig = {
    hact: result.timing.hact,
    vact: result.timing.vact,
    pclk: result.timing.pclk,
    hfp: result.timing.hfp,
    hbp: result.timing.hbp,
    hsync: result.timing.hsync,
    vfp: result.timing.vfp,
    vbp: result.timing.vbp,
    vsync: result.timing.vsync,
    hsPolarity: result.timing.hs_polarity,
    vsPolarity: result.timing.vs_polarity,
    dePolarity: result.timing.de_polarity,
    clkPolarity: result.timing.clk_polarity,
    interfaceType: result.timing.interface_type,
    mipiMode: result.timing.mipi_mode,
    videoType: result.timing.video_type,
    lanes: result.timing.lanes,
    format: result.timing.format,
    phyMode: result.timing.phy_mode,
    dscEnable: result.timing.dsc_enable,
    dscVersion: result.timing.dsc_version,
    sliceWidth: result.timing.slice_width,
    sliceHeight: result.timing.slice_height,
    scramblingEnable: result.timing.scrambling_enable,
    dataSwap: result.timing.data_swap,
    dualChannel: result.timing.dual_channel,
  };

  options.setTiming(nextTiming);
  if (options.expandBasicSection) {
    options.setShowBasicSection(true);
  }
  options.syncDriverCodeText(result.init_codes);
  options.setSelectedIndex(0);
  options.setEditValue(result.init_codes[0] || "");
  options.persistRecentConfig(result.path || path);
  if (!options.silent) {
    options.appendLog(`已加载 OLED 配置：${result.path || path}（${result.init_codes.length} 行初始化代码）`, "success");
  }
};

export const handleGenerateConfigDownloadAction = async (
  timing: TimingConfig,
  driverCode: string[],
  appendLog: AppendLog,
) => {
  if (driverCode.length === 0) {
    appendLog("左侧没有可用于生成 OLED config bin 的格式化代码", "warning");
    return;
  }

  const request: TimingBinRequest = {
    pclk: timing.pclk,
    hact: timing.hact,
    hfp: timing.hfp,
    hbp: timing.hbp,
    hsync: timing.hsync,
    vact: timing.vact,
    vfp: timing.vfp,
    vbp: timing.vbp,
    vsync: timing.vsync,
    hs_polarity: timing.hsPolarity,
    vs_polarity: timing.vsPolarity,
    de_polarity: timing.dePolarity,
    clk_polarity: timing.clkPolarity,
    interface_type: timing.interfaceType,
    mipi_mode: timing.mipiMode,
    video_type: timing.videoType,
    lanes: timing.lanes,
    format: timing.format,
    phy_mode: timing.phyMode,
    dsc_enable: timing.dscEnable,
    dsc_version: timing.dscVersion,
    slice_width: timing.sliceWidth,
    slice_height: timing.sliceHeight,
    scrambling_enable: timing.scramblingEnable,
    data_swap: timing.dataSwap,
    init_codes: driverCode,
  };

  try {
    const result = await tauriInvoke<CommandResult>("generate_timing_bin", { request });
    if (result.success) {
      appendLog(`已生成 OLED config bin：${result.output}`, "success");
    } else {
      appendLog(result.error || result.output || "生成 OLED config bin 失败", "error");
    }
  } catch (error) {
    appendLog(`生成 OLED config bin 异常: ${String(error)}`, "error");
  }
};

export const handleMoveLeftToRightAction = (value: string, setEditValue: (value: string) => void, appendLog: AppendLog) => {
  const trimmed = value.trim();
  if (!trimmed) {
    appendLog("左侧文本框为空，无法转换到右侧", "warning");
    return;
  }

  const result = convertFormattedToStandardCode(trimmed);
  if (!result.ok) {
    result.errors.forEach((error) => appendLog(error, "error"));
    appendLog(`左侧内容转换失败：共 ${result.errors.length} 处问题`, "error");
    return;
  }

  const convertedText = result.standardLines.join("\n");
  setEditValue(convertedText);
  appendLog(`已将左侧内容转换并填充到右侧：共 ${result.standardLines.length} 行`, "success");
};

export const handleMoveRightToLeftAction = (
  value: string,
  syncDriverCodeText: (nextDriverCode: string[]) => void,
  setDriverCode: (next: string[]) => void,
  setSelectedIndex: (value: number) => void,
  appendLog: AppendLog,
) => {
  const trimmed = value.trim();
  if (!trimmed) {
    appendLog("没有可添加的初始化代码", "warning");
    return;
  }

  try {
    const converted = convertRightTextToInitCode(trimmed);
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
};

export const handleSendAllAction = async (sourceText: string, debugMode: boolean, appendLog: AppendLog) => {
  const trimmed = sourceText.trim();
  if (!trimmed) {
    appendLog("右侧文本框为空，无法代码下发", "warning");
    return;
  }

  const converted = convertCodeToMipiCommands(trimmed);
  if (!converted.ok) {
    converted.errors.forEach((error) => appendLog(error, "error"));
    appendLog(`代码下发失败：共 ${converted.errors.length} 处问题`, "error");
    return;
  }

  const commands = converted.commands;
  if (commands.length === 0) {
    appendLog("右侧文本框没有可下发的代码", "warning");
    return;
  }

  try {
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

export const handleReadStatusAction = async (appendLog: AppendLog) => {
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

export const handleSimpleCommandAction = async (
  command: string,
  startLog: string,
  successFallback: string,
  errorFallback: string,
  appendLog: AppendLog,
  debugCommand?: string,
) => {
  appendLog(startLog, "info");
  if (debugCommand) {
    appendLog(debugCommand, "debug");
  }
  try {
    const result = await tauriInvoke<CommandResult>(command);
    if (result.success) {
      appendLog(result.output || successFallback, "success");
    } else {
      appendLog(result.error || result.output || errorFallback, "error");
    }
  } catch (e) {
    appendLog(`${errorFallback}: ${String(e)}`, "error");
  }
};

export const handleRuntimePatternAction = async (
  pattern: string,
  label: string,
  appendLog: AppendLog,
  debugMode = false,
) => {
  appendLog(`显示画面 -> ${label}`, "info");
  if (debugMode) {
    appendLog(`-> adb shell python3 /vismm/fbshow/big8k_runtime/render_patterns.py ${pattern}`, "debug");
  }
  try {
    const result = await tauriInvoke<PatternResult>("run_runtime_pattern", { request: { pattern } });
    if (result.success) {
      appendLog(`显示完成 -> ${label}`, "success");
    } else {
      appendLog(result.error || result.message || `显示失败 -> ${label}`, "error");
    }
  } catch (e) {
    appendLog(`调用失败: ${String(e)}`, "error");
  }
};

export const handleLogicPatternAction = async (
  pattern: number,
  label: string,
  appendLog: AppendLog,
  debugMode = false,
) => {
  appendLog(`显示逻辑图 -> ${label}`, "info");
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
