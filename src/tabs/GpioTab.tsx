import { useState } from "react";
import { Send, Download, Settings, RefreshCw } from "lucide-react";

export default function GpioTab() {
  const [sendValue, setSendValue] = useState("");
  const [receivedData, _setReceivedData] = useState<string[]>([
    "[2026-03-13 14:30:25] 收到: 0x55 0xAA",
    "[2026-03-13 14:30:26] 收到: 0x01 0x02 0x03",
  ]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* GPIO发送 */}
        <div className="panel">
          <div className="panel-header flex items-center gap-2">
            <Send className="w-4 h-4" />
            GPIO发送
          </div>
          <div className="panel-body space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                发送数据 (Hex)
              </label>
              <textarea
                value={sendValue}
                onChange={(e) => setSendValue(e.target.value)}
                className="input font-mono h-24 resize-none"
                placeholder="输入十六进制数据，如: 55 AA 01 02..."
              />
            </div>
            <div className="flex gap-2">
              <button className="flex-1 btn-primary flex items-center justify-center gap-2">
                <Send className="w-4 h-4" />
                发送
              </button>
              <button className="btn-secondary px-4">清空</button>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 btn-secondary text-sm py-1.5">发送0x55</button>
              <button className="flex-1 btn-secondary text-sm py-1.5">发送0xAA</button>
              <button className="flex-1 btn-secondary text-sm py-1.5">发送0xFF</button>
            </div>
          </div>
        </div>

        {/* GPIO接收 */}
        <div className="panel">
          <div className="panel-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              GPIO接收
            </div>
            <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="panel-body">
            <div className="h-48 overflow-auto bg-gray-900 rounded-lg p-3 font-mono text-sm">
              {receivedData.map((data, idx) => (
                <div key={idx} className="text-green-400 mb-1">
                  {data}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button className="flex-1 btn-secondary text-sm">开始监听</button>
              <button className="flex-1 btn-secondary text-sm">停止监听</button>
              <button className="btn-secondary px-3">清空</button>
            </div>
          </div>
        </div>
      </div>

      {/* GPIO配置 */}
      <div className="panel">
        <div className="panel-header flex items-center gap-2">
          <Settings className="w-4 h-4" />
          GPIO配置
        </div>
        <div className="panel-body">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                GPIO引脚
              </label>
              <select className="input">
                <option>GPIO0</option>
                <option>GPIO1</option>
                <option>GPIO2</option>
                <option>GPIO3</option>
                <option>GPIO4</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                方向
              </label>
              <select className="input">
                <option>输出</option>
                <option>输入</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                电平
              </label>
              <select className="input">
                <option>高电平</option>
                <option>低电平</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                上拉/下拉
              </label>
              <select className="input">
                <option>无</option>
                <option>上拉</option>
                <option>下拉</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="btn-primary">应用配置</button>
            <button className="btn-secondary">读取当前状态</button>
          </div>
        </div>
      </div>
    </div>
  );
}
