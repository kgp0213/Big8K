import { useState, createContext, useContext, useEffect, useMemo } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import ConnectionPanel from "./components/ConnectionPanel";
import HomeTab from "./tabs/HomeTab";
import StatusBar from "./components/StatusBar";
import MipiTab from "./tabs/MipiTab";
import FramebufferTab from "./tabs/FramebufferTab";
import PowerRailsTab from "./tabs/PowerRailsTab";
import DeployTab from "./tabs/DeployTab";
import DebugTab from "./tabs/DebugTab";
import { tabs } from "./features/app/tabs";
import { isTauri } from "./utils/tauri";
import type { ConnectionContextType, ConnectionStatus, LogEntry, LogLevel, TabType } from "./features/app/types";

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

function App() {
  const DESIGN_WIDTH = 1500;
  const DESIGN_HEIGHT = 900;
  const browserPreview = !isTauri();

  const [activeTab, setActiveTab] = useState<TabType>(browserPreview ? "home" : "mipi");
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

  useEffect(() => {
    if (!browserPreview) return;

    appendLog("当前为浏览器预览模式：已启用 UI 演示与安全降级。", "info");
    appendLog("ADB / SSH / Tauri 指令不会真正下发到设备，可先查看界面布局与交互。", "warning");
  }, [browserPreview]);

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
      case "power":
        return <PowerRailsTab />;
      case "deploy":
        return <DeployTab />;
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
                  {browserPreview && (
                    <div className="hidden md:flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-300">
                      Browser Preview
                    </div>
                  )}
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
                      <div key={tab.id}>
                        {tab.id === "fb" && (
                          <div className="mx-4 my-2 border-t border-gray-200/80 dark:border-gray-700/80" />
                        )}
                        <button
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
                      </div>
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
