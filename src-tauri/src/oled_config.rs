use serde::Deserialize;
use std::path::Path;
use std::sync::Mutex;

use crate::{
    adb_push_internal, adb_shell_internal, ConnectionState, DownloadOledConfigRequest, GenericResult,
    LegacyLcdConfigResult, LegacyTimingConfig, TimingBinRequest,
};

fn write_entry(buffer: &mut Vec<u8>, offset: u32, length: u32) {
    buffer.extend_from_slice(&offset.to_le_bytes());
    buffer.extend_from_slice(&length.to_le_bytes());
}

fn align(size: usize, alignment: usize) -> usize {
    (size + alignment - 1) & !(alignment - 1)
}

fn parse_hex_csv_line(line: &str) -> Result<Vec<u8>, String> {
    let bytes: Result<Vec<u8>, String> = line
        .split(|c: char| c == ',' || c.is_whitespace())
        .filter(|part| !part.trim().is_empty())
        .map(|part| u8::from_str_radix(part.trim(), 16).map_err(|_| format!("初始化代码字节解析失败: {}", part.trim())))
        .collect();
    bytes
}

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
    let exe = match std::env::current_exe() {
        Ok(path) => path,
        Err(err) => {
            return GenericResult {
                success: false,
                output: String::new(),
                error: Some(format!("无法定位程序目录: {}", err)),
            };
        }
    };
    let dir = match exe.parent() {
        Some(dir) => dir,
        None => {
            return GenericResult {
                success: false,
                output: String::new(),
                error: Some("无法定位程序目录".to_string()),
            };
        }
    };
    let output_path = dir.join("vis-timing.bin");

    let mut init_seq: Vec<u8> = Vec::new();
    for line in request.init_codes.iter().filter(|line| !line.trim().is_empty()) {
        match parse_hex_csv_line(line) {
            Ok(bytes) => {
                if bytes.len() < 3 {
                    return GenericResult {
                        success: false,
                        output: String::new(),
                        error: Some(format!("初始化代码长度不足(至少3字节): {}", line)),
                    };
                }
                init_seq.extend_from_slice(&bytes);
            }
            Err(err) => {
                return GenericResult {
                    success: false,
                    output: String::new(),
                    error: Some(err),
                };
            }
        }
    }

    let header_size = 96usize;
    let timing_size = 48usize;
    let init_seq_size = init_seq.len();
    let exit_seq: [u8; 8] = [0x05, 0x78, 0x01, 0x28, 0x05, 0x00, 0x01, 0x10];
    let vesa_dsc_size = 16usize;
    let other_info_size = 16usize;

    let timing_offset = align(header_size, 16);
    let init_seq_offset = timing_offset + timing_size;
    let exit_seq_offset = init_seq_offset + init_seq_size;
    let vesa_dsc_offset = exit_seq_offset + exit_seq.len();
    let other_info_offset = vesa_dsc_offset + vesa_dsc_size;
    let total_size = other_info_offset + other_info_size;

    let mut out: Vec<u8> = Vec::with_capacity(total_size);
    out.extend_from_slice(&0xA5A55A5Au32.to_le_bytes());
    let mut panel_vendor = [0u8; 16];
    panel_vendor[..16].copy_from_slice(b"Visonox890123456");
    out.extend_from_slice(&panel_vendor);
    let mut panel_name = [0u8; 16];
    panel_name[..16].copy_from_slice(b"DSI-Panel0123456");
    out.extend_from_slice(&panel_name);
    let mut version = [0u8; 8];
    version.copy_from_slice(b"1.234567");
    out.extend_from_slice(&version);

    write_entry(&mut out, timing_offset as u32, timing_size as u32);
    write_entry(&mut out, init_seq_offset as u32, init_seq_size as u32);
    write_entry(&mut out, exit_seq_offset as u32, exit_seq.len() as u32);
    write_entry(&mut out, 0, 0);
    write_entry(&mut out, vesa_dsc_offset as u32, vesa_dsc_size as u32);
    write_entry(&mut out, other_info_offset as u32, other_info_size as u32);
    out.extend_from_slice(&(total_size as u32).to_le_bytes());

    while out.len() < timing_offset {
        out.push(0);
    }

    let pclk_hz = if request.pclk >= 1_000_000 {
        request.pclk
    } else {
        request.pclk.saturating_mul(1000)
    };
    out.extend_from_slice(&pclk_hz.to_le_bytes());
    out.extend_from_slice(&request.hact.to_le_bytes());
    out.extend_from_slice(&request.hfp.to_le_bytes());
    out.extend_from_slice(&request.hbp.to_le_bytes());
    out.extend_from_slice(&request.hsync.to_le_bytes());
    out.extend_from_slice(&request.vact.to_le_bytes());
    out.extend_from_slice(&request.vfp.to_le_bytes());
    out.extend_from_slice(&request.vbp.to_le_bytes());
    out.extend_from_slice(&request.vsync.to_le_bytes());

    let mut display_flags: u32 = 0;
    display_flags |= if request.hs_polarity { 1 << 1 } else { 1 << 0 };
    display_flags |= if request.vs_polarity { 1 << 3 } else { 1 << 2 };
    display_flags |= if request.de_polarity { 1 << 5 } else { 1 << 4 };
    display_flags |= if request.clk_polarity { 1 << 7 } else { 1 << 6 };
    out.extend_from_slice(&display_flags.to_le_bytes());
    out.extend_from_slice(&[0u8; 4]);

    out.extend_from_slice(&init_seq);
    out.extend_from_slice(&exit_seq);

    let phy_mode = if request.phy_mode.eq_ignore_ascii_case("CPHY") {
        1u8
    } else {
        0u8
    };
    let (ver_major, ver_minor) = if request.dsc_version.contains("1.2") {
        (1u8, 2u8)
    } else {
        (1u8, 1u8)
    };
    out.push(phy_mode);
    out.push(if request.scrambling_enable { 1 } else { 0 });
    out.push(if request.dsc_enable { 1 } else { 0 });
    out.push(ver_major);
    out.push(ver_minor);
    out.extend_from_slice(&[0u8; 3]);
    out.extend_from_slice(&request.slice_width.to_le_bytes());
    out.extend_from_slice(&request.slice_height.to_le_bytes());

    let mut mipi_mode_video_type: u16 = 0;
    if request.mipi_mode.eq_ignore_ascii_case("Video") {
        mipi_mode_video_type |= 1 << 0;
        if request.video_type.eq_ignore_ascii_case("NON_BURST_SYNC_PULSES") {
            mipi_mode_video_type |= 1 << 2;
        } else if request.video_type.eq_ignore_ascii_case("BURST_MODE") {
            mipi_mode_video_type |= 1 << 1;
        }
    }
    mipi_mode_video_type |= 1 << 11;
    mipi_mode_video_type |= 1 << 9;
    out.push((mipi_mode_video_type & 0xFF) as u8);
    out.push(((mipi_mode_video_type >> 8) & 0xFF) as u8);
    out.push(if request.data_swap { 1 } else { 0 });
    let interface_type = match request.interface_type.as_str() {
        "EDP" => 1u8,
        "DP" => 2u8,
        _ => 0u8,
    };
    out.push(interface_type);
    let format_type = match request.format.as_str() {
        "RGB888" => 0u8,
        "RGB666" => 1u8,
        "RGB666_PACKED" => 2u8,
        "RGB565" => 3u8,
        _ => 0u8,
    };
    out.push(format_type);
    out.push(request.lanes);
    out.push(phy_mode);
    out.extend_from_slice(&[0x56, 0x69, 0x73]);
    out.extend_from_slice(&[0u8; 6]);

    match std::fs::write(&output_path, out) {
        Ok(_) => GenericResult {
            success: true,
            output: output_path.to_string_lossy().to_string(),
            error: None,
        },
        Err(err) => GenericResult {
            success: false,
            output: String::new(),
            error: Some(format!("写入 timing bin 失败: {}", err)),
        },
    }
}

#[derive(Debug, Deserialize)]
pub struct ExportOledConfigJsonRequest {
    request: TimingBinRequest,
}

#[tauri::command]
pub fn export_oled_config_json(payload: ExportOledConfigJsonRequest) -> GenericResult {
    let path = match rfd::FileDialog::new()
        .add_filter("OLED config json", &["json"])
        .set_file_name("oled-config.json")
        .save_file()
    {
        Some(path) => path,
        None => {
            return GenericResult {
                success: false,
                output: String::new(),
                error: Some("已取消导出 OLED 配置 JSON".to_string()),
            };
        }
    };

    let mut export_request = payload.request;
    if export_request.pclk < 1_000_000 {
        export_request.pclk = export_request.pclk.saturating_mul(1000);
    }

    let json = match serde_json::to_string_pretty(&export_request) {
        Ok(json) => json,
        Err(err) => {
            return GenericResult {
                success: false,
                output: String::new(),
                error: Some(format!("序列化 OLED 配置 JSON 失败: {}", err)),
            };
        }
    };

    if let Err(err) = std::fs::write(&path, json) {
        return GenericResult {
            success: false,
            output: String::new(),
            error: Some(format!("写入 OLED 配置 JSON 失败: {}", err)),
        };
    }

    GenericResult {
        success: true,
        output: format!("已导出 OLED 配置 JSON: {}；vis-timing.bin 默认保存在程序目录", path.display()),
        error: None,
    }
}

#[tauri::command]
pub fn download_oled_config_and_reboot(
    payload: DownloadOledConfigRequest,
    state: tauri::State<Mutex<ConnectionState>>,
) -> GenericResult {
    let generated = generate_timing_bin(payload.request);
    if !generated.success {
        return generated;
    }

    let local_path = generated.output.clone();
    match adb_push_internal(&state, &local_path, "/vismm/vis-timing.bin") {
        Ok(result) if result.success => {}
        Ok(result) => {
            return GenericResult {
                success: false,
                output: result.output,
                error: result.error.or(Some("初始化配置下载失败：push 失败".to_string())),
            };
        }
        Err(error) => {
            return GenericResult {
                success: false,
                output: String::new(),
                error: Some(error),
            };
        }
    }

    match adb_shell_internal(&state, "/vismm/tools/repack_initrd.sh && sync") {
        Ok(result) if result.success => {}
        Ok(result) => {
            return GenericResult {
                success: false,
                output: result.output,
                error: result.error.or(Some("repack_initrd 执行失败".to_string())),
            };
        }
        Err(error) => {
            return GenericResult {
                success: false,
                output: String::new(),
                error: Some(error),
            };
        }
    }

    match adb_shell_internal(&state, "reboot") {
        Ok(result) if result.success => GenericResult {
            success: true,
            output: format!("初始化配置下载完成并重启设备：{}", local_path),
            error: None,
        },
        Ok(result) => GenericResult {
            success: false,
            output: result.output,
            error: result.error.or(Some("设备重启失败".to_string())),
        },
        Err(error) => GenericResult {
            success: false,
            output: String::new(),
            error: Some(error),
        },
    }
}
