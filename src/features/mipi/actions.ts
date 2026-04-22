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
  DownloadOledConfigPayload,
  ExportOledConfigJsonPayload,
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

export const handleRightConvertibilityCheckAction = (value: string, appendLog: AppendLog) => {
  const trimmed = value.trim();
  if (!trimmed) {
    appendLog("右侧没有可检查的原始代码", "warning");
    return;
  }

  const result = normalizeToStandardCode(trimmed);
  if (!result.ok) {
    result.errors.forEach((error) => appendLog(error, "error"));
    appendLog(`可转换性检查未通过：共 ${result.errors.length} 处问题`, "error");
    return;
  }

  result.warnings?.forEach((warning) => appendLog(warning, "warning"));
  if ((result.warnings?.length ?? 0) > 0) {
    appendLog(`可转换性检查通过，但检测到 ${result.warnings?.length ?? 0} 行疑似格式化代码样式输入，请人工重点检查`, "warning");
    return;
  }

  appendLog(`可转换性检查通过：可转换为 ${result.standardLines.length} 行标准代码`, "success");
};

export const handleNormalizeToStandardAction = (
  value: string,
  setEditValue: (value: string) => void,
  appendLog: AppendLog,
) => {
  const trimmed = value.trim();
  if (!trimmed) {
    appendLog("右侧没有可转换的原始代码", "warning");
    return;
  }

  const result = normalizeToStandardCode(trimmed);
  if (!result.ok) {
    result.errors.forEach((error) => appendLog(error, "error"));
    appendLog(`标准化转换失败：共 ${result.errors.length} 处问题`, "error");
    return;
  }

  result.warnings?.forEach((warning) => appendLog(warning, "warning"));

  const normalizedOriginal = parseDriverCodeLines(trimmed).map((line) => line.replace(/\s+/g, " ").trim());
  const convertedText = result.standardLines.join("\n");
  setEditValue(convertedText);

  if (normalizedOriginal.join("\n") === convertedText) {
    appendLog(`右侧内容已是标准代码：共 ${result.standardLines.length} 行`, "info");
    return;
  }

  appendLog(`已将右侧原始代码清理并转换为标准代码：共 ${result.standardLines.length} 行`, "success");
};

const validateFormattedDriverCode = (text: string, options?: { requireDsc0A?: boolean }) => {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      ok: false,
      cleanedLines: [] as string[],
      errors: ["左侧没有可检查的格式化代码"],
    };
  }

  const result = checkCodeFormatting(trimmed);
  const normalizedLines = result.cleanedLines.map((line) => line.replace(/\s+/g, " ").trim());
  const errors = [...result.errors];
  const warnings = [...(result.warnings ?? [])];

  if (options?.requireDsc0A) {
    const has0ALine = normalizedLines.some((line) => line.split(" ").filter(Boolean)[0] === "0A");
    if (!has0ALine) {
      errors.push("当前已启用 DSC，但左侧初始化代码中未找到 DT=0A 的数据行。请补充 0A 命令后再执行 OLED 配置下载。");
    }
  }

  return {
    ok: errors.length === 0,
    cleanedLines: normalizedLines,
    errors,
    warnings,
  };
};

export const handleVismpwrCheckAction = (
  value: string,
  selectedIndex: number,
  syncDriverCodeText: (nextDriverCode: string[]) => void,
  setSelectedIndex: (value: number) => void,
  appendLog: AppendLog,
) => {
  const result = validateFormattedDriverCode(value);
  if (!result.ok) {
    result.errors.forEach((error) => appendLog(error, "error"));
    result.warnings?.forEach((warning) => appendLog(warning, "warning"));
    appendLog(`vismpwr检查未通过：共 ${result.errors.length} 处问题`, "error");
    return;
  }

  result.warnings?.forEach((warning) => appendLog(warning, "warning"));
  syncDriverCodeText(result.cleanedLines);
  if (result.cleanedLines.length > 0) {
    const nextIndex = Math.min(selectedIndex, result.cleanedLines.length - 1);
    setSelectedIndex(nextIndex);
  }
  if ((result.warnings?.length ?? 0) > 0) {
    appendLog(`vismpwr检查通过，但检测到 ${result.warnings?.length ?? 0} 处建议人工确认的写法`, "warning");
    return;
  }

  appendLog(`vismpwr检查通过：共 ${result.cleanedLines.length} 行格式化代码`, "success");
};

export const applyOledConfig = async (
  path: string,
  options: {
    silent?: boolean;
    expandBasicSection?: boolean;
    syncRightEditor?: boolean;
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
    panelName: result.timing.panel_name,
    version: result.timing.version,
  };

  options.setTiming(nextTiming);
  if (options.expandBasicSection) {
    options.setShowBasicSection(true);
  }
  options.syncDriverCodeText(result.init_codes);
  options.setSelectedIndex(0);
  if (options.syncRightEditor) {
    options.setEditValue(result.init_codes[0] || "");
  }
  options.persistRecentConfig(result.path || path);
  if (!options.silent) {
    options.appendLog(`已加载 OLED 配置：${result.path || path}（${result.init_codes.length} 行初始化代码）`, "success");
  }
};

const buildValidatedTimingRequest = (
  timing: TimingConfig,
  driverCode: string[],
  appendLog: AppendLog,
) => {
  if (driverCode.length === 0) {
    appendLog("左侧没有可用于生成 OLED 配置的格式化代码", "warning");
    return null;
  }

  const validation = validateFormattedDriverCode(driverCode.join("\n"), {
    requireDsc0A: timing.dscEnable,
  });
  if (!validation.ok) {
    validation.errors.forEach((error) => appendLog(error, "error"));
    return null;
  }

  validation.warnings?.forEach((warning) => appendLog(warning, "warning"));

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
    panel_name: timing.panelName,
    version: timing.version,
    init_codes: validation.cleanedLines,
  };

  return request;
};

export const handleGenerateConfigDownloadAction = async (
  timing: TimingConfig,
  driverCode: string[],
  appendLog: AppendLog,
  debugMode = false,
) => {
  const request = buildValidatedTimingRequest(timing, driverCode, appendLog);
  if (!request) {
    appendLog("OLED 配置下载已中止：请先修正左侧格式化代码后再重试", "error");
    return;
  }

  try {
    if (debugMode) {
      appendLog("-> generate vis-timing.bin + adb push /vismm/vis-timing.bin + repack_initrd.sh && sync + reboot", "debug");
    }
    const payload: DownloadOledConfigPayload = { request };
    const result = await tauriInvoke<CommandResult>("download_oled_config_and_reboot", { payload });
    if (!result.success) {
      appendLog(result.error || result.output || "初始化配置下载失败", "error");
      return;
    }
    appendLog(result.output || "初始化配置下载完成并重启设备", "success");
  } catch (error) {
    appendLog(`初始化配置下载异常: ${String(error)}`, "error");
  }
};

export const handleExportOledConfigJsonAction = async (
  timing: TimingConfig,
  driverCode: string[],
  appendLog: AppendLog,
) => {
  const request = buildValidatedTimingRequest(timing, driverCode, appendLog);
  if (!request) {
    appendLog("导出 OLED 配置已中止：请先修正左侧格式化代码后再重试", "error");
    return;
  }

  try {
    const payload: ExportOledConfigJsonPayload = { request };
    const result = await tauriInvoke<CommandResult>("export_oled_config_json", { payload });
    if (!result.success) {
      appendLog(result.error || result.output || "导出 OLED 配置 JSON 失败", "error");
      return;
    }
    appendLog(result.output || "OLED 配置 JSON 导出成功", "success");
  } catch (error) {
    appendLog(`导出 OLED 配置 JSON 异常: ${String(error)}`, "error");
  }
};

export const handleFormattedToStandardAction = (value: string, setEditValue: (value: string) => void, appendLog: AppendLog) => {
  const trimmed = value.trim();
  if (!trimmed) {
    appendLog("左侧没有可转换到右侧的格式化代码", "warning");
    return;
  }

  const result = convertFormattedToStandardCode(trimmed);
  if (!result.ok) {
    result.errors.forEach((error) => appendLog(error, "error"));
    appendLog(`左到右转换失败：共 ${result.errors.length} 处问题`, "error");
    return;
  }

  const convertedText = result.standardLines.join("\n");
  setEditValue(convertedText);
  appendLog(`已将左侧格式化代码还原为标准代码并填充到右侧：共 ${result.standardLines.length} 行`, "success");
};

export const handleStandardToFormattedAction = (
  value: string,
  syncDriverCodeText: (nextDriverCode: string[]) => void,
  setDriverCode: (next: string[]) => void,
  setSelectedIndex: (value: number) => void,
  appendLog: AppendLog,
) => {
  const trimmed = value.trim();
  if (!trimmed) {
    appendLog("右侧没有可推送到左侧的原始代码", "warning");
    return;
  }

  try {
    const converted = convertRightTextToInitCode(trimmed);
    if (converted.length === 0) {
      appendLog("右侧没有可推送到左侧的格式化代码", "warning");
      return;
    }
    syncDriverCodeText(converted);
    setDriverCode(converted);
    setSelectedIndex(converted.length - 1);
    appendLog(`已将右侧内容清理并转换为格式化代码后填充到左侧：共 ${converted.length} 行`, "success");
  } catch (error) {
    appendLog(error instanceof Error ? error.message : `右到左转换失败: ${String(error)}`, "error");
  }
};

export const handleSendRightEditorAction = async (sourceText: string, debugMode: boolean, appendLog: AppendLog) => {
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
