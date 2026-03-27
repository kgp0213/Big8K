import { ArrowLeft, ArrowRight, Download, FileCode, Play } from "lucide-react";

type Props = {
  driverCode: string[];
  driverCodeText: string;
  selectedIndex: number;
  editValue: string;
  onDriverCodeTextChange: (text: string) => void;
  onEditValueChange: (value: string) => void;
  onSendAll: () => void | Promise<void>;
  onFormatCheck: () => void;
  onMoveLeftToRight: () => void;
  onGenerateConfigDownload: () => void | Promise<void>;
  onMoveRightToLeft: () => void;
  onRightFormatCheck: () => void;
  onFormatConvert: () => void;
};

export default function DriverCodePanel({
  driverCode,
  driverCodeText,
  selectedIndex,
  editValue,
  onDriverCodeTextChange,
  onEditValueChange,
  onSendAll,
  onFormatCheck,
  onMoveLeftToRight,
  onGenerateConfigDownload,
  onMoveRightToLeft,
  onRightFormatCheck,
  onFormatConvert,
}: Props) {
  return (
    <div className="panel">
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4" />
          Driver IC 初始化代码
        </div>
        <div className="flex gap-2">
          <button onClick={() => void onSendAll()} className="btn-primary text-sm flex items-center gap-1">
            <Play className="w-4 h-4" />
            代码下发
          </button>
        </div>
      </div>
      <div className="panel-body grid grid-cols-2 gap-3 items-start">
        <div className="space-y-3 min-w-0">
          <textarea
            value={driverCodeText}
            onChange={(e) => onDriverCodeTextChange(e.target.value)}
            className="input min-h-[360px] font-mono text-sm whitespace-pre overflow-x-auto resize-none"
            placeholder="初始化代码列表"
          />
          <div className="w-full max-w-[172px] space-y-2">
            <div className="grid grid-cols-[120px_44px] gap-2 w-full">
              <button
                onClick={onFormatCheck}
                className="btn-secondary text-sm flex items-center justify-center gap-2 h-[38px]"
              >
                <FileCode className="w-4 h-4" />
                格式检查
              </button>
              <button
                onClick={onMoveLeftToRight}
                title="将左侧代码转换后填充到右侧，便于继续编辑"
                className="btn-primary text-sm flex items-center justify-center min-w-[44px] h-[38px] px-2 self-center"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={() => void onGenerateConfigDownload()}
              className="btn-secondary text-base font-semibold flex items-center justify-center gap-2 h-[42px] w-full whitespace-nowrap"
            >
              <Download className="w-4.5 h-4.5" />
              OLED 配置下载
            </button>
          </div>
        </div>
        <div className="space-y-3 min-w-0">
          <textarea
            value={editValue || driverCode[selectedIndex] || ""}
            onChange={(e) => onEditValueChange(e.target.value)}
            className="input w-full min-h-[360px] font-mono text-sm whitespace-pre overflow-x-auto resize-none"
            placeholder="输入指令，例如：05 00 01 28"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onMoveRightToLeft}
              title="将右侧代码转换后填充到左侧，作为初始化点屏代码使用"
              className="btn-primary text-sm flex items-center justify-center min-w-[44px] h-[38px] px-2 self-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={onRightFormatCheck}
              className="btn-secondary text-sm flex items-center justify-center gap-2 min-w-[120px]"
            >
              <FileCode className="w-4 h-4" />
              格式检查
            </button>
            <button
              onClick={onFormatConvert}
              className="btn-secondary text-sm flex items-center justify-center gap-2 min-w-[120px]"
            >
              <FileCode className="w-4 h-4" />
              格式转换
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
