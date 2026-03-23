import { useState } from "react";
import { Cpu, BookOpen, Edit3, Save, RefreshCw, ArrowDownToLine } from "lucide-react";

export default function I2CTab() {
  const [selectedChannel, setSelectedChannel] = useState("i2c4m2");
  const [readResult, _setReadResult] = useState("");

  const channels = [
    { id: "i2c4m2", name: "I2C4M2 (PMIC)", desc: "电源管理IC" },
    { id: "i2c3m3", name: "I2C3M3 (ROM1)", desc: "ROM1存储" },
    { id: "i2c8m3", name: "I2C8M3 (ROM2)", desc: "ROM2存储" },
    { id: "edpiic", name: "EDP IIC", desc: "eDP接口" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* I2C通道选择 */}
        <div className="panel">
          <div className="panel-header flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            I2C通道
          </div>
          <div className="panel-body space-y-2">
            {channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setSelectedChannel(ch.id)}
                className={`w-full p-3 rounded-lg text-left transition-colors ${
                  selectedChannel === ch.id
                    ? "bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800"
                    : "bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <div className="font-medium text-sm">{ch.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{ch.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 读写操作 */}
        <div className="space-y-4">
          {/* 读操作 */}
          <div className="panel">
            <div className="panel-header flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              读取寄存器
            </div>
            <div className="panel-body space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    设备地址 (Hex)
                  </label>
                  <input type="text" defaultValue="50" className="input text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    寄存器地址 (Hex)
                  </label>
                  <input type="text" defaultValue="00" className="input text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  读取长度 (字节)
                </label>
                <input type="number" defaultValue="1" className="input text-sm" />
              </div>
              <button className="w-full btn-primary flex items-center justify-center gap-2">
                <ArrowDownToLine className="w-4 h-4" />
                读取
              </button>
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">读取结果:</div>
                <div className="font-mono text-sm">{readResult || "00 00 00 00"}</div>
              </div>
            </div>
          </div>

          {/* 写操作 */}
          <div className="panel">
            <div className="panel-header flex items-center gap-2">
              <Edit3 className="w-4 h-4" />
              写入寄存器
            </div>
            <div className="panel-body space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    设备地址 (Hex)
                  </label>
                  <input type="text" defaultValue="50" className="input text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    寄存器地址 (Hex)
                  </label>
                  <input type="text" defaultValue="00" className="input text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  写入数据 (Hex, 空格分隔)
                </label>
                <input type="text" placeholder="00 01 02..." className="input text-sm font-mono" />
              </div>
              <button className="w-full btn-success flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                写入
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* EEPROM操作 */}
      <div className="panel">
        <div className="panel-header">EEPROM操作</div>
        <div className="panel-body space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                配置文件
              </label>
              <div className="flex gap-2">
                <input type="text" placeholder="选择.bin配置文件..." className="input flex-1" />
                <button className="btn-secondary px-4">浏览</button>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary flex items-center gap-2">
              <Save className="w-4 h-4" />
              更新EEPROM
            </button>
            <button className="btn-secondary flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              读取EEPROM
            </button>
          </div>
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              注意：更新EEPROM后需要重启设备才能生效
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
