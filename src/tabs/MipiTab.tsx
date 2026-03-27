import { useEffect, useMemo, useRef, useState } from "react";
import {
  Monitor,
  Upload,
  Download,
} from "lucide-react";
import { useConnection } from "../App";
import { tauriInvoke } from "../utils/tauri";
import {
  DEFAULT_DRIVER_CODE,
  defaultTiming,
  grayButtons,
  logicPatternOptions,
} from "../features/mipi/constants";
import { getLastLcdConfigPath, loadMipiRightEditor, loadRecentConfigs, saveMipiRightEditor, saveRecentConfig } from "../features/mipi/storage";
import RecentConfigMenu from "../features/mipi/RecentConfigMenu";
import QuickActionsPanel from "../features/mipi/QuickActionsPanel";
import TimingPanel from "../features/mipi/TimingPanel";
import DriverCodePanel from "../features/mipi/DriverCodePanel";
import {
  applyOledConfig,
  handleExportOledConfigJsonAction,
  handleGenerateConfigDownloadAction,
  handleLogicPatternAction,
  handleNormalizeToStandardAction,
  handleReadStatusAction,
  handleRightConvertibilityCheckAction,
  handleRuntimePatternAction,
  handleSendRightEditorAction,
  handleSimpleCommandAction,
  handleStandardToFormattedAction,
  handleFormattedToStandardAction,
  handleVismpwrCheckAction,
  parseDriverCodeLines,
} from "../features/mipi/actions";
import type {
  PatternResult,
  RecentLcdConfigItem,
  TimingConfig,
} from "../features/mipi/types";

export default function MipiTab() {
  const { appendLog, debugMode } = useConnection();
  const [driverCode, setDriverCode] = useState<string[]>(DEFAULT_DRIVER_CODE);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [rightEditorDraft, setRightEditorDraft] = useState(() => loadMipiRightEditor());
  const [driverCodeText, setDriverCodeText] = useState(DEFAULT_DRIVER_CODE.join("\n"));
  const [timing, setTiming] = useState<TimingConfig>(defaultTiming);
  const [showBasicSection, setShowBasicSection] = useState(false);
  const [selectedLogicPattern, setSelectedLogicPattern] = useState(0);
  const [recentConfigs, setRecentConfigs] = useState<RecentLcdConfigItem[]>([]);
  const [showRecentConfigs, setShowRecentConfigs] = useState(false);
  const recentConfigMenuRef = useRef<HTMLDivElement | null>(null);
  const recentConfigCloseTimerRef = useRef<number | null>(null);

  const updateTiming = <K extends keyof TimingConfig>(key: K, value: TimingConfig[K]) => {
    setTiming((prev) => ({ ...prev, [key]: value }));
  };

  const derived = useMemo(() => {
    const htotal = timing.hact + timing.hfp + timing.hbp + timing.hsync;
    const vtotal = timing.vact + timing.vfp + timing.vbp + timing.vsync;
    const fps = htotal > 0 && vtotal > 0 ? (timing.pclk * 1000) / htotal / vtotal : 0;
    return { htotal, vtotal, fps };
  }, [timing]);

  const syncDriverCodeText = (nextDriverCode: string[]) => {
    setDriverCode(nextDriverCode);
    setDriverCodeText(nextDriverCode.join("\n"));
  };

  const refreshRecentConfigs = () => {
    const next = loadRecentConfigs();
    setRecentConfigs(next);
    return next;
  };

  const persistRecentConfig = (path: string) => {
    const next = saveRecentConfig(path, recentConfigs);
    setRecentConfigs(next);
  };

  const scheduleRecentMenuClose = () => {
    if (recentConfigCloseTimerRef.current) {
      window.clearTimeout(recentConfigCloseTimerRef.current);
    }
    recentConfigCloseTimerRef.current = window.setTimeout(() => {
      setShowRecentConfigs(false);
      recentConfigCloseTimerRef.current = null;
    }, 150);
  };

  const cancelRecentMenuClose = () => {
    if (recentConfigCloseTimerRef.current) {
      window.clearTimeout(recentConfigCloseTimerRef.current);
      recentConfigCloseTimerRef.current = null;
    }
  };


  const handleLoadLcdConfig = async () => {
    try {
      const selectedPath = await tauriInvoke<string | null>("pick_lcd_config_file");
      if (!selectedPath) {
        appendLog("已取消打开 OLED 配置", "info");
        return;
      }
      await applyOledConfig(selectedPath, {
        expandBasicSection: true,
        syncRightEditor: true,
        setTiming,
        setShowBasicSection,
        syncDriverCodeText,
        setSelectedIndex,
        setEditValue: setRightEditorDraft,
        persistRecentConfig,
        appendLog,
      });
    } catch (error) {
      appendLog(`打开 OLED 配置失败: ${String(error)}`, "error");
    }
  };

  const handleLoadRecentConfig = async (path: string) => {
    try {
      await applyOledConfig(path, {
        expandBasicSection: true,
        syncRightEditor: true,
        setTiming,
        setShowBasicSection,
        syncDriverCodeText,
        setSelectedIndex,
        setEditValue: setRightEditorDraft,
        persistRecentConfig,
        appendLog,
      });
      setShowRecentConfigs(false);
    } catch (error) {
      appendLog(`加载历史 OLED 配置失败: ${String(error)}`, "error");
    }
  };

  useEffect(() => {
    const recent = refreshRecentConfigs();
    const lastPath = getLastLcdConfigPath();
    if (!lastPath) {
      return;
    }
    const existsInRecent = recent.some((item) => item.path === lastPath);
    if (!existsInRecent) {
      return;
    }
    void applyOledConfig(lastPath, {
      silent: true,
      expandBasicSection: false,
      syncRightEditor: false,
      setTiming,
      setShowBasicSection,
      syncDriverCodeText,
      setSelectedIndex,
      setEditValue: setRightEditorDraft,
      persistRecentConfig,
      appendLog,
    }).catch((error) => {
      appendLog(`自动加载上次 OLED 配置失败: ${String(error)}`, "warning");
    });
  }, []);

  useEffect(() => {
    if (!showRecentConfigs) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!recentConfigMenuRef.current) {
        return;
      }
      if (!recentConfigMenuRef.current.contains(event.target as Node)) {
        setShowRecentConfigs(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showRecentConfigs]);

  useEffect(() => {
    return () => {
      if (recentConfigCloseTimerRef.current) {
        window.clearTimeout(recentConfigCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    saveMipiRightEditor(rightEditorDraft);
  }, [rightEditorDraft]);

  const handleGenerateConfigDownload = async () => {
    await handleGenerateConfigDownloadAction(timing, driverCode, appendLog, debugMode);
  };

  const handleExportOledConfig = async () => {
    await handleExportOledConfigJsonAction(timing, driverCode, appendLog);
  };

  const handleFormattedToStandard = () => {
    handleFormattedToStandardAction(driverCodeText, setRightEditorDraft, appendLog);
  };

  const handleSendRightEditor = async () => {
    await handleSendRightEditorAction(rightEditorDraft, debugMode, appendLog);
  };

  const handleSolidColor = async (color: string, label: string) => {
    await handleRuntimePatternAction(`pure_${color}`, label, appendLog, debugMode);
  };

  const handleGray = async (value: number) => {
    appendLog(`显示画面 -> 灰阶 ${value}`, "info");
    if (debugMode) {
      appendLog(`-> adb shell python3 /vismm/fbshow/logicPictureShow.py ${value === 16 ? 31 : value === 32 ? 30 : value === 64 ? 29 : value === 128 ? 28 : 27}`, "debug");
    }
    const patternMap: Record<number, number> = { 16: 31, 32: 30, 64: 29, 128: 28, 192: 27, 224: 27 };
    const pattern = patternMap[value] ?? 27;
    const result = await tauriInvoke<PatternResult>("run_logic_pattern", { request: { pattern } });
    if (result.success) {
      appendLog(`显示完成 -> 灰阶 ${value}`, "success");
    } else {
      appendLog(result.error || result.message || `显示失败 -> 灰阶 ${value}`, "error");
    }
  };

  const handleSleepIn = async () => {
    await handleSimpleCommandAction("mipi_sleep_in", "执行关屏序列：28 / 10", "已执行关屏序列", "关屏序列执行失败", appendLog);
  };

  const handleSleepOut = async () => {
    await handleSimpleCommandAction("mipi_sleep_out", "执行开屏序列：11 / 29", "已执行开屏序列", "开屏序列执行失败", appendLog);
  };

  const handleSoftwareReset = async () => {
    await handleSimpleCommandAction(
      "mipi_software_reset",
      "任务开始 -> Software Reset (01)",
      "已执行 Software Reset (01)",
      "Software Reset 执行失败",
      appendLog,
      debugMode ? "-> adb shell vismpwr 05 00 01 01" : undefined,
    );
  };

  const handleReadStatus = async () => {
    await handleReadStatusAction(appendLog);
  };

  const handleGrayPattern = async () => {
    await handleRuntimePatternAction("gray_gradient", "灰阶渐变", appendLog, debugMode);
  };

  const showLogicPattern = async (pattern: number) => {
    const current = logicPatternOptions.find((item) => item.value === pattern);
    await handleLogicPatternAction(pattern, current?.label || String(pattern), appendLog, debugMode);
  };

  return (
    <div className="space-y-4">
      <div className="panel">
        <div className="panel-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4" />
            屏参配置（Timing / DSC）
          </div>
          <div className="flex flex-wrap items-stretch gap-3">
            <div
              ref={recentConfigMenuRef}
            >
              <RecentConfigMenu
                recentConfigs={recentConfigs}
                showRecentConfigs={showRecentConfigs}
                onToggle={() => setShowRecentConfigs((prev) => !prev)}
                onLoadRecentConfig={handleLoadRecentConfig}
                onMouseEnter={cancelRecentMenuClose}
                onMouseLeave={scheduleRecentMenuClose}
              />
            </div>
            <button
              onClick={handleLoadLcdConfig}
              className="inline-flex h-10 min-h-10 items-center gap-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 px-4 text-sm font-medium text-blue-700 dark:text-blue-300 transition-colors align-middle"
            >
              <Download className="w-4 h-4" />
              打开 OLED 配置
            </button>
            <button
              onClick={handleExportOledConfig}
              className="inline-flex h-10 min-h-10 items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 px-4 text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors align-middle"
            >
              <Upload className="w-4 h-4" />
              导出 OLED 配置(JSON)
            </button>
          </div>
        </div>
        <div className="panel-body space-y-3">
          <TimingPanel
            timing={timing}
            showBasicSection={showBasicSection}
            derived={derived}
            onToggleBasicSection={() => setShowBasicSection((prev) => !prev)}
            onUpdateTiming={updateTiming}
          />

          <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-4 items-start max-w-[1180px]">
            <DriverCodePanel
              driverCodeText={driverCodeText}
              editValue={rightEditorDraft}
              onDriverCodeTextChange={(text) => {
                setDriverCodeText(text);
                const parsed = parseDriverCodeLines(text);
                setDriverCode(parsed);
                if (parsed.length > 0) {
                  const nextIndex = Math.min(selectedIndex, parsed.length - 1);
                  setSelectedIndex(nextIndex);
                } else {
                  setSelectedIndex(0);
                }
              }}
              onEditValueChange={setRightEditorDraft}
              onSendRightEditor={handleSendRightEditor}
              onVismpwrCheck={() =>
                handleVismpwrCheckAction(
                  driverCodeText,
                  selectedIndex,
                  syncDriverCodeText,
                  setSelectedIndex,
                  appendLog,
                )
              }
              onFormattedToStandard={handleFormattedToStandard}
              onGenerateConfigDownload={handleGenerateConfigDownload}
              onStandardToFormatted={() =>
                handleStandardToFormattedAction(rightEditorDraft, syncDriverCodeText, setDriverCode, setSelectedIndex, appendLog)
              }
              onRightConvertibilityCheck={() => handleRightConvertibilityCheckAction(rightEditorDraft, appendLog)}
              onNormalizeToStandard={() => handleNormalizeToStandardAction(rightEditorDraft, setRightEditorDraft, appendLog)}
            />

            <div className="space-y-4">
              <QuickActionsPanel
                grayButtons={grayButtons}
                selectedLogicPattern={selectedLogicPattern}
                logicPatternOptions={logicPatternOptions}
                onSelectLogicPattern={async (next) => {
                  setSelectedLogicPattern(next);
                  await showLogicPattern(next);
                }}
                onSolidColor={handleSolidColor}
                onGray={handleGray}
                onGrayPattern={handleGrayPattern}
                onSleepIn={handleSleepIn}
                onSleepOut={handleSleepOut}
                onSoftwareReset={handleSoftwareReset}
                onReadStatus={handleReadStatus}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
