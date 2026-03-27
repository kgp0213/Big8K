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
          <button onClick={() => void onSolidColor("white", "白屏")} className="btn-secondary text-sm py-1.5">白屏</button>
          <button onClick={() => void onGrayPattern()} className="btn-secondary text-sm py-1.5">灰阶画面</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => void onSleepIn()} className="btn-secondary text-sm py-1.5">关屏 (28 / 10)</button>
          <button onClick={() => void onSleepOut()} className="btn-secondary text-sm py-1.5">开屏 (11 / 29)</button>
          <button onClick={() => void onSoftwareReset()} className="btn-secondary text-sm py-1.5">Software Reset (01)</button>
          <button onClick={() => void onReadStatus()} className="btn-secondary text-sm py-1.5">读取状态 (0A)</button>
        </div>
        <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
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
      </div>
    </div>
  );
}
