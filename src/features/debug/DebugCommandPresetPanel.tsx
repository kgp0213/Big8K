import { ClipboardList, Send } from "lucide-react";
import type { CommandPresetItem } from "./types";
import { DEBUG_LABELS } from "./types";

type Props = {
  items: CommandPresetItem[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onRename: (value: string) => void;
  onContentChange: (value: string) => void;
  onSend: () => void;
};

export default function DebugCommandPresetPanel({
  items,
  selectedIndex,
  onSelect,
  onRename,
  onContentChange,
  onSend,
}: Props) {
  const selected = items[selectedIndex];

  return (
    <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <ClipboardList className="w-4 h-4" />
          {DEBUG_LABELS.presetList}
        </div>
        <label className="text-xs text-gray-500">{DEBUG_LABELS.presetName}</label>
        <input
          className="input text-sm"
          value={selected?.name || ""}
          onChange={(e) => onRename(e.target.value)}
          placeholder="例如：01-CMD"
        />
        <div className="max-h-[520px] overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950">
          {items.map((item, idx) => (
            <button
              key={item.index}
              onClick={() => onSelect(idx)}
              className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 dark:border-gray-800 ${
                idx === selectedIndex
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300"
                  : "hover:bg-gray-50 dark:hover:bg-gray-900"
              }`}
            >
              {item.name || `${String(idx + 1).padStart(2, "0")}-CMD`}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{DEBUG_LABELS.presetContent}</span>
          <button onClick={onSend} className="btn-primary text-sm flex items-center gap-2">
            <Send className="w-4 h-4" />
            {DEBUG_LABELS.presetSend}
          </button>
        </div>
        <textarea
          className="input min-h-[620px] font-mono text-sm whitespace-pre overflow-x-auto resize-none"
          value={selected?.content || ""}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder="输入一行或多行命令代码..."
        />
      </div>
    </div>
  );
}
