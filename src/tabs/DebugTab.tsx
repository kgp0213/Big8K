import { useEffect, useRef, useState } from "react";
import { Code } from "lucide-react";
import { useConnection } from "../App";
import CodeConvertTab from "./CodeConvertTab";
import {
  DebugCommandPresetPanel,
  DebugMultiCommandPanel,
  checkDebugCommand,
  sendCommandPreset,
  sendDebugCommand,
  loadCommandPresets,
  saveCommandPresets,
  DEBUG_SUB_TABS,
  createDefaultCommandPresets,
} from "../features/debug";
import { loadMultiCommands, saveMultiCommands } from "../features/debug/textState";
import type { CommandPresetItem, DebugSubTab } from "../features/debug";

const PRESET_SAVE_DELAY_MS = 400;
const MULTI_COMMAND_COUNT = 4;
const PRESET_COUNT = 30;

export default function DebugTab() {
  const { connection, appendLog, debugMode } = useConnection();
  const [activeSubTab, setActiveSubTab] = useState<DebugSubTab>("multi");
  const [multiCommands, setMultiCommands] = useState<string[]>(() => loadMultiCommands(MULTI_COMMAND_COUNT));
  const [commandPresets, setCommandPresets] = useState<CommandPresetItem[]>(createDefaultCommandPresets(PRESET_COUNT));
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const saveTimerRef = useRef<number | null>(null);

  const isConnected = connection.connected && connection.type === "adb";

  const clearScheduledSave = () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  };

  const scheduleSave = (items: CommandPresetItem[]) => {
    clearScheduledSave();
    saveTimerRef.current = window.setTimeout(() => {
      void saveCommandPresets(items, appendLog);
    }, PRESET_SAVE_DELAY_MS);
  };

  const updateMultiCommand = (index: number, value: string) => {
    setMultiCommands((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const updateSelectedPreset = (patch: Partial<CommandPresetItem>) => {
    setCommandPresets((prev) =>
      prev.map((item, idx) => (idx === selectedPresetIndex ? { ...item, ...patch } : item))
    );
  };

  useEffect(() => {
    void (async () => {
      const items = await loadCommandPresets(appendLog);
      setCommandPresets(items);
      setSelectedPresetIndex(0);
    })();

    return () => {
      clearScheduledSave();
    };
  }, []);

  useEffect(() => {
    if (commandPresets.length > 0) {
      scheduleSave(commandPresets);
    }
  }, [commandPresets]);

  useEffect(() => {
    saveMultiCommands(multiCommands);
  }, [multiCommands]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        {DEBUG_SUB_TABS.map((tab: { id: DebugSubTab; label: string }) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSubTab === tab.id
                ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            {tab.id === "convert" && <Code className="w-4 h-4" />}
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === "multi" && (
        <DebugMultiCommandPanel
          commands={multiCommands}
          onChange={updateMultiCommand}
          onCheck={(index) => checkDebugCommand(multiCommands[index] || "", index, appendLog)}
          onSend={(index) => sendDebugCommand(multiCommands[index] || "", index, isConnected, debugMode, appendLog)}
        />
      )}

      {activeSubTab === "list" && (
        <DebugCommandPresetPanel
          items={commandPresets}
          selectedIndex={selectedPresetIndex}
          onSelect={setSelectedPresetIndex}
          onRename={(value: string) => updateSelectedPreset({ name: value })}
          onContentChange={(value: string) => updateSelectedPreset({ content: value })}
          onSend={() => sendCommandPreset(commandPresets[selectedPresetIndex], isConnected, debugMode, appendLog)}
        />
      )}

      {activeSubTab === "convert" && <CodeConvertTab />}
    </div>
  );
}
