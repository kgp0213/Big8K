export type DebugSubTab = "multi" | "list" | "convert";

export const DEBUG_SUB_TABS: { id: DebugSubTab; label: string }[] = [
  { id: "multi", label: "多窗口命令" },
  { id: "list", label: "清单命令" },
  { id: "convert", label: "代码转换" },
];

export const DEBUG_LABELS = {
  presetList: "清单命令",
  presetName: "名称",
  presetContent: "命令内容",
  presetSend: "发送命令",
  multiCommand: "多窗口命令",
  codeConvert: "代码转换",
} as const;

export type CommandActionResult = {
  success: boolean;
  output?: string;
  error?: string;
};

export type CommandPresetItem = {
  index: number;
  name: string;
  content: string;
};

export type CommandPresetListResult = {
  success: boolean;
  items: CommandPresetItem[];
  error?: string;
};

export const createDefaultCommandPresets = (count = 30): CommandPresetItem[] =>
  Array.from({ length: count }, (_, idx) => ({
    index: idx,
    name: `${String(idx + 1).padStart(2, "0")}-CMD`,
    content: "",
  }));
