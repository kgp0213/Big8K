import { Check, Image, Search } from "lucide-react";
import type { ChangeEvent } from "react";

type LocalImageEntry = {
  id: string;
  name: string;
  path: string;
  realPath?: string;
  ext: string;
  width?: number;
  height?: number;
  previewUrl?: string;
};

type ImageSortMode = "name" | "mtime";
type ImageViewMode = "grid" | "list";

export function LocalBmpPanel(props: {
  fileInputId: string;
  onImageSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  onChooseImage: () => void;
  displayFullPath: string;
  folderImageEntries: LocalImageEntry[];
  filteredFolderImages: LocalImageEntry[];
  currentResolutionLabel?: string | null;
  imageSearch: string;
  onImageSearchChange: (value: string) => void;
  sortMode: ImageSortMode;
  onSortModeChange: (value: ImageSortMode) => void;
  viewMode: ImageViewMode;
  onViewModeChange: (value: ImageViewMode) => void;
  resolutionFilterEnabled: boolean;
  currentResolutionAvailable: boolean;
  onResolutionFilterChange: (checked: boolean) => void;
  selectedImagePath: string;
  isResolutionMatched: (item: LocalImageEntry) => boolean;
  onSelectImage: (path: string) => void;
  onDisplayImage: (path: string) => void;
}) {
  const {
    fileInputId,
    onImageSelected,
    onChooseImage,
    displayFullPath,
    folderImageEntries,
    filteredFolderImages,
    currentResolutionLabel,
    imageSearch,
    onImageSearchChange,
    sortMode,
    onSortModeChange,
    viewMode,
    onViewModeChange,
    resolutionFilterEnabled,
    currentResolutionAvailable,
    onResolutionFilterChange,
    selectedImagePath,
    isResolutionMatched,
    onSelectImage,
    onDisplayImage,
  } = props;

  return (
    <div className="space-y-4 min-w-0">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">步骤 1：选择 BMP</div>
          <button onClick={onChooseImage} className="btn-secondary flex items-center gap-2 shrink-0"><Image className="w-4 h-4" /> 选择 BMP</button>
        </div>
        <div>
          <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">当前图片完整路径</label>
          <input value={displayFullPath} readOnly className="input text-sm w-full" placeholder="先选择一个或多个 BMP 文件" title={displayFullPath} />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 overflow-hidden">
        <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              <Image className="w-4 h-4" /> 步骤 2：选择 BMP
              <span className="text-xs text-gray-400">共 {folderImageEntries.length} 张，当前显示 {filteredFolderImages.length} 张</span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{currentResolutionLabel ? `当前设备：${currentResolutionLabel}` : "当前设备分辨率未读取"}</div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_180px_180px] gap-3 items-center">
            <div className="relative min-w-0">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={imageSearch} onChange={(e) => onImageSearchChange(e.target.value)} className="input text-sm pl-9" placeholder="搜索文件名" />
            </div>
            <select value={sortMode} onChange={(e) => onSortModeChange(e.target.value as ImageSortMode)} className="input text-sm">
              <option value="name">按文件名</option>
              <option value="mtime">按修改时间</option>
            </select>
            <select value={viewMode} onChange={(e) => onViewModeChange(e.target.value as ImageViewMode)} className="input text-sm">
              <option value="grid">预览网格</option>
              <option value="list">紧凑列表</option>
            </select>
          </div>

          <label className={`inline-flex items-center gap-2 text-sm ${currentResolutionAvailable ? "text-gray-700 dark:text-gray-200" : "text-gray-400 cursor-not-allowed"}`}>
            <input type="checkbox" checked={resolutionFilterEnabled} disabled={!currentResolutionAvailable} onChange={(e) => onResolutionFilterChange(e.target.checked)} />
            适配分辨率
          </label>
        </div>

        <div className="max-h-[520px] overflow-auto p-3">
          <input id={fileInputId} type="file" accept=".bmp,image/bmp" multiple className="hidden" onChange={onImageSelected} />
          {folderImageEntries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">先点击“选择 BMP”，把需要上屏测试的 BMP 文件载入列表。</div>
          ) : filteredFolderImages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">当前筛选条件下没有匹配图片。</div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-3 gap-3">
              {filteredFolderImages.map((item) => {
                const selected = item.path === selectedImagePath;
                const matched = isResolutionMatched(item);
                return (
                  <button key={item.id} onClick={() => onSelectImage(item.path)} onDoubleClick={() => { onSelectImage(item.path); onDisplayImage(item.path); }} className={`group text-left rounded-xl border transition-all overflow-hidden ${selected ? "border-primary-500 ring-2 ring-primary-300/60 dark:ring-primary-700/40 bg-primary-50/70 dark:bg-primary-900/20" : matched ? "border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-900/30 hover:border-emerald-400 dark:hover:border-emerald-600" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 hover:border-primary-300 dark:hover:border-primary-700"}`} title={item.path}>
                    <div className="h-28 flex items-center justify-center bg-gradient-to-br from-gray-100 via-white to-gray-200 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 relative overflow-hidden">
                      {item.previewUrl ? <img src={item.previewUrl} alt={item.name} className="w-full h-full object-cover" /> : <Image className="w-8 h-8 text-gray-400" />}
                      {selected && <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center shadow-sm"><Check className="w-3 h-3" /></div>}
                    </div>
                    <div className="p-2.5 space-y-1.5">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{item.name}</div>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400">
                        <span className="uppercase tracking-wide">{item.ext.replace(".", "")}</span>
                        <span>{item.width && item.height ? `${item.width}×${item.height}` : "未读取尺寸"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${matched ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>{matched ? "适配分辨率" : "未适配"}</span>
                        <span className="text-[11px] text-gray-400">双击可直接显示</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFolderImages.map((item) => {
                const selected = item.path === selectedImagePath;
                const matched = isResolutionMatched(item);
                return (
                  <button key={item.id} onClick={() => onSelectImage(item.path)} onDoubleClick={() => { onSelectImage(item.path); onDisplayImage(item.path); }} className={`w-full text-left rounded-xl border px-3 py-2 transition-all ${selected ? "border-primary-500 ring-2 ring-primary-300/60 dark:ring-primary-700/40 bg-primary-50/70 dark:bg-primary-900/20" : matched ? "border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-900/30 hover:border-emerald-400 dark:hover:border-emerald-600" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 hover:border-primary-300 dark:hover:border-primary-700"}`} title={item.path}>
                    <div className="grid grid-cols-[minmax(0,1fr)_120px_90px_110px] gap-3 items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2"><span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{item.name}</span>{selected && <Check className="w-4 h-4 text-primary-600 shrink-0" />}</div>
                        <div className="text-[11px] text-gray-400 truncate">{item.path}</div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">{item.width && item.height ? `${item.width} × ${item.height}` : "未读取尺寸"}</div>
                      <div className="text-xs uppercase tracking-wide text-gray-400 text-center">{item.ext.replace(".", "")}</div>
                      <div className="text-center"><span className={`text-[11px] px-2 py-0.5 rounded-full ${matched ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>{matched ? "适配分辨率" : "未适配"}</span></div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
