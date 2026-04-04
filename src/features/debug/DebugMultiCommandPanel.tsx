import { Send } from "lucide-react";

type Props = {
  commands: string[];
  onChange: (index: number, value: string) => void;
  onCheck: (index: number) => void;
  onSend: (index: number) => void;
};

export default function DebugMultiCommandPanel({ commands, onChange, onCheck, onSend }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4 items-start">
        {commands.map((value, index) => (
          <div key={index} className="space-y-2">
            <textarea
              value={value}
              onChange={(e) => onChange(index, e.target.value)}
              className="input font-mono text-sm min-h-[440px] whitespace-pre overflow-x-auto resize-none"
              placeholder={`窗口 ${index + 1} 命令`}
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={() => onCheck(index)}
                className="btn-secondary flex items-center justify-center gap-2"
              >
                代码检查
              </button>
              <button
                onClick={() => onSend(index)}
                className="btn-primary flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                代码下发
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
