import { useEffect, useState } from "react";
import { AlertCircle, Clock, HardDrive, Usb, Wifi, Link2 } from "lucide-react";
import { useConnection } from "../App";

export default function StatusBar() {
  const { connection } = useConnection();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("zh-CN", { hour12: false });
  };

  const adbActive = connection.type === "adb" && connection.connected;
  const sshActive = connection.type === "ssh" && connection.connected;

  const overallInfo = (() => {
    if (!connection.connected) {
      return {
        icon: null,
        text: "",
        color: "text-red-500",
      };
    }

    if (connection.type === "adb") {
      return {
        icon: <Link2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />,
        text: `当前链路：ADB · ${connection.deviceId || "已连接"}`,
        color: "text-green-600 dark:text-green-400",
      };
    }

    return {
      icon: <Link2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />,
      text: `当前链路：SSH · ${connection.ip || "已连接"}`,
      color: "text-blue-600 dark:text-blue-400",
    };
  })();

  return (
    <footer className="h-10 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-center px-4 text-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <HardDrive className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          <span className="text-gray-700 dark:text-gray-300">8K点屏调试平台</span>
        </div>

        {overallInfo.text ? (
          <div className="flex items-center gap-1">
            {overallInfo.icon}
            <span className={overallInfo.color}>{overallInfo.text}</span>
          </div>
        ) : null}

        <div className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 bg-gray-100 dark:bg-gray-700/70">
          <Usb className={`w-4 h-4 ${adbActive ? "text-green-600 dark:text-green-400" : "text-gray-400"}`} />
          <span className={adbActive ? "text-green-600 dark:text-green-400" : "text-gray-600 dark:text-gray-400"}>
            {adbActive ? `ADB ${connection.deviceId || "在线"}` : "ADB 未连接"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 bg-gray-100 dark:bg-gray-700/70">
          <Wifi className={`w-4 h-4 ${sshActive ? "text-blue-600 dark:text-blue-400" : "text-gray-400"}`} />
          <span className={sshActive ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"}>
            {sshActive ? `SSH ${connection.ip || "在线"}` : "SSH 未连接"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <AlertCircle className={`w-3.5 h-3.5 ${connection.connected ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"}`} />
          <span className="text-gray-700 dark:text-gray-300">{connection.connected ? "链路已就绪" : "等待连接"}</span>
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-500 dark:text-gray-400">{formatTime(time)}</span>
        </div>

        <span className="text-gray-400">v1.0.0</span>
      </div>
    </footer>
  );
}
