import { useState, createContext, useContext, useEffect, useMemo } from "react";
import { Monitor, Terminal, Image, Cpu, Wifi, FileCode, Activity, Moon, Sun, Home } from "lucide-react";
import ConnectionPanel from "./components/ConnectionPanel";
import HomeTab from "./tabs/HomeTab";
import StatusBar from "./components/StatusBar";
import MipiTab from "./tabs/MipiTab";
import FramebufferTab from "./tabs/FramebufferTab";
import I2CTab from "./tabs/I2CTab";
import GpioTab from "./tabs/GpioTab";
import ScriptTab from "./tabs/ScriptTab";
import NetworkTab from "./tabs/NetworkTab";
import DebugTab from "./tabs/DebugTab";

type TabType = "home" | "mipi" | "fb" | "i2c" | "gpio" | "script" | "network" | "debug";
type ConnectionType = "adb" | "ssh" | "disconnected";
type LogLevel = "info" | "success" | "warning" | "error" | "debug";

interface ConnectionStatus {
  type: ConnectionType;
  deviceId?: string;
  ip?: string;
  connected: boolean;
  screenResolution?: string;
  bitsPerPixel?: string;
  deviceModel?: string;
  fb0Available?: boolean;
  vismpwrAvailable?: boolean;
  python3Available?: boolean;
}

interface LogEntry {
  id: string;
  time: string;
  level: LogLevel;
  message: string;
}

interface ConnectionContextType {
  connection: ConnectionStatus;
  setConnection: (conn: ConnectionStatus) => void;
  logs: LogEntry[];
  appendLog: (message: string, level?: LogLevel) => void;
  clearLogs: () => void;
  debugMode: boolean;
  setDebugMode: (value: boolean) => void;
}

export const ConnectionContext = createContext<ConnectionContextType>({
  connection: { type: "disconnected", connected: false },
  setConnection: () => {},
  logs: [],
  appendLog: () => {},
  clearLogs: () => {},
  debugMode: false,
  setDebugMode: () => {},
});

export const useConnection = () => useContext(ConnectionContext);

const tabs = [
  { id: "mipi" as TabType, label: "点屏配置", icon: Monitor },
  { id: "fb" as TabType, label: "显示画面", icon: Image },
  { id: "debug" as TabType, label: "命令调试", icon: Terminal },
  { id: "i2c" as TabType, label: "I2C/GPIO", icon: Cpu },
  { id: "gpio" as TabType, label: "代码转换", icon: Activity },
  { id: "script" as TabType, label: "脚本管理", icon: FileCode },
  { id: "network" as TabType, label: "网络配置", icon: Wifi },
  { id: "home" as TabType, label: "总览", icon: Home },
];

function App() {
  const DESIGN_WIDTH = 1500;
  const DESIGN_HEIGHT = 900;

  const [activeTab, setActiveTab] = useState<TabType>("mipi");
  const [darkMode, setDarkMode] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [connection, setConnection] = useState<ConnectionStatus>({
    type: "disconnected",
    connected: false,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [debugMode, setDebugMode] = useState(false);

  const appendLog = (message: string, level: LogLevel = "info") => {
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    setLogs((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        time,
        level,
        message,
      },
    ]);
  };

  const clearLogs = () => setLogs([]);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const scale = useMemo(() => {
    const widthScale = viewportWidth / DESIGN_WIDTH;
    const heightScale = viewportHeight / DESIGN_HEIGHT;
    return Math.min(1, widthScale, heightScale);
  }, [viewportWidth, viewportHeight]);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark");
  };

  const renderTab = () => {
    switch (activeTab) {
      case "home":
        return <HomeTab />;
      case "mipi":
        return <MipiTab />;
      case "fb":
        return <FramebufferTab />;
      case "i2c":
        return <I2CTab />;
      case "gpio":
        return <GpioTab />;
      case "script":
        return <ScriptTab />;
      case "network":
        return <NetworkTab />;
      case "debug":
        return <DebugTab />;
      default:
        return <MipiTab />;
    }
  };

  return (
    <ConnectionContext.Provider value={{ connection, setConnection, logs, appendLog, clearLogs, debugMode, setDebugMode }}>
      <div className="h-screen overflow-hidden bg-gray-100 dark:bg-gray-950 flex items-start justify-center">
        <div
          className="origin-top"
          style={{
            width: `${DESIGN_WIDTH}px`,
            height: `${DESIGN_HEIGHT}px`,
            transform: `scale(${scale})`,
            marginTop: "8px",
          }}
        >
          <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-6 h-6 text-primary-600" />
                    <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Big8K OLED点屏调试-2026</h1>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    {darkMode ? <Sun className="w-5 h-5 text-gray-600 dark:text-gray-300" /> : <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />}
                  </button>
                </div>
              </div>
            </header>

            <div className="flex flex-1 min-h-0">
              <aside className="w-48 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
                <div className="py-2">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                          activeTab === tab.id
                            ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border-r-2 border-primary-600 dark:border-primary-400"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </aside>

              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto p-4 bg-gray-50 dark:bg-gray-900">{renderTab()}</div>
              </div>

              <aside className="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
                <ConnectionPanel logs={logs} clearLogs={clearLogs} />
              </aside>
            </div>

            <StatusBar />
          </div>
        </div>
      </div>
    </ConnectionContext.Provider>
  );
}

export default App;
