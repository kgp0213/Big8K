import { tauriInvoke } from "../../utils/tauri";
import type { CommandActionResult, CommandPresetItem, CommandPresetListResult } from "./types";
import { createDefaultCommandPresets } from "./types";

type AppendLog = (message: string, level?: "info" | "success" | "warning" | "error" | "debug") => void;

export const loadCommandPresets = async (appendLog: AppendLog): Promise<CommandPresetItem[]> => {
  try {
    const result = await tauriInvoke<CommandPresetListResult>("load_command_presets");
    if (result.success) {
      const items = result.items?.length ? result.items : createDefaultCommandPresets(30);
      if (result.error) appendLog(result.error, "warning");
      return items;
    }
    appendLog(result.error || "清单数据加载失败", "warning");
    return createDefaultCommandPresets(30);
  } catch (error) {
    appendLog(`清单数据加载异常: ${String(error)}`, "warning");
    return createDefaultCommandPresets(30);
  }
};

export const saveCommandPresets = async (items: CommandPresetItem[], appendLog: AppendLog) => {
  try {
    const result = await tauriInvoke<CommandActionResult>("save_command_presets", { items });
    if (!result.success && result.error) {
      appendLog(result.error, "warning");
    }
  } catch (error) {
    appendLog(`清单数据保存异常: ${String(error)}`, "warning");
  }
};
