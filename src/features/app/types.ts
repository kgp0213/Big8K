export type TabType = "home" | "mipi" | "fb" | "power" | "deploy" | "debug";
export type ConnectionType = "adb" | "ssh" | "disconnected";
export type LogLevel = "info" | "success" | "warning" | "error" | "debug";

export interface ConnectionStatus {
  type: ConnectionType;
  deviceId?: string;
  ip?: string;
  connected: boolean;
  screenResolution?: string;
  bitsPerPixel?: string;
  deviceModel?: string;
  mipiMode?: string;
  mipiLanes?: number;
  fb0Available?: boolean;
  vismpwrAvailable?: boolean;
  python3Available?: boolean;
}

export interface LogEntry {
  id: string;
  time: string;
  level: LogLevel;
  message: string;
}

export interface ConnectionContextType {
  connection: ConnectionStatus;
  setConnection: (conn: ConnectionStatus) => void;
  logs: LogEntry[];
  appendLog: (message: string, level?: LogLevel) => void;
  clearLogs: () => void;
  debugMode: boolean;
  setDebugMode: (value: boolean) => void;
}
