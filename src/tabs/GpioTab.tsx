import { useState } from "react";
import { ArrowLeftRight, ClipboardCheck, ClipboardList, FileCode } from "lucide-react";

export default function GpioTab() {
  const [leftText, setLeftText] = useState("");
  const [rightText, setRightText] = useState("");

  return (
    <div className="space-y-4">
      <div className="panel">
        <div className="panel-header flex items-center gap-2">
          <FileCode className="w-4 h-4" />
          代码转换
        </div>
        <div className="panel-body space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <ClipboardList className="w-4 h-4" />
                原始代码 / 初始化代码
              </div>
              <textarea
                value={leftText}
                onChange={(e) => setLeftText(e.target.value)}
                className="input font-mono h-[420px] resize-none"
                placeholder="把原始初始化代码或寄存器配置粘贴到这里..."
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <ClipboardCheck className="w-4 h-4" />
                转换结果 / 可编辑区
              </div>
              <textarea
                value={rightText}
                onChange={(e) => setRightText(e.target.value)}
                className="input font-mono h-[420px] resize-none"
                placeholder="转换后的命令、格式化结果或可下发内容会显示在这里..."
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="btn-primary flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4" />
              转换为初始化代码
            </button>
            <button className="btn-secondary">格式检查</button>
            <button className="btn-secondary">格式转换</button>
            <button className="btn-secondary">左侧 → 右侧</button>
            <button className="btn-secondary">右侧 → 左侧</button>
            <button className="btn-secondary">清空</button>
          </div>
        </div>
      </div>
    </div>
  );
}
