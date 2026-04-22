export interface AdbDevice {
  id: string;
  status: string;
  product?: string;
  model?: string;
  transport_id?: string;
}

export interface AdbDevicesResult {
  success: boolean;
  devices: AdbDevice[];
  error?: string;
}

export interface ActionResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface DeviceProbeResult {
  success: boolean;
  model?: string;
  panel_name?: string;
  virtual_size?: string;
  bits_per_pixel?: string;
  mipi_mode?: string;
  mipi_lanes?: number;
  fb0_available: boolean;
  vismpwr_available: boolean;
  python3_available: boolean;
  error?: string;
}

export interface ConnectionPanelProps {
  logs: { id: string; time: string; level: "info" | "success" | "warning" | "error" | "debug"; message: string }[];
  clearLogs: () => void;
}
