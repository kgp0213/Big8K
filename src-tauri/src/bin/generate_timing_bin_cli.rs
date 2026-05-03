use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimingBinRequest {
    pub pclk: u64,
    pub hact: u32,
    pub hfp: u32,
    pub hbp: u32,
    pub hsync: u32,
    pub vact: u32,
    pub vfp: u32,
    pub vbp: u32,
    pub vsync: u32,
    pub hs_polarity: bool,
    pub vs_polarity: bool,
    pub de_polarity: bool,
    pub clk_polarity: bool,
    pub interface_type: String,
    pub mipi_mode: String,
    pub video_type: String,
    pub lanes: u8,
    pub format: String,
    pub phy_mode: String,
    pub dsc_enable: bool,
    pub dsc_version: String,
    pub slice_width: u32,
    pub slice_height: u32,
    pub scrambling_enable: bool,
    pub data_swap: bool,
    pub panel_name: Option<String>,
    pub version: Option<String>,
    pub init_codes: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LegacyTimingConfig {
    pub hact: u32,
    pub vact: u32,
    pub pclk: u64,
    pub hfp: u32,
    pub hbp: u32,
    pub hsync: u32,
    pub vfp: u32,
    pub vbp: u32,
    pub vsync: u32,
    pub hs_polarity: bool,
    pub vs_polarity: bool,
    pub de_polarity: bool,
    pub clk_polarity: bool,
    pub interface_type: String,
    pub mipi_mode: String,
    pub video_type: String,
    pub lanes: u8,
    pub format: String,
    pub phy_mode: String,
    pub dsc_enable: bool,
    pub dsc_version: String,
    pub slice_width: u32,
    pub slice_height: u32,
    pub scrambling_enable: bool,
    pub data_swap: bool,
    pub dual_channel: bool,
    pub panel_name: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LegacyLcdConfigResult {
    pub success: bool,
    pub path: Option<String>,
    pub timing: Option<LegacyTimingConfig>,
    pub init_codes: Vec<String>,
    pub error: Option<String>,
}

fn read_u32_le(bytes: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes([bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]])
}

fn read_u64_le(bytes: &[u8], offset: usize) -> u64 {
    u64::from_le_bytes([
        bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3],
        bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7],
    ])
}

fn parse_init_codes_cli(bytes: &[u8], offset: usize, max_len: usize) -> Result<Vec<String>, String> {
    let end = (offset + max_len).min(bytes.len());
    let mut codes = Vec::new();
    let mut i = offset;
    while i + 2 < end {
        let payload_len = bytes[i + 2] as usize;
        let line_len = payload_len + 3;
        if i + line_len > end {
            return Err(format!("初始化代码区损坏：第 {} 字节开始的命令超出区域", i));
        }
        let line = bytes[i..i + line_len]
            .iter()
            .map(|b| format!("{:02X}", b))
            .collect::<Vec<_>>()
            .join(" ");
        codes.push(line);
        i += line_len;
    }
    Ok(codes)
}

fn parse_new_format_bin_file_cli(path: &str, bytes: &[u8]) -> LegacyLcdConfigResult {
    if bytes.len() < 96 {
        return LegacyLcdConfigResult {
            success: false, path: Some(path.to_string()), timing: None,
            init_codes: Vec::new(),
            error: Some(format!("新格式文件 header 长度不足，至少需要 96 字节，实际 {} 字节", bytes.len())),
        };
    }

    let panel_name = Some(
        String::from_utf8_lossy(&bytes[20..36])
            .trim_end_matches(char::from(0))
            .to_string(),
    );
    let version = Some(
        String::from_utf8_lossy(&bytes[36..44])
            .trim_end_matches(char::from(0))
            .to_string(),
    );

    let timing_offset = read_u32_le(bytes, 44) as usize;
    let init_seq_offset = read_u32_le(bytes, 52) as usize;
    let init_seq_size = read_u32_le(bytes, 56) as usize;
    let vesa_dsc_offset = read_u32_le(bytes, 76) as usize;
    let other_info_offset = read_u32_le(bytes, 84) as usize;

    if timing_offset + 44 > bytes.len() || init_seq_offset + init_seq_size > bytes.len()
        || vesa_dsc_offset + 16 > bytes.len() || other_info_offset + 16 > bytes.len()
    {
        return LegacyLcdConfigResult {
            success: false, path: Some(path.to_string()), timing: None,
            init_codes: Vec::new(),
            error: Some("新格式文件 section 偏移超出文件范围".to_string()),
        };
    }

    let pclk_hz = read_u64_le(bytes, timing_offset);
    let pclk = if pclk_hz >= 1_000_000 { pclk_hz / 1000 } else { pclk_hz };

    let hact = read_u32_le(bytes, timing_offset + 8);
    let hfp = read_u32_le(bytes, timing_offset + 12);
    let hbp = read_u32_le(bytes, timing_offset + 16);
    let hsync = read_u32_le(bytes, timing_offset + 20);
    let vact = read_u32_le(bytes, timing_offset + 24);
    let vfp = read_u32_le(bytes, timing_offset + 28);
    let vbp = read_u32_le(bytes, timing_offset + 32);
    let vsync = read_u32_le(bytes, timing_offset + 36);

    let display_flags = read_u32_le(bytes, timing_offset + 40);
    let hs_polarity = display_flags & (1 << 1) != 0;
    let vs_polarity = display_flags & (1 << 3) != 0;
    let de_polarity = display_flags & (1 << 5) != 0;
    let clk_polarity = display_flags & (1 << 7) != 0;

    let phy_mode_byte = bytes[vesa_dsc_offset];
    let scrambling_enable = bytes[vesa_dsc_offset + 1] != 0;
    let dsc_enable = bytes[vesa_dsc_offset + 2] != 0;
    let ver_major = bytes[vesa_dsc_offset + 3];
    let ver_minor = bytes[vesa_dsc_offset + 4];
    let slice_width = read_u32_le(bytes, vesa_dsc_offset + 8);
    let slice_height = read_u32_le(bytes, vesa_dsc_offset + 12);

    let mipi_raw = u16::from_le_bytes([bytes[other_info_offset], bytes[other_info_offset + 1]]);
    let data_swap = bytes[other_info_offset + 2] != 0;
    let interface_type = match bytes[other_info_offset + 3] {
        1 => "EDP", 2 => "DP", _ => "MIPI",
    }.to_string();
    let format = match bytes[other_info_offset + 4] {
        0 => "RGB888", 1 => "RGB666", 2 => "RGB666_PACKED", 3 => "RGB565", _ => "RGB888",
    }.to_string();
    let lanes = bytes[other_info_offset + 5];

    let mipi_mode = if mipi_raw & 1 != 0 { "Video" } else { "Command" }.to_string();
    let video_type = match (mipi_raw >> 1) & 3 {
        1 => "BURST_MODE",
        2 => "NON_BURST_SYNC_PULSES",
        _ => "NON_BURST_SYNC_EVENTS",
    }.to_string();
    let phy_mode = if phy_mode_byte == 1 { "CPHY" } else { "DPHY" }.to_string();
    let dsc_version = format!("Vesa{}.{}", ver_major, ver_minor);
    let dual_channel = false;

    let init_codes = parse_init_codes_cli(bytes, init_seq_offset, init_seq_size)
        .unwrap_or_else(|err| vec![format!("(init code parse error: {})", err)]);

    LegacyLcdConfigResult {
        success: true,
        path: Some(path.to_string()),
        timing: Some(LegacyTimingConfig {
            hact, vact, pclk, hfp, hbp, hsync, vfp, vbp, vsync,
            hs_polarity, vs_polarity, de_polarity, clk_polarity,
            interface_type, mipi_mode, video_type, lanes, format, phy_mode,
            dsc_enable, dsc_version, slice_width, slice_height,
            scrambling_enable, data_swap, dual_channel,
            panel_name, version,
        }),
        init_codes,
        error: None,
    }
}

fn parse_legacy_lcd_bin_file(path: &str) -> Result<LegacyLcdConfigResult, String> {
    let bytes = std::fs::read(path).map_err(|e| format!("读取点屏配置失败: {}", e))?;
    if bytes.len() >= 4 && bytes[0] == 0x5A && bytes[1] == 0x5A && bytes[2] == 0xA5 && bytes[3] == 0xA5 {
        return Ok(parse_new_format_bin_file_cli(path, &bytes));
    }

    if bytes.len() < 200 {
        return Err(format!("点屏配置文件长度不足，至少需要 200 字节，实际 {} 字节", bytes.len()));
    }

    let raw_pclk_hz = u32::from_be_bytes([bytes[1], bytes[2], bytes[3], bytes[4]]) as u64;
    let pclk = if raw_pclk_hz >= 1_000_000 { raw_pclk_hz / 1000 } else { raw_pclk_hz };
    let hact = u16::from_be_bytes([bytes[5], bytes[6]]) as u32;
    let vact = u16::from_be_bytes([bytes[7], bytes[8]]) as u32;
    let hbp = u16::from_be_bytes([bytes[9], bytes[10]]) as u32;
    let vbp = u16::from_be_bytes([bytes[11], bytes[12]]) as u32;
    let hfp = u16::from_be_bytes([bytes[13], bytes[14]]) as u32;
    let vfp = u16::from_be_bytes([bytes[15], bytes[16]]) as u32;
    let hsync = u16::from_be_bytes([bytes[17], bytes[18]]) as u32;
    let vsync = u16::from_be_bytes([bytes[19], bytes[20]]) as u32;

    let (panel_name, version) = (None, None);

    let hs_polarity = bytes[21] != 0;
    let vs_polarity = bytes[22] != 0;
    let de_polarity = bytes[23] != 0;
    let clk_polarity = bytes[24] != 0;

    let lanes = bytes[27];
    let interface_type = match bytes[30] { 1 => "EDP", 2 => "DP", _ => "MIPI" }.to_string();
    let mipi_mode = match bytes[31] { 1 => "Command", _ => "Video" }.to_string();
    let video_type = if mipi_mode == "Command" {
        "NON_BURST_SYNC_EVENTS"
    } else {
        match bytes[32] {
            0 => "BURST_MODE", 1 => "NON_BURST_SYNC_PULSES", _ => "NON_BURST_SYNC_EVENTS",
        }
    }.to_string();
    let format = match bytes[33] {
        0 => "RGB888", 1 => "RGB666", 2 => "RGB666_PACKED", 3 => "RGB565", _ => "RGB888",
    }.to_string();
    let phy_mode = if bytes[34] == 1 { "CPHY" } else { "DPHY" }.to_string();
    let dsc_enable = bytes[35] != 0;
    let scrambling_enable = bytes[36] != 0;
    let data_swap = bytes[37] != 0;
    let dual_channel = bytes[38] != 0;
    let slice_width = u16::from_be_bytes([bytes[39], bytes[40]]) as u32;
    let slice_height = u16::from_be_bytes([bytes[41], bytes[42]]) as u32;
    let dsc_version = format!("Vesa{}.{}", bytes[43], bytes[44]);

    let mut init_codes = Vec::new();
    let mut i = 200usize;
    while i < bytes.len() {
        if i + 2 >= bytes.len() { break; }
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
            hact, vact, pclk, hfp, hbp, hsync, vfp, vbp, vsync,
            hs_polarity, vs_polarity, de_polarity, clk_polarity,
            interface_type, mipi_mode, video_type, lanes, format, phy_mode,
            dsc_enable, dsc_version, slice_width, slice_height,
            scrambling_enable, data_swap, dual_channel,
            panel_name, version,
        }),
        init_codes,
        error: None,
    })
}

fn parse_oled_config_json_file(path: &str) -> Result<TimingBinRequest, String> {
    let raw = std::fs::read_to_string(path).map_err(|e| format!("读取 OLED 配置 JSON 失败: {}", e))?;
    serde_json::from_str(&raw).map_err(|e| format!("解析 OLED 配置 JSON 失败: {}", e))
}

fn parse_hex_csv_line(line: &str) -> Result<Vec<u8>, String> {
    line.split(|c: char| c == ',' || c.is_whitespace())
        .filter(|part| !part.trim().is_empty())
        .map(|part| u8::from_str_radix(part.trim(), 16).map_err(|_| format!("初始化代码字节解析失败: {}", part.trim())))
        .collect()
}

fn write_entry(buffer: &mut Vec<u8>, offset: u32, length: u32) {
    buffer.extend_from_slice(&offset.to_le_bytes());
    buffer.extend_from_slice(&length.to_le_bytes());
}

fn align(size: usize, alignment: usize) -> usize {
    (size + alignment - 1) & !(alignment - 1)
}

fn normalize_fixed_bytes(raw: Option<&str>, len: usize, pad: u8, digits_only: bool) -> Vec<u8> {
    let mut bytes: Vec<u8> = raw
        .unwrap_or_default()
        .as_bytes()
        .iter()
        .copied()
        .filter(|b| !digits_only || b.is_ascii_digit())
        .collect();

    if bytes.len() > len {
        bytes.truncate(len);
    }

    if bytes.len() < len {
        bytes.extend(std::iter::repeat(pad).take(len - bytes.len()));
    }

    bytes
}

fn generate_timing_bin_to_path(request: &TimingBinRequest, output_path: &Path) -> Result<(), String> {
    let mut init_seq: Vec<u8> = Vec::new();
    for line in request.init_codes.iter().filter(|line| !line.trim().is_empty()) {
        let bytes = parse_hex_csv_line(line)?;
        if bytes.len() < 3 {
            return Err(format!("初始化代码长度不足(至少3字节): {}", line));
        }
        init_seq.extend_from_slice(&bytes);
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
    panel_name.copy_from_slice(&normalize_fixed_bytes(
        request.panel_name.as_deref(),
        16,
        b'x',
        false,
    ));
    out.extend_from_slice(&panel_name);
    let mut version = [0u8; 8];
    version.copy_from_slice(&normalize_fixed_bytes(
        request.version.as_deref(),
        8,
        b'x',
        true,
    ));
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

    let pclk_hz = if request.pclk >= 1_000_000 { request.pclk } else { request.pclk.saturating_mul(1000) };
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

    let phy_mode = if request.phy_mode.eq_ignore_ascii_case("CPHY") { 1u8 } else { 0u8 };
    let (ver_major, ver_minor) = if request.dsc_version.contains("1.2") { (1u8, 2u8) } else { (1u8, 1u8) };
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

    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建输出目录失败: {}", e))?;
    }
    fs::write(output_path, out).map_err(|e| format!("写入 timing bin 失败: {}", e))
}

fn to_request(parsed: LegacyLcdConfigResult) -> Result<TimingBinRequest, String> {
    let timing = parsed.timing.ok_or_else(|| parsed.error.unwrap_or_else(|| "解析结果缺少 timing".to_string()))?;
    Ok(TimingBinRequest {
        pclk: timing.pclk,
        hact: timing.hact,
        hfp: timing.hfp,
        hbp: timing.hbp,
        hsync: timing.hsync,
        vact: timing.vact,
        vfp: timing.vfp,
        vbp: timing.vbp,
        vsync: timing.vsync,
        hs_polarity: timing.hs_polarity,
        vs_polarity: timing.vs_polarity,
        de_polarity: timing.de_polarity,
        clk_polarity: timing.clk_polarity,
        interface_type: timing.interface_type,
        mipi_mode: timing.mipi_mode,
        video_type: timing.video_type,
        lanes: timing.lanes,
        format: timing.format,
        phy_mode: timing.phy_mode,
        dsc_enable: timing.dsc_enable,
        dsc_version: timing.dsc_version,
        slice_width: timing.slice_width,
        slice_height: timing.slice_height,
        scrambling_enable: timing.scrambling_enable,
        data_swap: timing.data_swap,
        panel_name: timing.panel_name,
        version: timing.version,
        init_codes: parsed.init_codes,
    })
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() != 3 {
        eprintln!("usage: generate_timing_bin_cli <source.(bin|json)> <output.bin>");
        std::process::exit(2);
    }
    let source = &args[1];
    let output = PathBuf::from(&args[2]);
    let ext = Path::new(source)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    let request = if ext == "json" {
        match parse_oled_config_json_file(source) {
            Ok(v) => v,
            Err(e) => {
                eprintln!("{}", e);
                std::process::exit(1);
            }
        }
    } else {
        match parse_legacy_lcd_bin_file(source).and_then(to_request) {
            Ok(v) => v,
            Err(e) => {
                eprintln!("{}", e);
                std::process::exit(1);
            }
        }
    };

    if let Err(e) = generate_timing_bin_to_path(&request, &output) {
        eprintln!("{}", e);
        std::process::exit(1);
    }

    println!("{}", output.display());
}
