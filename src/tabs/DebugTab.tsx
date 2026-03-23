import { useState } from "react";
import { Terminal, Send, Trash2, Copy, Download } from "lucide-react";

export default function DebugTab() {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>([
    "> vismpwr 05 00 01 28",
    "< OK",
    "> cat /proc/chenfeng_mipi/chenfeng_mipi",
    "< 01 02 03 04 05 06 07 08",
    "> ls -la /vismm/fbshow/",
    "< total 128",
    "< drwxr-xr-x 2 root root 4096 Mar 13 14:30 .",
    "< drwxr-xr-x 5 root root 4096 Mar 13 14:30 ..",
    "< -rwxr-xr-x 1 root root 24576 Mar 13 14:30 fbShowBmp",
  ]);

  const handleSend = () => {
    if (command.trim()) {
      setHistory([...history, `> ${command}`]);
      setCommand("");
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* 命令历史 */}
      <div className="panel flex-1">
        <div className="panel-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            命令输出
          </div>
          <div className="flex gap-1">
            <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="复制">
              <Copy className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="导出">
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => setHistory([])}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600"
              title="清空"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="panel-body p-0">
          <div className="h-96 overflow-auto bg-gray-900 p-4 font-mono text-sm">
            {history.length === 0 ? (
              <div className="text-gray-500">等待命令...</div>
            ) : (
              history.map((line, idx) => (
                <div
                  key={idx}
                  className={`mb-1 ${
                    line.startsWith(">")
                      ? "text-green-400"
                      : line.startsWith("<")
                      ? "text-blue-400"
                      : "text-gray-300"
                  }`}
                >
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 命令输入 */}
      <div className="panel">
        <div className="panel-body">
          <div className="flex gap-2">
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="input font-mono flex-1"
              placeholder="输入命令..."
            />
            <button
              onClick={handleSend}
              className="btn-primary flex items-center gap-2 px-6"
            >
              <Send className="w-4 h-4" />
              发送
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 py-1">快捷命令:</span>
            {[
              "vismpwr 05 00 01 28",
              "vismpwr 05 00 01 10",
              "vismpwr 05 00 01 11",
              "vismpwr 05 00 01 29",
              "cat /proc/chenfeng_mipi/chenfeng_mipi",
              "ls -la /vismm/fbshow/",
              "reboot",
            ].map((cmd) => (
              <button
                key={cmd}
                onClick={() => setCommand(cmd)}
                className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              >
                {cmd.length > 25 ? cmd.slice(0, 25) + "..." : cmd}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
