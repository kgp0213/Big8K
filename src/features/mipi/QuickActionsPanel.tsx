type Props = {
  grayButtons: number[];
  selectedLogicPattern: number;
  logicPatternOptions: { value: number; label: string }[];
  onSelectLogicPattern: (value: number) => void | Promise<void>;
  onSolidColor: (color: string, label: string) => void | Promise<void>;
  onGray: (value: number) => void | Promise<void>;
  onGrayPattern: () => void | Promise<void>;
  onSleepIn: () => void | Promise<void>;
  onSleepOut: () => void | Promise<void>;
  onSoftwareReset: () => void | Promise<void>;
  onReadStatus: () => void | Promise<void>;
};

export default function QuickActionsPanel({
  grayButtons,
  selectedLogicPattern,
  logicPatternOptions,
  onSelectLogicPattern,
  onSolidColor,
  onGray,
  onGrayPattern,
  onSleepIn,
  onSleepOut,
  onSoftwareReset,
  onReadStatus,
}: Props) {
  const confirmAndRun = async (message: string, action: () => void | Promise<void>) => {
    if (!window.confirm(message)) return;
    await action();
  };

  return (
    <div className="panel">
      <div className="panel-header">快捷命令</div>
      <div className="panel-body space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => void onSolidColor("red", "红屏")} className="btn-secondary text-sm py-1.5">红屏</button>
          <button onClick={() => void onSolidColor("green", "绿屏")} className="btn-secondary text-sm py-1.5">绿屏</button>
          <button onClick={() => void onSolidColor("blue", "蓝屏")} className="btn-secondary text-sm py-1.5">蓝屏</button>
          <button onClick={() => void onSolidColor("black", "黑屏")} className="btn-secondary text-sm py-1.5">黑屏</button>
          {grayButtons.map((value) => (
            <button key={value} onClick={() => void onGray(value)} className="btn-secondary text-sm py-1.5">{value}</button>
          ))}
          <button onClick={() => void onSolidColor("white", "224 白屏")} className="btn-secondary text-sm py-1.5">224 白屏</button>
          <button onClick={() => void onGrayPattern()} className="btn-secondary text-sm py-1.5">灰阶画面</button>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-3" />

        <div className="space-y-2">
          <div className="text-xs text-gray-500 dark:text-gray-400">逻辑测试图（选中即显示）</div>
          <div className="flex items-center">
            <select
              value={selectedLogicPattern}
              onChange={(e) => void onSelectLogicPattern(Number(e.target.value))}
              className="input text-sm flex-1"
              title="选中后立即显示"
            >
              {logicPatternOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-3" />

        <div className="grid grid-cols-1 gap-2">
          <button onClick={() => void onReadStatus()} className="btn-secondary text-sm py-1.5">读取状态 (0A)</button>
        </div>

        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-900/15 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => void confirmAndRun("确认执行关屏 (28 / 10)？这会直接关闭当前面板显示。", onSleepIn)}
              className="rounded-lg border border-amber-300 dark:border-amber-700 bg-white/80 dark:bg-gray-900/30 px-3 py-1.5 text-sm text-amber-800 dark:text-amber-200 hover:bg-white dark:hover:bg-gray-900/50"
            >
              关屏 (28 / 10)
            </button>
            <button
              onClick={() => void confirmAndRun("确认执行开屏 (11 / 29)？这会直接切换面板到开屏状态。", onSleepOut)}
              className="rounded-lg border border-amber-300 dark:border-amber-700 bg-white/80 dark:bg-gray-900/30 px-3 py-1.5 text-sm text-amber-800 dark:text-amber-200 hover:bg-white dark:hover:bg-gray-900/50"
            >
              开屏 (11 / 29)
            </button>
            <button
              onClick={() => void confirmAndRun("确认执行 Software Reset (01)？这会重置当前面板状态。", onSoftwareReset)}
              className="col-span-2 rounded-lg border border-red-300 dark:border-red-700 bg-white/80 dark:bg-gray-900/30 px-3 py-1.5 text-sm text-red-700 dark:text-red-300 hover:bg-white dark:hover:bg-gray-900/50"
            >
              Software Reset (01)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
