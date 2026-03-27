type LogEntry = { id: string; time: string; level: "info" | "success" | "warning" | "error" | "debug"; message: string };

type Props = {
  logs: LogEntry[];
  debugMode: boolean;
  onDebugModeChange: (value: boolean) => void;
  onClearLogs: () => void;
  logContainerRef: React.RefObject<HTMLDivElement | null>;
};

export default function LogPanel({ logs, debugMode, onDebugModeChange, onClearLogs, logContainerRef }: Props) {
  return (
    <div className="panel">
      <div className="panel-header flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span>执行日志</span>
          <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap select-none">
            <input type="checkbox" checked={debugMode} onChange={(e) => onDebugModeChange(e.target.checked)} />
            调试模式
          </label>
        </div>
        <button onClick={onClearLogs} className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          清空日志
        </button>
      </div>
      <div className="panel-body">
        <div ref={logContainerRef} className="space-y-1 overflow-auto max-h-56 text-xs">
          {logs.length === 0 ? (
            <div className="text-gray-400">暂无日志，后续 ADB / SSH / 屏幕操作会显示在这里。</div>
          ) : (
            logs.slice(-30).map((log) => (
              <div key={log.id} className="flex gap-2 font-mono">
                <span className="text-gray-400">[{log.time}]</span>
                <span
                  className={
                    log.level === "error"
                      ? "text-red-500"
                      : log.level === "warning"
                        ? "text-yellow-600"
                        : log.level === "success"
                          ? "text-green-600"
                          : log.level === "debug"
                            ? "text-blue-600 dark:text-blue-300"
                            : "text-gray-700 dark:text-gray-200"
                  }
                >
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
