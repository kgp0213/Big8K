import { checkCodeFormatting, convertCodeFormatting } from "../../utils/codeFormatter";

type AppendLog = (message: string, level?: "info" | "success" | "warning" | "error" | "debug") => void;

export const checkSourceCode = (value: string, appendLog: AppendLog) => {
  const trimmed = value.trim();
  if (!trimmed) {
    appendLog("左侧文本框为空，无法检查", "warning");
    return;
  }

  const result = checkCodeFormatting(trimmed);
  if (!result.ok) {
    result.errors.forEach((err) => appendLog(err, "error"));
    appendLog(`代码检查未通过：共 ${result.errors.length} 处问题`, "error");
    return;
  }

  appendLog(`代码检查通过：共 ${result.cleanedLines.length} 行`, "success");
};

export const convertSourceCode = (value: string, appendLog: AppendLog) => {
  const trimmed = value.trim();
  if (!trimmed) {
    appendLog("左侧文本框为空，无法转换", "warning");
    return { ok: false, output: "" };
  }

  const result = convertCodeFormatting(trimmed);
  if (!result.ok) {
    result.errors.forEach((err) => appendLog(err, "error"));
    appendLog(`代码格式化失败：共 ${result.errors.length} 处问题`, "error");
    return { ok: false, output: "" };
  }

  appendLog(`代码格式化完成：共 ${result.cleanedLines.length} 行`, "success");
  return { ok: true, output: result.output };
};

export const copyConvertedCode = async (value: string, appendLog: AppendLog) => {
  if (!value.trim()) {
    appendLog("右侧没有可复制的内容", "warning");
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    appendLog("已复制右侧代码到剪贴板", "success");
  } catch (error) {
    appendLog(`复制失败: ${String(error)}`, "error");
  }
};
