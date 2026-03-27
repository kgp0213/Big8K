export type CodeFormatCheckResult = {
  ok: boolean;
  cleanedLines: string[];
  errors: string[];
  warnings?: string[];
  errorLines?: number[];
  warningLines?: number[];
};

export type CodeFormatConvertResult = CodeFormatCheckResult & {
  output: string;
};

export type CommandSendConvertResult = {
  ok: boolean;
  commands: string[];
  errors: string[];
};

export type StandardCodeNormalizeResult = {
  ok: boolean;
  standardLines: string[];
  errors: string[];
  warnings?: string[];
  errorLines?: number[];
  warningLines?: number[];
};

export type FormattedCommandResult = {
  ok: boolean;
  formattedLines: string[];
  errors: string[];
  errorLines?: number[];
};

// 对单行原始代码做基础清洗，输出统一的大写文本，供后续“标准代码 / 格式化代码”转换使用。
export const normalizeCodeLine = (line: string) => {
  let cleaned = line.replace(/(\/\/|#).*$/, "");
  cleaned = cleaned
    .replace(/HWRST/gi, "")
    .replace(/0X/gi, "")
    .replace(/IC\s*WRITE/gi, "DELAY 21")
    .replace(/[\-＝=\[\]*\\#\t]/g, " ")
    .replace(/[，,;；/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.toUpperCase();
};

// 仅做基础清洗，不承担“标准代码归一化”语义。
export const cleanCodeLines = (text: string) => {
  return text
    .split("\n")
    .map((line) => normalizeCodeLine(line))
    .filter(Boolean);
};

// 校验左侧格式化代码：
// - 只允许十六进制字段
// - 每行必须符合 DT DELAY LEN DATA... 结构
// - DT 目前仅接受 05 / 29 / 39 / 0A
// - LEN 必须与后续数据数量一致
// - 对常用 DT 增加基础 payload 约束，避免明显错误漏检
export const validateCleanCodeLines = (lines: string[]) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const errorLines = new Set<number>();
  const warningLines = new Set<number>();

  lines.forEach((line, idx) => {
    const lineNumber = idx + 1;
    if (/^\s*\d+\./.test(line)) {
      errors.push(`第${lineNumber}行 不能包含行号`);
      errorLines.add(lineNumber);
      return;
    }

    if (!/^[0-9A-F\s]+$/.test(line)) {
      errors.push(`第${lineNumber}行 存在非法字符，只允许十六进制字符和空格`);
      errorLines.add(lineNumber);
      return;
    }

    const parts = line.split(" ").filter(Boolean);
    if (parts.length < 4) {
      errors.push(`第${lineNumber}行 字段数量不足，至少需要 4 个字段`);
      errorLines.add(lineNumber);
      return;
    }

    for (const part of parts) {
      if (!/^[0-9A-F]{2}$/.test(part)) {
        errors.push(`第${lineNumber}行 字段 ${part} 格式错误`);
        errorLines.add(lineNumber);
        return;
      }
    }

    const [dt, _delay, lenHex, ...payload] = parts;
    const declaredCount = parseInt(lenHex, 16);
    const actualCount = payload.length;

    if (!["05", "29", "39", "0A"].includes(dt)) {
      errors.push(`第${lineNumber}行 DT=${dt} 不受支持，仅允许 05 / 29 / 39 / 0A`);
      errorLines.add(lineNumber);
      return;
    }

    if (declaredCount !== actualCount) {
      errors.push(`第${lineNumber}行 长度字段 ${lenHex} 与后续数据数量不一致，声明 ${declaredCount}，实际 ${actualCount}`);
      errorLines.add(lineNumber);
      return;
    }

    if (dt === "05" && declaredCount !== 1) {
      errors.push(`第${lineNumber}行 DT=05 时 LEN 必须为 01，当前为 ${lenHex}`);
      errorLines.add(lineNumber);
      return;
    }

    if (dt === "29" && declaredCount < 2) {
      if (declaredCount === 1) {
        warnings.push(`第${lineNumber}行 DT=29 且 LEN=01，建议人工确认该写法是否符合预期`);
        warningLines.add(lineNumber);
      } else {
        errors.push(`第${lineNumber}行 DT=29 时 LEN 至少应为 02，当前为 ${lenHex}`);
        errorLines.add(lineNumber);
        return;
      }
    }

    if (dt === "39" && declaredCount < 2) {
      if (declaredCount === 1) {
        warnings.push(`第${lineNumber}行 DT=39 且 LEN=01，建议人工确认该写法是否符合预期`);
        warningLines.add(lineNumber);
      } else {
        errors.push(`第${lineNumber}行 DT=39 时 LEN 至少应为 02，当前为 ${lenHex}`);
        errorLines.add(lineNumber);
        return;
      }
    }

    if (dt === "0A" && declaredCount < 1) {
      errors.push(`第${lineNumber}行 DT=0A 时 LEN 至少应为 01，当前为 ${lenHex}`);
      errorLines.add(lineNumber);
    }
  });

  return {
    errors,
    warnings,
    errorLines: Array.from(errorLines).sort((a, b) => a - b),
    warningLines: Array.from(warningLines).sort((a, b) => a - b),
  };
};

// 左侧 vismpwr 检查：面向格式化代码，不接受显式 delay 文本，要求每行已是可下发字节行。
export const checkCodeFormatting = (text: string): CodeFormatCheckResult => {
  const cleanedLines = cleanCodeLines(text);
  const validation = validateCleanCodeLines(cleanedLines);
  const errors = [...validation.errors];
  const warnings = [...validation.warnings];
  const errorLines = new Set(validation.errorLines);
  const warningLines = new Set(validation.warningLines);

  cleanedLines.forEach((line, idx) => {
    const keyword = line.split(" ").filter(Boolean)[0]?.toUpperCase();
    if (keyword === "DELAY" || keyword === "DELAYMS") {
      errors.push(`第${idx + 1}行 左侧格式化代码中不能出现 delay`);
      errorLines.add(idx + 1);
    }
  });

  return {
    ok: errors.length === 0,
    cleanedLines,
    errors,
    warnings,
    errorLines: Array.from(errorLines).sort((a, b) => a - b),
    warningLines: Array.from(warningLines).sort((a, b) => a - b),
  };
};

export const convertCodeFormatting = (text: string): CodeFormatConvertResult => {
  const result = checkCodeFormatting(text);
  return {
    ...result,
    output: result.cleanedLines.join("\n"),
  };
};

// 将右侧原始代码 / 草稿代码清洗并归一化为标准代码。
// 这里接受上层兼容写法（如 delay、delayms、REGWxx、裸十六进制数据），并统一折叠为标准代码表示。
export const normalizeToStandardCode = (text: string): StandardCodeNormalizeResult => {
  const sourceLines = text.split("\n");
  const standardLines: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const errorLines = new Set<number>();
  const warningLines = new Set<number>();

  for (let i = 0; i < sourceLines.length; i += 1) {
    const normalized = normalizeCodeLine(sourceLines[i]);
    if (!normalized) continue;

    const parts = normalized.split(" ").filter(Boolean);
    if (parts.length === 0) continue;

    const keyword = parts[0].toUpperCase();
    const rest = parts.slice(1).map((part) => part.toUpperCase());
    const lineNumber = i + 1;

    const ensureHexFields = (fields: string[]) => {
      for (const field of fields) {
        if (!/^[0-9A-F]{2}$/.test(field)) {
          errors.push(`第${lineNumber}行 字段 ${field} 格式错误`);
          errorLines.add(lineNumber);
          return false;
        }
      }
      return true;
    };

    if (keyword === "DELAY" || keyword === "DELAYMS") {
      if (standardLines.length === 0) {
        errors.push(`第${lineNumber}行 delay 不能出现在第一行`);
        errorLines.add(lineNumber);
        continue;
      }
      if (rest.length < 1 || !/^\d+$/.test(rest[0])) {
        errors.push(`第${lineNumber}行 delay 格式错误`);
        errorLines.add(lineNumber);
        continue;
      }
      const delayValue = Math.min(255, parseInt(rest[0], 10));
      const previous = standardLines[standardLines.length - 1].split(" ");
      previous[1] = formatHexByte(delayValue);
      standardLines[standardLines.length - 1] = previous.join(" ");
      continue;
    }

    const looksLikeFormattedCode = (() => {
      if (parts.length < 4) return false;
      if (!["05", "29", "39", "0A"].includes(keyword)) return false;
      if (!parts.slice(1).every((field) => /^[0-9A-F]{2}$/.test(field))) return false;

      const lenHex = parts[2];
      const payloadCount = parts.length - 3;
      const declaredCount = parseInt(lenHex, 16);
      if (declaredCount !== payloadCount) return false;

      if (keyword === "05") return declaredCount === 1;
      if (keyword === "29") return declaredCount >= 2;
      if (keyword === "39") return declaredCount >= 2;
      if (keyword === "0A") return declaredCount >= 1;
      return false;
    })();

    if (looksLikeFormattedCode) {
      warnings.push(`第${lineNumber}行 检测到疑似格式化代码样式输入（已严格符合 DT / DELAY / LEN / DATA 结构），请人工确认该行是否应保留在右侧草稿区`);
      warningLines.add(lineNumber);
      standardLines.push(parts.join(" "));
      continue;
    }

    if (keyword === "REGW05" || keyword === "REGW29" || keyword === "REGW39" || keyword === "REGW0A") {
      if (!ensureHexFields(rest)) continue;
      const header = keyword.replace("REGW", "");
      const count = formatHexByte(rest.length);
      standardLines.push([header, "00", count, ...rest].join(" "));
      continue;
    }

    if (!ensureHexFields(parts)) continue;
    const count = formatHexByte(parts.length);
    standardLines.push(["39", "00", count, ...parts].join(" "));
  }

  return {
    ok: errors.length === 0,
    standardLines,
    errors,
    warnings,
    errorLines: Array.from(errorLines).sort((a, b) => a - b),
    warningLines: Array.from(warningLines).sort((a, b) => a - b),
  };
};

const formatHexByte = (value: number) => value.toString(16).toUpperCase().padStart(2, "0");

// 将标准代码或格式化代码转换为 vismpwr 实际可下发命令。
// 若输入仍含上层兼容语法，也会先按同样规则完成归一化再输出命令字节行。
export const convertCodeToMipiCommands = (text: string): CommandSendConvertResult => {
  const sourceLines = text.split("\n");
  const commands: string[] = [];
  const errors: string[] = [];
  const unsupported = new Set([
    "MIPI_READ",
    "REGR",
    "REGR04",
    "REGR06",
    "I2C8W",
    "I2C8R",
    "I2C4W",
    "I2C4R",
    "I2C3W",
    "I2C3R",
  ]);

  for (let i = 0; i < sourceLines.length; i += 1) {
    const normalized = normalizeCodeLine(sourceLines[i]);
    if (!normalized) continue;

    const parts = normalized.split(" ").filter(Boolean);
    if (parts.length === 0) continue;

    const keyword = parts[0].toUpperCase();
    const rest = parts.slice(1).map((part) => part.toUpperCase());
    const lineNumber = i + 1;

    if (unsupported.has(keyword)) {
      errors.push(`第${lineNumber}行 暂不支持 ${keyword} 类型`);
      continue;
    }

    if (keyword === "DELAY" || keyword === "DELAYMS") {
      if (commands.length === 0) {
        errors.push(`第${lineNumber}行 delay 不能出现在第一行`);
        continue;
      }
      if (rest.length < 1 || !/^\d+$/.test(rest[0])) {
        errors.push(`第${lineNumber}行 delay 格式错误`);
        continue;
      }
      const delayValue = Math.min(255, parseInt(rest[0], 10));
      const previous = commands[commands.length - 1].split(" ");
      previous[1] = formatHexByte(delayValue);
      commands[commands.length - 1] = previous.join(" ");
      continue;
    }

    if (/^(05|39|29|0A)(\s+[0-9A-F]{2})+$/.test(normalized)) {
      const declaredCount = parseInt(parts[2], 16);
      const actualCount = parts.length - 3;
      if (parts.length < 4) {
        errors.push(`第${lineNumber}行 字段数量不足，至少需要 4 个字段`);
        continue;
      }
      if (declaredCount !== actualCount) {
        errors.push(`第${lineNumber}行 长度字段 ${parts[2]} 与后续数据数量不一致，声明 ${declaredCount}，实际 ${actualCount}`);
        continue;
      }
      commands.push(parts.join(" "));
      continue;
    }

    if (keyword === "REGW05" || keyword === "REGW29" || keyword === "REGW39" || keyword === "REGW0A") {
      const invalid = rest.find((field) => !/^[0-9A-F]{2}$/.test(field));
      if (invalid) {
        errors.push(`第${lineNumber}行 字段 ${invalid} 格式错误`);
        continue;
      }
      const header = keyword.replace("REGW", "");
      const count = formatHexByte(rest.length);
      commands.push([header, "00", count, ...rest].join(" "));
      continue;
    }

    const invalid = parts.find((field) => !/^[0-9A-F]{2}$/.test(field));
    if (invalid) {
      errors.push(`第${lineNumber}行 字段 ${invalid} 格式错误`);
      continue;
    }
    const count = formatHexByte(parts.length);
    commands.push(["39", "00", count, ...parts].join(" "));
  }

  return {
    ok: errors.length === 0,
    commands,
    errors,
  };
};

// 将标准代码转换为左侧使用的格式化代码。
// 当前格式化代码与 vismpwr 最终可下发命令在文本表达上可视为同一套字节行。
export const convertStandardToFormattedCode = (text: string): FormattedCommandResult => {
  const result = normalizeToStandardCode(text);
  return {
    ok: result.ok,
    formattedLines: result.standardLines,
    errors: result.errors,
    errorLines: result.errorLines,
  };
};

// 将左侧格式化代码回填为右侧标准代码。
// 转换规则：
// - 39 00 LEN DATA... 还原为裸数据行，不额外标记 REGW39
// - 05/29/0A 的格式化代码还原为 REGWxx ...
// - 第二字段 delay 非 00 时，额外拆成下一行 delay N
export const convertFormattedToStandardCode = (text: string): StandardCodeNormalizeResult => {
  const cleanedLines = cleanCodeLines(text);
  const validation = validateCleanCodeLines(cleanedLines);
  const errors = [...validation.errors];
  const errorLines = new Set(validation.errorLines);

  if (errors.length > 0) {
    return {
      ok: false,
      standardLines: [],
      errors,
      errorLines: Array.from(errorLines).sort((a, b) => a - b),
    };
  }

  const standardLines: string[] = [];

  cleanedLines.forEach((line, idx) => {
    const lineNumber = idx + 1;
    const parts = line.split(" ").filter(Boolean);

    if (parts.length < 4) {
      errors.push(`第${lineNumber}行 字段数量不足，至少需要 4 个字段`);
      errorLines.add(lineNumber);
      return;
    }

    const [dt, delayHex, declaredLen, ...payload] = parts;
    const actualCount = payload.length;
    const expectedCount = parseInt(declaredLen, 16);

    if (expectedCount !== actualCount) {
      errors.push(`第${lineNumber}行 长度字段 ${declaredLen} 与后续数据数量不一致，声明 ${expectedCount}，实际 ${actualCount}`);
      errorLines.add(lineNumber);
      return;
    }

    if (!["05", "29", "39", "0A"].includes(dt)) {
      errors.push(`第${lineNumber}行 暂不支持 DT=${dt} 还原为标准代码`);
      errorLines.add(lineNumber);
      return;
    }

    if (dt === "39") {
      standardLines.push(payload.join(" "));
    } else {
      standardLines.push(`REGW${dt} ${payload.join(" ")}`);
    }

    const delayValue = parseInt(delayHex, 16);
    if (delayValue > 0) {
      standardLines.push(`DELAY ${delayValue}`);
    }
  });

  return {
    ok: errors.length === 0,
    standardLines,
    errors,
    errorLines: Array.from(errorLines).sort((a, b) => a - b),
  };
};
