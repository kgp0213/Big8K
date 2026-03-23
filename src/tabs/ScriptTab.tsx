import { Play, Save, Upload, RefreshCw, FileCode, Clock3, Download } from "lucide-react";

export default function ScriptTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 panel">
          <div className="panel-header flex items-center gap-2">
            <FileCode className="w-4 h-4" />
            脚本工作区
          </div>
          <div className="panel-body space-y-3">
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 8 }, (_, i) => (
                <button key={i} className="text-left rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:border-primary-500 hover:bg-primary-50/40 dark:hover:bg-primary-900/10 transition-colors">
                  <div className="font-medium text-sm">脚本槽位 {i + 1}</div>
                  <div className="text-xs text-gray-500 mt-1">保留原 C# 上位机的脚本槽位工作流</div>
                </button>
              ))}
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">脚本内容</label>
              <textarea className="input min-h-[220px] font-mono text-sm resize-none" placeholder="# 这里编辑要下发到设备的脚本内容\n# 后续会接运行、同步、自启、日志导出" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel">
            <div className="panel-header">脚本操作</div>
            <div className="panel-body space-y-2">
              <button className="w-full btn-primary flex items-center justify-center gap-2">
                <Play className="w-4 h-4" />
                运行脚本
              </button>
              <button className="w-full btn-secondary flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" />
                上传脚本
              </button>
              <button className="w-full btn-secondary flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4" />
                脚本同步
              </button>
              <button className="w-full btn-secondary flex items-center justify-center gap-2">
                <Clock3 className="w-4 h-4" />
                设置自启
              </button>
              <button className="w-full btn-secondary flex items-center justify-center gap-2">
                <Download className="w-4 h-4" />
                导出日志
              </button>
              <button className="w-full btn-secondary flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                保存本地
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">说明</div>
            <div className="panel-body text-sm text-gray-600 dark:text-gray-300 space-y-2">
              <p>· 这里按原 C# 上位机的“脚本编辑 / 运行 / 同步 / 自启”工作流预留。</p>
              <p>· 先把 UI 位置和操作路径占住，后续再逐个接通真功能。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
