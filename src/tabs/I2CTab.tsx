import { useMemo, useState } from "react";
import { Cpu, BookOpen, Edit3, Zap, RefreshCw, Download, Activity } from "lucide-react";
import { tauriInvoke } from "../utils/tauri";
import { useConnection } from "../App";

type RailTone = "ok" | "warn";
type RailGroup = "logic" | "analog" | "gate";

interface PowerRail {
  name: string;
  addr: string;
  voltage: number;
  current: number | null;
  power_mw?: number | null;
  tone: RailTone;
  group: RailGroup;
  status?: string;
  gain_mode?: string | null;
  note?: string | null;
}

interface PowerRailReading {
  name: string;
  addr: string;
  voltage: number;
  current_ma: number | null;
  power_mw: number | null;
  status: string;
  gain_mode?: string | null;
  note?: string | null;
}

interface PowerRailsResult {
  success: boolean;
  rails: PowerRailReading[];
  total_power_mw?: number | null;
  error?: string;
}

const groupMap: Record<string, RailGroup> = {
  VCI: "logic",
  VDDIO: "logic",
  DVDD: "logic",
  AVDD: "analog",
  ELVDD: "analog",
  ELVSS: "analog",
  VGH: "gate",
  VGL: "gate",
};

export default function I2CTab() {
  const { appendLog, debugMode } = useConnection();
  const [selectedChannel, setSelectedChannel] = useState("i2c4m2");
  const [readResult, _setReadResult] = useState("");
  const [lastRefreshTime, setLastRefreshTime] = useState("未读取");
  const [reading, setReading] = useState(false);
  const [powerRails, setPowerRails] = useState<PowerRail[]>([
    { name: "VCI", addr: "0x41", voltage: 0, current: null, power_mw: null, tone: "warn", group: "logic", status: "待读取" },
    { name: "VDDIO", addr: "0x45", voltage: 0, current: null, power_mw: null, tone: "warn", group: "logic", status: "待读取" },
    { name: "DVDD", addr: "0x48", voltage: 0, current: null, power_mw: null, tone: "ok", group: "logic", status: "待读取" },
    { name: "AVDD", addr: "0x44", voltage: 0, current: null, power_mw: null, tone: "ok", group: "analog", status: "待读取" },
    { name: "ELVDD", addr: "0x40", voltage: 0, current: null, power_mw: null, tone: "ok", group: "analog", status: "待读取" },
    { name: "ELVSS", addr: "0x46", voltage: 0, current: null, power_mw: null, tone: "ok", group: "analog", status: "待读取" },
    { name: "VGH", addr: "0x4C", voltage: 0, current: null, power_mw: null, tone: "ok", group: "gate", status: "待读取" },
    { name: "VGL", addr: "0x4A", voltage: 0, current: null, power_mw: null, tone: "ok", group: "gate", status: "待读取" },
  ]);
  const [totalPowerMw, setTotalPowerMw] = useState<number>(0);

  const channels = [
    { id: "i2c4m2", name: "I2C4M2 (PMIC)", desc: "电源管理IC" },
    { id: "i2c3m3", name: "I2C3M3", desc: "通用I2C设备" },
    { id: "i2c8m3", name: "I2C8M3", desc: "通用I2C设备" },
    { id: "edpiic", name: "EDP IIC", desc: "eDP接口" },
  ];

  const handleReadAll = async () => {
    appendLog("任务开始 -> 读取全部电源轨", "info");
    if (debugMode) {
      appendLog("-> adb shell python3 [inline] read_power_rails", "debug");
    }
    setReading(true);
    try {
      const result = await tauriInvoke<PowerRailsResult>("read_power_rails");
      if (!result.success) {
        appendLog(result.error || "读取电源轨失败", "error");
        return;
      }
      const nextRails: PowerRail[] = result.rails.map((rail) => ({
        name: rail.name,
        addr: rail.addr,
        voltage: rail.voltage,
        current: rail.current_ma,
        power_mw: rail.power_mw,
        tone: rail.status.includes("饱和") || rail.status.includes("待") ? "warn" : "ok",
        group: groupMap[rail.name] || "logic",
        status: rail.status,
        gain_mode: rail.gain_mode,
        note: rail.note,
      }));
      setPowerRails(nextRails);
      setTotalPowerMw(result.total_power_mw || 0);
      const now = new Date().toLocaleString("zh-CN", { hour12: false });
      setLastRefreshTime(now);
      appendLog(`执行完成 -> 读取全部电源轨`, "success");
    } catch (error) {
      appendLog(`读取电源轨异常: ${String(error)}`, "error");
    } finally {
      setReading(false);
    }
  };

  const summary = useMemo(() => {
    const total = powerRails.length;
    const abnormal = powerRails.filter((item) => item.tone === "warn").length;
    return { total, abnormal, totalPowerMw };
  }, [powerRails, totalPowerMw]);

  const groupedRails = useMemo(() => {
    return {
      logic: powerRails.filter((rail) => rail.group === "logic"),
      analog: powerRails.filter((rail) => rail.group === "analog"),
      gate: powerRails.filter((rail) => rail.group === "gate"),
    };
  }, [powerRails]);

  const groupMeta: Record<RailGroup, { title: string; desc: string; badgeClass: string; borderClass: string }> = {
    logic: {
      title: "逻辑电源",
      desc: "VCI / VDDIO / DVDD",
      badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
      borderClass: "border-l-4 border-blue-400",
    },
    analog: {
      title: "模拟电源",
      desc: "AVDD / ELVDD / ELVSS",
      badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
      borderClass: "border-l-4 border-purple-400",
    },
    gate: {
      title: "栅极电源",
      desc: "VGH / VGL",
      badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
      borderClass: "border-l-4 border-emerald-400",
    },
  };

  const groupPower = useMemo(() => {
    const calc = (group: RailGroup) =>
      powerRails
        .filter((rail) => rail.group === group && rail.power_mw != null)
        .reduce((sum, rail) => sum + (rail.power_mw ?? 0), 0);
    return {
      logic: calc("logic"),
      analog: calc("analog"),
      gate: calc("gate"),
    };
  }, [powerRails]);

  const renderRailCard = (rail: PowerRail) => (
    <div key={rail.name} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-900/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-sm text-gray-800 dark:text-gray-100">{rail.name}</div>
          <div className="text-xs font-mono text-gray-500 dark:text-gray-400">地址 {rail.addr}</div>
        </div>
        <span
          className={`px-2 py-0.5 text-[11px] rounded-full ${
            rail.tone === "warn"
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
          }`}
        >
          {rail.status || (rail.tone === "warn" ? "待确认" : "正常")}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400">电压</div>
          <div className="mt-1 font-medium text-gray-800 dark:text-gray-100">{rail.voltage.toFixed(3)} V</div>
        </div>
        <div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400">电流</div>
          <div className="mt-1 font-medium text-gray-800 dark:text-gray-100">{rail.current == null ? "—" : `${rail.current.toFixed(1)} mA`}</div>
        </div>
        <div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400">功耗</div>
          <div className="mt-1 font-medium text-gray-800 dark:text-gray-100">{rail.power_mw == null ? "—" : `${rail.power_mw.toFixed(1)} mW`}</div>
        </div>
      </div>
      {(rail.gain_mode || rail.note) && (
        <div className="mt-3 space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
          {rail.gain_mode && <div>采样模式：{rail.gain_mode}</div>}
          {rail.note && <div>{rail.note}</div>}
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <button className="btn-secondary text-xs px-2 py-1">刷新</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-4">
        <div className="space-y-4">
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

          <div className="panel">
            <div className="panel-header flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              读取寄存器
            </div>
            <div className="panel-body space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">设备地址 (Hex)</label>
                  <input type="text" defaultValue="50" className="input text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">寄存器地址 (Hex)</label>
                  <input type="text" defaultValue="00" className="input text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">读取长度 (字节)</label>
                <input type="number" defaultValue="1" className="input text-sm" />
              </div>
              <button className="w-full btn-primary flex items-center justify-center gap-2">读取</button>
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">读取结果</div>
                <div className="font-mono text-sm">{readResult || "00 00 00 00"}</div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header flex items-center gap-2">
              <Edit3 className="w-4 h-4" />
              写入寄存器
            </div>
            <div className="panel-body space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">设备地址 (Hex)</label>
                  <input type="text" defaultValue="50" className="input text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">寄存器地址 (Hex)</label>
                  <input type="text" defaultValue="00" className="input text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">写入数据 (Hex, 空格分隔)</label>
                <input type="text" placeholder="00 01 02..." className="input text-sm font-mono" />
              </div>
              <button className="w-full btn-success flex items-center justify-center gap-2">写入</button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel ring-1 ring-primary-200/60 dark:ring-primary-900/40">
            <div className="panel-header flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                电源检测面板
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">最近刷新：{lastRefreshTime}</span>
                <button onClick={handleReadAll} disabled={reading} className="btn-secondary text-sm flex items-center gap-2 px-3 py-1.5">
                  <RefreshCw className={`w-4 h-4 ${reading ? "animate-spin" : ""}`} />
                  {reading ? "读取中..." : "读取全部"}
                </button>
                <button className="btn-secondary text-sm flex items-center gap-2 px-3 py-1.5">
                  <Download className="w-4 h-4" />
                  导出数据
                </button>
              </div>
            </div>
            <div className="panel-body space-y-4">
              <div className="grid grid-cols-5 gap-3">
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-3 bg-gray-50/70 dark:bg-gray-800/60">
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">电源轨总数</div>
                  <div className="mt-1 text-lg font-semibold text-gray-800 dark:text-gray-100">{summary.total}</div>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-3 bg-gray-50/70 dark:bg-gray-800/60">
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">异常/待确认</div>
                  <div className="mt-1 text-lg font-semibold text-amber-600 dark:text-amber-300">{summary.abnormal}</div>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-3 bg-gray-50/70 dark:bg-gray-800/60">
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">当前总线</div>
                  <div className="mt-1 text-lg font-semibold text-gray-800 dark:text-gray-100">{selectedChannel.toUpperCase()}</div>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-3 bg-gray-50/70 dark:bg-gray-800/60">
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">显示状态</div>
                  <div className="mt-1 text-lg font-semibold text-green-600 dark:text-green-300">已读通</div>
                </div>
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 px-3 py-3 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 ring-1 ring-amber-300/40 dark:ring-amber-700/40 shadow-sm">
                  <div className="text-[11px] text-amber-700 dark:text-amber-300">总功耗</div>
                  <div className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-200">{summary.totalPowerMw.toFixed(1)} mW</div>
                </div>
              </div>

              {(Object.keys(groupedRails) as RailGroup[]).map((groupKey) => (
                <div key={groupKey} className={`space-y-3 rounded-2xl border border-gray-200 dark:border-gray-700 p-3 ${groupMeta[groupKey].borderClass} bg-gray-50/30 dark:bg-gray-900/20`}>
                  <div className="flex items-end justify-between gap-3 border-b border-gray-200 dark:border-gray-700 pb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{groupMeta[groupKey].title}</div>
                        <span className={`px-2 py-0.5 text-[11px] rounded-full ${groupMeta[groupKey].badgeClass}`}>{groupMeta[groupKey].desc}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-gray-400">{groupedRails[groupKey].length} 项</div>
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-300">组内功耗：{groupPower[groupKey].toFixed(1)} mW</div>
                    </div>
                  </div>
                  <div className={`grid gap-3 ${groupKey === "gate" ? "grid-cols-2" : "grid-cols-3"}`}>
                    {groupedRails[groupKey].map(renderRailCard)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header flex items-center gap-2">
              <Activity className="w-4 h-4" />
              GPIO配置
            </div>
            <div className="panel-body space-y-3">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">GPIO引脚</label>
                  <select className="input text-sm">
                    <option>GPIO0</option>
                    <option>GPIO1</option>
                    <option>GPIO2</option>
                    <option>GPIO3</option>
                    <option>GPIO4</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">方向</label>
                  <select className="input text-sm">
                    <option>输出</option>
                    <option>输入</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">电平</label>
                  <select className="input text-sm">
                    <option>高电平</option>
                    <option>低电平</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">上拉/下拉</label>
                  <select className="input text-sm">
                    <option>无</option>
                    <option>上拉</option>
                    <option>下拉</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary text-sm px-3 py-1.5">应用配置</button>
                <button className="btn-secondary text-sm px-3 py-1.5">读取当前状态</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
