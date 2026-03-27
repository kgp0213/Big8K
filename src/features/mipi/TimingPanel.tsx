import type { TimingConfig } from "./types";

type Props = {
  timing: TimingConfig;
  showBasicSection: boolean;
  derived: { htotal: number; vtotal: number; fps: number };
  onToggleBasicSection: () => void;
  onUpdateTiming: <K extends keyof TimingConfig>(key: K, value: TimingConfig[K]) => void;
};

export default function TimingPanel({
  timing,
  showBasicSection,
  derived,
  onToggleBasicSection,
  onUpdateTiming,
}: Props) {
  const timingField = (label: string, key: keyof TimingConfig, type: "number" | "text" = "number") => (
    <div>
      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={String(timing[key])}
        onChange={(e) => {
          const value = type === "number" ? Number(e.target.value) : e.target.value;
          onUpdateTiming(key, value as TimingConfig[typeof key]);
        }}
        className="input text-sm py-1.5"
      />
    </div>
  );

  const radioOption = <K extends keyof TimingConfig>(key: K, value: string, label: string) => (
    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
      <input type="radio" name={String(key)} checked={String(timing[key]) === value} onChange={() => onUpdateTiming(key, value as TimingConfig[K])} />
      {label}
    </label>
  );

  return (
    <>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3 bg-white/80 dark:bg-gray-900/20 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
          <div className="font-semibold text-sm text-gray-800 dark:text-gray-100">基础参数</div>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleBasicSection}
              className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
            >
              {showBasicSection ? "隐藏" : "展开"}
            </button>
            <div className="text-xs text-gray-400">Timing</div>
          </div>
        </div>
        {showBasicSection && (
          <>
            <div className="grid grid-cols-4 gap-3">
              {timingField("HACT", "hact")}
              {timingField("HFP", "hfp")}
              {timingField("HBP", "hbp")}
              {timingField("HSW", "hsync")}
            </div>
            <div className="grid grid-cols-4 gap-3">
              {timingField("VACT", "vact")}
              {timingField("VFP", "vfp")}
              {timingField("VBP", "vbp")}
              {timingField("VSW", "vsync")}
            </div>
            <div className="grid grid-cols-6 gap-3">
              {timingField("PCLK (kHz)", "pclk")}
              {timingField("Lanes", "lanes")}
              {timingField("Format", "format", "text")}
              {timingField("PHY Mode", "phyMode", "text")}
              <div />
              <div />
            </div>
            <div className="grid grid-cols-7 gap-3 items-start">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Interface</label>
                <div className="flex flex-wrap gap-3">{radioOption("interfaceType", "MIPI", "MIPI")}</div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">MIPI Mode</label>
                <div className="flex flex-col gap-1">
                  {radioOption("mipiMode", "Video", "Video")}
                  {radioOption("mipiMode", "Command", "CMD")}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Video Type</label>
                <div className="flex flex-col gap-1">
                  {radioOption("videoType", "NON_BURST_SYNC_PULSES", "Sync Pulses")}
                  {radioOption("videoType", "NON_BURST_SYNC_EVENTS", "Sync Events")}
                  {radioOption("videoType", "BURST_MODE", "TYPE_BURST")}
                </div>
              </div>
              <div className="col-span-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 px-4 py-3 mt-2 max-w-[520px]">
                <div className="grid grid-cols-3 gap-4 items-start">
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={timing.dePolarity} onChange={(e) => onUpdateTiming("dePolarity", e.target.checked)} />
                      DE Pol
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={timing.clkPolarity} onChange={(e) => onUpdateTiming("clkPolarity", e.target.checked)} />
                      CLK Pol
                    </label>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={timing.vsPolarity} onChange={(e) => onUpdateTiming("vsPolarity", e.target.checked)} />
                      VS Pol
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={timing.hsPolarity} onChange={(e) => onUpdateTiming("hsPolarity", e.target.checked)} />
                      HS Pol
                    </label>
                  </div>
                  <div className="flex flex-col gap-2 min-w-[220px]">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={timing.dualChannel} onChange={(e) => onUpdateTiming("dualChannel", e.target.checked)} />
                      Dual Channel
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={timing.scramblingEnable} onChange={(e) => onUpdateTiming("scramblingEnable", e.target.checked)} />
                      Scrambling
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-6 min-w-[160px]">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={timing.dataSwap} onChange={(e) => onUpdateTiming("dataSwap", e.target.checked)} />
                  DataSwap
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={timing.dscEnable} onChange={(e) => onUpdateTiming("dscEnable", e.target.checked)} />
                  启用DSC
                </label>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 text-sm font-medium text-gray-800 dark:text-gray-100 bg-gray-100 dark:bg-gray-800/70 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700">
              <div>HTotal: {derived.htotal}</div>
              <div>VTotal: {derived.vtotal}</div>
              <div>FPS: {derived.fps.toFixed(2)}</div>
              <div>Resolution: {timing.hact} × {timing.vact}</div>
            </div>
          </>
        )}
      </div>

      {showBasicSection && timing.dscEnable && (
        <div className="panel">
          <div className="panel-header">VESA DSC</div>
          <div className="panel-body grid grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">DSC Version</label>
              <div className="flex items-center gap-4 h-[38px]">
                {radioOption("dscVersion", "Ver1.1", "Ver1.1")}
                {radioOption("dscVersion", "Vesa1.2", "Ver1.2")}
              </div>
            </div>
            {timingField("Slice Width", "sliceWidth")}
            {timingField("Slice Height", "sliceHeight")}
          </div>
        </div>
      )}
    </>
  );
}
