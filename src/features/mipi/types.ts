export interface TimingConfig {
  hact: number;
  vact: number;
  pclk: number;
  hfp: number;
  hbp: number;
  hsync: number;
  vfp: number;
  vbp: number;
  vsync: number;
  hsPolarity: boolean;
  vsPolarity: boolean;
  dePolarity: boolean;
  clkPolarity: boolean;
  interfaceType: string;
  mipiMode: string;
  videoType: string;
  lanes: number;
  format: string;
  phyMode: string;
  dscEnable: boolean;
  dscVersion: string;
  sliceWidth: number;
  sliceHeight: number;
  scramblingEnable: boolean;
  dataSwap: boolean;
  dualChannel: boolean;
  panelName?: string;
  version?: string;
}

export interface RecentLcdConfigItem {
  path: string;
  lastUsedAt: number;
}

export interface LegacyLcdConfigResult {
  success: boolean;
  path?: string;
  timing?: {
    hact: number;
    vact: number;
    pclk: number;
    hfp: number;
    hbp: number;
    hsync: number;
    vfp: number;
    vbp: number;
    vsync: number;
    hs_polarity: boolean;
    vs_polarity: boolean;
    de_polarity: boolean;
    clk_polarity: boolean;
    interface_type: string;
    mipi_mode: string;
    video_type: string;
    lanes: number;
    format: string;
    phy_mode: string;
    dsc_enable: boolean;
    dsc_version: string;
    slice_width: number;
    slice_height: number;
    scrambling_enable: boolean;
    data_swap: boolean;
    dual_channel: boolean;
  };
  init_codes: string[];
  error?: string;
}

export interface PatternResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface TimingBinRequest {
  pclk: number;
  hact: number;
  hfp: number;
  hbp: number;
  hsync: number;
  vact: number;
  vfp: number;
  vbp: number;
  vsync: number;
  hs_polarity: boolean;
  vs_polarity: boolean;
  de_polarity: boolean;
  clk_polarity: boolean;
  interface_type: string;
  mipi_mode: string;
  video_type: string;
  lanes: number;
  format: string;
  phy_mode: string;
  dsc_enable: boolean;
  dsc_version: string;
  slice_width: number;
  slice_height: number;
  scrambling_enable: boolean;
  data_swap: boolean;
  init_codes: string[];
}

export interface ReadStatusResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface DownloadOledConfigPayload {
  request: TimingBinRequest;
}

export interface ExportOledConfigJsonPayload {
  request: TimingBinRequest;
}
