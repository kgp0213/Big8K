import { ArrowLeft, ArrowRight, Download, FileCode, Play } from "lucide-react";

type Props = {
  driverCodeText: string;
  editValue: string;
  onDriverCodeTextChange: (text: string) => void;
  onEditValueChange: (value: string) => void;
  onSendRightEditor: () => void | Promise<void>;
  onVismpwrCheck: () => void;
  onFormattedToStandard: () => void;
  onGenerateConfigDownload: () => void | Promise<void>;
  onStandardToFormatted: () => void;
  onRightConvertibilityCheck: () => void;
  onNormalizeToStandard: () => void;
};

export default function DriverCodePanel({
  driverCodeText,
  editValue,
  onDriverCodeTextChange,
  onEditValueChange,
  onSendRightEditor,
  onVismpwrCheck,
  onFormattedToStandard,
  onGenerateConfigDownload,
  onStandardToFormatted,
  onRightConvertibilityCheck,
  onNormalizeToStandard,
}: Props) {
  return (
    <div className="panel">
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4" />
          Driver IC 初始化代码
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={() => void onSendRightEditor()}
            title="将右侧原始代码或标准代码转换为 vismpwr 命令后下发"
            className="btn-primary text-sm flex items-center gap-1"
          >
            <Play className="w-4 h-4" />
            代码下发
          </button>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">下发时将自动转换为 vismpwr 命令</span>
        </div>
      </div>
      <div className="panel-body grid grid-cols-2 gap-3 items-start">
        <div className="space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium text-gray-700 dark:text-gray-300">格式化代码区</span>
            <span>用于 vismpwr 检查 / OLED config 生成</span>
          </div>
          <textarea
            value={driverCodeText}
            onChange={(e) => onDriverCodeTextChange(e.target.value)}
            className="input min-h-[360px] font-mono text-sm whitespace-pre overflow-x-auto resize-none"
            placeholder="格式化代码（vismpwr / OLED config 用），例如：29 00 03 51 12 34"
          />
          <div className="w-full max-w-[172px] space-y-2">
            <div className="grid grid-cols-[120px_44px] gap-2 w-full">
              <button
                onClick={onVismpwrCheck}
                title="检查左侧格式化代码是否符合 vismpwr 可下发格式"
                className="btn-secondary text-sm flex items-center justify-center gap-2 h-[38px]"
              >
                <FileCode className="w-4 h-4" />
                vismpwr检查
              </button>
              <button
                onClick={onFormattedToStandard}
                title="将左侧格式化代码还原为右侧标准代码（05/29/0A -> REGWxx，delay 单独展开）"
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
          <div className="flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium text-gray-700 dark:text-gray-300">原始代码 / 标准代码草稿区</span>
            <span>用于清理、检查、标准化与下发</span>
          </div>
          <textarea
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            className="input w-full min-h-[360px] font-mono text-sm whitespace-pre overflow-x-auto resize-none"
            placeholder="原始代码 / 标准代码草稿区，例如：REGW05 28 或 05 00 01 28"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onStandardToFormatted}
              title="将右侧内容清理并转换为格式化代码后填充到左侧"
              className="btn-primary text-sm flex items-center justify-center min-w-[44px] h-[38px] px-2 self-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={onRightConvertibilityCheck}
              title="检查右侧原始代码是否可以清理并转换为标准代码"
              className="btn-secondary text-sm flex items-center justify-center gap-2 min-w-[140px]"
            >
              <FileCode className="w-4 h-4" />
              可转换性检查
            </button>
            <button
              onClick={onNormalizeToStandard}
              title="将右侧原始代码清理并转换为标准代码后回填右侧"
              className="btn-secondary text-sm flex items-center justify-center gap-2 min-w-[140px]"
            >
              <FileCode className="w-4 h-4" />
              标准化转换
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
