use serde::Deserialize;
use std::path::Path;

use crate::{DownloadOledConfigRequest, GenericResult, LegacyLcdConfigResult, LegacyTimingConfig, TimingBinRequest};
use crate::openclaw_actions::{
    download_oled_config_and_reboot_action, export_oled_config_json_action,
    generate_timing_bin_action, generic_result_from_openclaw,
};

fn parse_legacy_lcd_bin_file(path: &str) -> Result<LegacyLcdConfigResult, String> {
    let bytes = std::fs::read(path).map_err(|e| format!("读取点屏配置失败: {}", e))?;
    if bytes.len() < 200 {
        return Err(format!("点屏配置文件长度不足，至少需要 200 字节，实际 {} 字节", bytes.len()));
    }

    let raw_pclk_hz = u32::from_be_bytes([bytes[1], bytes[2], bytes[3], bytes[4]]) as u64;
    let pclk = if raw_pclk_hz >= 1_000_000 {
        raw_pclk_hz / 1000
    } else {
        raw_pclk_hz
    };
    let hact = u16::from_be_bytes([bytes[5], bytes[6]]) as u32;
    let vact = u16::from_be_bytes([bytes[7], bytes[8]]) as u32;
    let hbp = u16::from_be_bytes([bytes[9], bytes[10]]) as u32;
    let vbp = u16::from_be_bytes([bytes[11], bytes[12]]) as u32;
    let hfp = u16::from_be_bytes([bytes[13], bytes[14]]) as u32;
    let vfp = u16::from_be_bytes([bytes[15], bytes[16]]) as u32;
    let hsync = u16::from_be_bytes([bytes[17], bytes[18]]) as u32;
    let vsync = u16::from_be_bytes([bytes[19], bytes[20]]) as u32;

    let hs_polarity = bytes[21] != 0;
    let vs_polarity = bytes[22] != 0;
    let de_polarity = bytes[23] != 0;
    let clk_polarity = bytes[24] != 0;

    let lanes = bytes[27];
    let interface_type = match bytes[30] {
        1 => "EDP",
        2 => "DP",
        _ => "MIPI",
    }
    .to_string();
    let mipi_mode = match bytes[31] {
        1 => "Command",
        _ => "Video",
    }
    .to_string();
    let video_type = match bytes[32] {
        0 => "BURST_MODE",
        1 => "NON_BURST_SYNC_PULSES",
        _ => "NON_BURST_SYNC_EVENTS",
    }
    .to_string();
    let format = match bytes[33] {
        0 => "RGB888",
        1 => "RGB666",
        2 => "RGB666_PACKED",
        3 => "RGB565",
        _ => "RGB888",
    }
    .to_string();
    let phy_mode = if bytes[34] == 1 { "CPHY" } else { "DPHY" }.to_string();
    let dsc_enable = bytes[35] != 0;
    let scrambling_enable = bytes[36] != 0;
    let data_swap = bytes[37] != 0;
    let dual_channel = bytes[38] != 0;
    let slice_width = u16::from_be_bytes([bytes[39], bytes[40]]) as u32;
    let slice_height = u16::from_be_bytes([bytes[41], bytes[42]]) as u32;
    let dsc_version = if bytes[43] == 1 && bytes[44] == 2 {
        "Vesa1.2"
    } else {
        "Ver1.1"
    }
    .to_string();

    let mut init_codes = Vec::new();
    let mut i = 200usize;
    while i < bytes.len() {
        if i + 2 >= bytes.len() {
            break;
        }
        let payload_len = bytes[i + 2] as usize;
        let line_len = payload_len + 3;
        if i + line_len > bytes.len() {
            return Err(format!("初始化代码区损坏：第 {} 字节开始的命令超出文件长度", i));
        }
        let line = bytes[i..i + line_len]
            .iter()
            .map(|b| format!("{:02X}", b))
            .collect::<Vec<_>>()
            .join(" ");
        init_codes.push(line);
        i += line_len;
    }

    Ok(LegacyLcdConfigResult {
        success: true,
        path: Some(path.to_string()),
        timing: Some(LegacyTimingConfig {
            hact,
            vact,
            pclk,
            hfp,
            hbp,
            hsync,
            vfp,
            vbp,
            vsync,
            hs_polarity,
            vs_polarity,
            de_polarity,
            clk_polarity,
            interface_type,
            mipi_mode,
            video_type,
            lanes,
            format,
            phy_mode,
            dsc_enable,
            dsc_version,
            slice_width,
            slice_height,
            scrambling_enable,
            data_swap,
            dual_channel,
        }),
        init_codes,
        error: None,
    })
}

fn parse_oled_config_json_file(path: &str) -> Result<LegacyLcdConfigResult, String> {
    let raw = std::fs::read_to_string(path).map_err(|e| format!("读取 OLED 配置 JSON 失败: {}", e))?;
    let request: TimingBinRequest =
        serde_json::from_str(&raw).map_err(|e| format!("解析 OLED 配置 JSON 失败: {}", e))?;

    Ok(LegacyLcdConfigResult {
        success: true,
        path: Some(path.to_string()),
        timing: Some(LegacyTimingConfig {
            hact: request.hact,
            vact: request.vact,
            pclk: request.pclk,
            hfp: request.hfp,
            hbp: request.hbp,
            hsync: request.hsync,
            vfp: request.vfp,
            vbp: request.vbp,
            vsync: request.vsync,
            hs_polarity: request.hs_polarity,
            vs_polarity: request.vs_polarity,
            de_polarity: request.de_polarity,
            clk_polarity: request.clk_polarity,
            interface_type: request.interface_type,
            mipi_mode: request.mipi_mode,
            video_type: request.video_type,
            lanes: request.lanes,
            format: request.format,
            phy_mode: request.phy_mode,
            dsc_enable: request.dsc_enable,
            dsc_version: request.dsc_version,
            slice_width: request.slice_width,
            slice_height: request.slice_height,
            scrambling_enable: request.scrambling_enable,
            data_swap: request.data_swap,
            dual_channel: false,
        }),
        init_codes: request.init_codes,
        error: None,
    })
}

#[tauri::command]
pub fn pick_lcd_config_file() -> Option<String> {
    rfd::FileDialog::new()
        .add_filter("LCD config", &["bin", "json"])
        .pick_file()
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn parse_legacy_lcd_bin(path: String) -> LegacyLcdConfigResult {
    let extension = Path::new(&path)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .unwrap_or_default();

    let parsed = if extension == "json" {
        parse_oled_config_json_file(&path)
    } else {
        parse_legacy_lcd_bin_file(&path)
    };

    match parsed {
        Ok(result) => result,
        Err(err) => LegacyLcdConfigResult {
            success: false,
            path: Some(path),
            timing: None,
            init_codes: Vec::new(),
            error: Some(err),
        },
    }
}

#[tauri::command]
pub fn generate_timing_bin(request: TimingBinRequest) -> GenericResult {
    generic_result_from_openclaw(generate_timing_bin_action(&request))
}

#[derive(Debug, Deserialize)]
pub struct ExportOledConfigJsonRequest {
    request: TimingBinRequest,
}

#[tauri::command]
pub fn export_oled_config_json(payload: ExportOledConfigJsonRequest) -> GenericResult {
    let result = export_oled_config_json_action(&payload.request);
    let exported_path = if result.success {
        result.data.clone()
    } else {
        None
    };
    let mut legacy = generic_result_from_openclaw(result);
    if let Some(path) = exported_path {
        legacy.output = format!("已导出 OLED 配置 JSON: {}；vis-timing.bin 默认保存在程序目录", path);
    }
    legacy
}

#[tauri::command]
pub fn download_oled_config_and_reboot(
    payload: DownloadOledConfigRequest,
    state: tauri::State<std::sync::Mutex<crate::ConnectionState>>,
) -> GenericResult {
    let result = download_oled_config_and_reboot_action(&payload.request, &state);
    let local_path = if result.success {
        result.data.clone()
    } else {
        None
    };
    let mut legacy = generic_result_from_openclaw(result);
    if let Some(path) = local_path {
        legacy.output = format!("初始化配置下载完成并重启设备：{}", path);
    }
    legacy
}
