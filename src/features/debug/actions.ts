import { tauriInvoke } from "../../utils/tauri";
import { checkCodeFormatting, convertCodeToMipiCommands } from "../../utils/codeFormatter";
import type { CommandActionResult, CommandPresetItem } from "./types";

type AppendLog = (message: string, level?: "info" | "success" | "warning" | "error" | "debug") => void;

export const checkDebugCommand = (command: string, index: number, appendLog: AppendLog) => {
  const trimmed = command.trim();
  if (!trimmed) {
    appendLog(`窗口 ${index + 1} 没有可检查的内容`, "warning");
    return;
  }

  const result = checkCodeFormatting(trimmed);
  if (!result.ok) {
    result.errors.forEach((error) => appendLog(error, "error"));
    appendLog(`代码检查失败：窗口 ${index + 1} 共 ${result.errors.length} 处问题`, "error");
    return;
  }

  appendLog(`代码检查通过：窗口 ${index + 1} 共 ${result.cleanedLines.length} 行`, "success");
};

export const sendDebugCommand = async (
  command: string,
  index: number,
  isConnected: boolean,
  debugMode: boolean,
  appendLog: AppendLog,
) => {
  const trimmed = command.trim();
  if (!trimmed) {
    appendLog(`窗口 ${index + 1} 没有可发送的命令`, "warning");
    return;
  }
  if (!isConnected) {
    appendLog("连接检查 -> 未连接 ADB 设备，请先在右侧完成连接", "warning");
    return;
  }

  const converted = convertCodeToMipiCommands(trimmed);
  if (!converted.ok) {
    converted.errors.forEach((error) => appendLog(error, "error"));
    appendLog(`代码转换失败：窗口 ${index + 1} 共 ${converted.errors.length} 处问题`, "error");
    return;
  }

  const commands = converted.commands;
  if (commands.length === 0) {
    appendLog(`窗口 ${index + 1} 没有可发送的指令`, "warning");
    return;
  }

  appendLog(`任务开始 -> 多窗口命令#${index + 1}`, "info");
  if (debugMode) {
    commands.forEach((cmd) => appendLog(`-> adb shell vismpwr ${cmd}`, "debug"));
  }

  try {
    const result = await tauriInvoke<CommandActionResult>("mipi_send_commands", { commands });
    if (result.success) {
      appendLog(`执行完成 -> 多窗口命令#${index + 1}`, "success");
      if (result.output) appendLog(result.output, "info");
    } else {
      appendLog(result.error || result.output || "命令执行失败", "error");
    }
  } catch (error) {
    appendLog(`命令执行异常: ${String(error)}`, "error");
  }
};

export const sendCommandPreset = async (
  item: CommandPresetItem | undefined,
  isConnected: boolean,
  debugMode: boolean,
  appendLog: AppendLog,
) => {
  if (!item) {
    appendLog("清单命令为空", "warning");
    return;
  }

  const trimmed = item.content.trim();
  if (!trimmed) {
    appendLog("清单内容为空，无法发送", "warning");
    return;
  }
  if (!isConnected) {
    appendLog("连接检查 -> 未连接 ADB 设备，请先在右侧完成连接", "warning");
    return;
  }

  const converted = convertCodeToMipiCommands(trimmed);
  if (!converted.ok) {
    converted.errors.forEach((error) => appendLog(error, "error"));
    appendLog(`代码转换失败：共 ${converted.errors.length} 处问题`, "error");
    return;
  }

  const commands = converted.commands;
  if (commands.length === 0) {
    appendLog("清单内容没有可发送的指令", "warning");
    return;
  }

  appendLog(`任务开始 -> 清单命令发送（${item.name || "未命名"}）`, "info");
  if (debugMode) {
    commands.forEach((cmd) => appendLog(`-> adb shell vismpwr ${cmd}`, "debug"));
  }

  try {
    const result = await tauriInvoke<CommandActionResult>("mipi_send_commands", { commands });
    if (result.success) {
      appendLog(result.output || "清单命令发送完成", "success");
    } else {
      appendLog(result.error || result.output || "清单命令发送失败", "error");
    }
  } catch (error) {
    appendLog(`清单命令发送异常: ${String(error)}`, "error");
  }
};
