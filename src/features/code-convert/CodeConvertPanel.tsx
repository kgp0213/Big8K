import { ClipboardCheck, ClipboardList } from "lucide-react";
import { CODE_CONVERT_LABELS } from "./types";

type Props = {
  sourceText: string;
  resultText: string;
  onSourceChange: (value: string) => void;
  onResultChange: (value: string) => void;
  onCheck: () => void;
  onConvert: () => void;
  onCopy: () => void;
};

export default function CodeConvertPanel({
  sourceText,
  resultText,
  onSourceChange,
  onResultChange,
  onCheck,
  onConvert,
  onCopy,
}: Props) {
  return (
    <div className="grid grid-cols-[minmax(0,1.62fr)_minmax(0,0.78fr)] gap-2 items-start">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <ClipboardList className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          {CODE_CONVERT_LABELS.sourceTitle}
        </div>
        <textarea
          value={sourceText}
          onChange={(e) => onSourceChange(e.target.value)}
          className="input h-[420px] resize-none font-mono text-[13px] leading-6 whitespace-pre overflow-x-auto"
          placeholder={CODE_CONVERT_LABELS.sourcePlaceholder}
        />
        <div className="flex items-center justify-between gap-3">
          <button
            className="inline-flex h-[42px] items-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium whitespace-nowrap text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
            onClick={onCheck}
          >
            {CODE_CONVERT_LABELS.checkButton}
          </button>
          <button
            className="inline-flex h-[42px] items-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-3 text-[12px] font-semibold whitespace-nowrap text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)] transition-all hover:translate-y-[-1px] hover:shadow-[0_14px_28px_rgba(37,99,235,0.34)]"
            onClick={onConvert}
          >
            {CODE_CONVERT_LABELS.convertButton}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <ClipboardCheck className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          {CODE_CONVERT_LABELS.resultTitle}
        </div>
        <textarea
          value={resultText}
          onChange={(e) => onResultChange(e.target.value)}
          className="input h-[420px] resize-none font-mono text-[13px] leading-6 whitespace-pre overflow-x-auto"
          placeholder={CODE_CONVERT_LABELS.resultPlaceholder}
        />
        <div className="flex justify-start">
          <button
            className="inline-flex h-[42px] items-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium whitespace-nowrap text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
            onClick={onCopy}
          >
            {CODE_CONVERT_LABELS.copyButton}
          </button>
        </div>
      </div>
    </div>
  );
}
