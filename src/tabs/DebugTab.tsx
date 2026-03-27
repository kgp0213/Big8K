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


export default function DebugTab() {
  const { connection, appendLog, debugMode } = useConnection();
  const [activeSubTab, setActiveSubTab] = useState<DebugSubTab>("multi");
  const [multiCommands, setMultiCommands] = useState<string[]>(() => loadMultiCommands(4));
  const [commandPresets, setCommandPresets] = useState<CommandPresetItem[]>(createDefaultCommandPresets(30));
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const saveTimerRef = useRef<number | null>(null);

  const isConnected = connection.connected && connection.type === "adb";

  const scheduleSave = (items: CommandPresetItem[]) => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void saveCommandPresets(items, appendLog);
    }, 400);
  };

  useEffect(() => {
    void (async () => {
      const items = await loadCommandPresets(appendLog);
      setCommandPresets(items);
      setSelectedPresetIndex(0);
    })();
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
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

  const renderMultiWindow = () => (
    <DebugMultiCommandPanel
      commands={multiCommands}
      onChange={(index: number, value: string) => {
        const next = [...multiCommands];
        next[index] = value;
        setMultiCommands(next);
      }}
      onCheck={(index) => checkDebugCommand(multiCommands[index] || "", index, appendLog)}
      onSend={(index) => sendDebugCommand(multiCommands[index] || "", index, isConnected, debugMode, appendLog)}
    />
  );

  const renderList = () => (
    <DebugCommandPresetPanel
      items={commandPresets}
      selectedIndex={selectedPresetIndex}
      onSelect={setSelectedPresetIndex}
      onRename={(value: string) => {
        const next = commandPresets.map((item, idx) =>
          idx === selectedPresetIndex ? { ...item, name: value } : item
        );
        setCommandPresets(next);
      }}
      onContentChange={(value: string) => {
        const next = commandPresets.map((item, idx) =>
          idx === selectedPresetIndex ? { ...item, content: value } : item
        );
        setCommandPresets(next);
      }}
      onSend={() => sendCommandPreset(commandPresets[selectedPresetIndex], isConnected, debugMode, appendLog)}
    />
  );

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

      {activeSubTab === "multi" && renderMultiWindow()}
      {activeSubTab === "list" && renderList()}
      {activeSubTab === "convert" && <CodeConvertTab />}
    </div>
  );
}
