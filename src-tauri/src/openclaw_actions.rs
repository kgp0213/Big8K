use std::path::{Path, PathBuf};
use std::sync::Mutex;

use crate::resources::project_file;
use crate::state::ConnectionState;
use crate::{
    shell_quote, ImageDisplayRequest, PlayVideoRequest, RuntimePatternRequest, TimingBinRequest,
    VideoControlRequest, VideoPlaybackStatus,
};
use crate::openclaw_adapter::{ensure_dir, push, run_project_python, run_video_nowait, shell};
use crate::openclaw_types::OpenClawResult;

fn format_openclaw_error(stage: &str, code: &str, message: &str) -> String {
    format!("[{}:{}] {}", stage, code, message)
}

pub fn generic_result_from_openclaw<T>(result: OpenClawResult<T>) -> crate::GenericResult {
    let error = result
        .error
        .map(|error| format_openclaw_error(error.stage, error.code, &error.message));

    crate::GenericResult {
        success: result.success,
        output: result.summary,
        error,
    }
}

fn timing_bin_output_path() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|err| format!("无法定位程序目录: {}", err))?;
    let dir = exe.parent().ok_or_else(|| "无法定位程序目录".to_string())?;
    Ok(dir.join("vis-timing.bin"))
}

fn parse_hex_csv_line(line: &str) -> Result<Vec<u8>, String> {
    line
        .split(|c: char| c == ',' || c.is_whitespace())
        .filter(|part| !part.trim().is_empty())
        .map(|part| {
            u8::from_str_radix(part.trim(), 16)
                .map_err(|_| format!("初始化代码字节解析失败: {}", part.trim()))
        })
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

pub fn generate_timing_bin_action(request: &TimingBinRequest) -> OpenClawResult<String> {
    let output_path = match timing_bin_output_path() {
        Ok(path) => path,
        Err(message) => {
            return OpenClawResult::fail(
                "resource_prepare",
                "PROGRAM_DIR_RESOLVE_FAILED",
                message,
                "timing bin output path resolve failed",
            )
        }
    };

    let mut init_seq: Vec<u8> = Vec::new();
    for line in request.init_codes.iter().filter(|line| !line.trim().is_empty()) {
        match parse_hex_csv_line(line) {
            Ok(bytes) => {
                if bytes.len() < 3 {
                    return OpenClawResult::fail(
                        "input_validation",
                        "INIT_CODE_TOO_SHORT",
                        format!("初始化代码长度不足(至少3字节): {}", line),
                        "timing bin generation failed",
                    );
                }
                init_seq.extend_from_slice(&bytes);
            }
            Err(message) => {
                return OpenClawResult::fail(
                    "input_validation",
                    "INIT_CODE_PARSE_FAILED",
                    message,
                    "timing bin generation failed",
                )
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
        Ok(_) => OpenClawResult::ok(
            output_path.to_string_lossy().to_string(),
            format!("timing bin generated: {}", output_path.display()),
        ),
        Err(err) => OpenClawResult::fail(
            "resource_prepare",
            "TIMING_BIN_WRITE_FAILED",
            format!("写入 timing bin 失败: {}", err),
            "timing bin generation failed",
        ),
    }
}

pub fn export_oled_config_json_action(request: &TimingBinRequest) -> OpenClawResult<String> {
    let path = match rfd::FileDialog::new()
        .add_filter("OLED config json", &["json"])
        .set_file_name("oled-config.json")
        .save_file()
    {
        Some(path) => path,
        None => {
            return OpenClawResult::fail(
                "user_interaction",
                "EXPORT_CANCELLED",
                "已取消导出 OLED 配置 JSON",
                "OLED config JSON export cancelled",
            )
        }
    };

    let mut export_request = request.clone();
    if export_request.pclk < 1_000_000 {
        export_request.pclk = export_request.pclk.saturating_mul(1000);
    }

    let json = match serde_json::to_string_pretty(&export_request) {
        Ok(json) => json,
        Err(err) => {
            return OpenClawResult::fail(
                "result_serialize",
                "OLED_CONFIG_JSON_SERIALIZE_FAILED",
                format!("序列化 OLED 配置 JSON 失败: {}", err),
                "OLED config JSON export failed",
            )
        }
    };

    match std::fs::write(&path, json) {
        Ok(_) => OpenClawResult::ok(
            path.to_string_lossy().to_string(),
            format!("OLED config JSON exported: {}", path.display()),
        ),
        Err(err) => OpenClawResult::fail(
            "resource_prepare",
            "OLED_CONFIG_JSON_WRITE_FAILED",
            format!("写入 OLED 配置 JSON 失败: {}", err),
            "OLED config JSON export failed",
        ),
    }
}

pub fn download_oled_config_and_reboot_action(
    request: &TimingBinRequest,
    state: &tauri::State<Mutex<ConnectionState>>,
) -> OpenClawResult<String> {
    let generated = generate_timing_bin_action(request);
    let local_path = match (generated.success, generated.data, generated.error) {
        (true, Some(path), _) => path,
        (_, _, Some(error)) => {
            return OpenClawResult::fail(
                error.stage,
                error.code,
                error.message,
                "OLED config download failed",
            )
        }
        _ => {
            return OpenClawResult::fail(
                "config_generate",
                "TIMING_BIN_EMPTY",
                "timing bin 生成结果为空",
                "OLED config download failed",
            )
        }
    };

    if let Err(error) = push(state, &local_path, "/vismm/vis-timing.bin") {
        return OpenClawResult::fail(
            error.stage,
            error.code,
            error.message,
            "OLED config download failed",
        );
    }

    if let Err(error) = shell(state, "/vismm/tools/repack_initrd.sh && sync") {
        return OpenClawResult::fail(
            error.stage,
            error.code,
            error.message,
            "OLED config repack failed",
        );
    }

    if let Err(error) = shell(state, "reboot") {
        return OpenClawResult::fail(
            error.stage,
            error.code,
            error.message,
            "device reboot failed",
        );
    }

    OpenClawResult::ok(
        local_path.clone(),
        format!("OLED config downloaded and reboot triggered: {}", local_path),
    )
}

pub fn display_remote_image_action(
    remote_image_path: &str,
    state: &tauri::State<Mutex<ConnectionState>>,
) -> OpenClawResult<()> {
    if remote_image_path.trim().is_empty() {
        return OpenClawResult::fail(
            "input_validation",
            "REMOTE_IMAGE_PATH_EMPTY",
            "远程图片路径不能为空",
            "remote image path is empty",
        );
    }

    if remote_image_path.to_ascii_lowercase().ends_with(".bmp") {
        let command = format!("./vismm/fbshow/fbShowBmp {}", shell_quote(remote_image_path));
        return match shell(state, &command) {
            Ok(_) => OpenClawResult::ok((), format!("remote BMP displayed: {}", remote_image_path)),
            Err(error) => OpenClawResult::fail(
                error.stage,
                error.code,
                error.message,
                "remote BMP display failed",
            ),
        };
    }

    match run_project_python(
        state,
        "python/fb_image_display.py",
        "/data/local/tmp/fb_image_display.py",
        &[remote_image_path],
    ) {
        Ok(_) => OpenClawResult::ok((), format!("remote image displayed: {}", remote_image_path)),
        Err(error) => OpenClawResult::fail(
            error.stage,
            error.code,
            error.message,
            "remote image display failed",
        ),
    }
}

pub fn display_local_image_action(
    request: &ImageDisplayRequest,
    state: &tauri::State<Mutex<ConnectionState>>,
) -> OpenClawResult<()> {
    if request.image_path.trim().is_empty() {
        return OpenClawResult::fail(
            "input_validation",
            "IMAGE_PATH_EMPTY",
            "图片路径不能为空",
            "local image path is empty",
        );
    }

    if !Path::new(&request.image_path).exists() {
        return OpenClawResult::fail(
            "input_validation",
            "IMAGE_NOT_FOUND",
            format!("图片不存在: {}", request.image_path),
            "local image file not found",
        );
    }

    let remote_name = request.remote_name.clone().unwrap_or_else(|| {
        Path::new(&request.image_path)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("input_image.bmp")
            .to_string()
    });
    let safe_remote_name: String = remote_name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let is_bmp = Path::new(&request.image_path)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("bmp"))
        .unwrap_or(false);
    let remote_image = if is_bmp {
        format!("/vismm/fbshow/bmp_online/{}", safe_remote_name)
    } else {
        format!("/data/local/tmp/big8k_images/{}", safe_remote_name)
    };

    let ensure_result = if is_bmp {
        ensure_dir(state, "/vismm/fbshow/bmp_online")
    } else {
        ensure_dir(state, "/data/local/tmp/big8k_images")
    };
    if let Err(error) = ensure_result {
        return OpenClawResult::fail(error.stage, error.code, error.message, "remote image directory prepare failed");
    }

    if let Err(error) = push(state, &request.image_path, &remote_image) {
        return OpenClawResult::fail(error.stage, error.code, error.message, "local image upload failed");
    }

    let mut result = display_remote_image_action(&remote_image, state);
    if result.success {
        result.summary = if is_bmp {
            format!("local BMP uploaded and displayed: {}", safe_remote_name)
        } else {
            format!("local image uploaded and displayed: {}", safe_remote_name)
        };
    }
    result
}

pub fn sync_runtime_patterns_action(
    state: &tauri::State<Mutex<ConnectionState>>,
) -> OpenClawResult<()> {
    if let Err(error) = ensure_dir(state, "/vismm/fbshow/big8k_runtime") {
        return OpenClawResult::fail(error.stage, error.code, error.message, "runtime pattern directory prepare failed");
    }

    if let Err(error) = push(
        state,
        &project_file("python/runtime_fbshow/render_patterns.py"),
        "/vismm/fbshow/big8k_runtime/render_patterns.py",
    ) {
        return OpenClawResult::fail(error.stage, error.code, error.message, "runtime pattern sync failed");
    }

    let _ = shell(state, "chmod 755 /vismm/fbshow/big8k_runtime/render_patterns.py");
    OpenClawResult::ok((), "runtime patterns synchronized")
}

pub fn display_runtime_pattern_action(
    request: &RuntimePatternRequest,
    state: &tauri::State<Mutex<ConnectionState>>,
) -> OpenClawResult<()> {
    if request.pattern.trim().is_empty() {
        return OpenClawResult::fail(
            "input_validation",
            "PATTERN_EMPTY",
            "pattern 不能为空",
            "runtime pattern is empty",
        );
    }

    let command = format!(
        "python3 /vismm/fbshow/big8k_runtime/render_patterns.py {}",
        shell_quote(&request.pattern)
    );
    match shell(state, &command) {
        Ok(output) => {
            let lowered = output.to_lowercase();
            let has_error = lowered.contains("error")
                || lowered.contains("no such file")
                || lowered.contains("not found")
                || lowered.contains("cannot")
                || lowered.contains("traceback");

            if has_error {
                OpenClawResult::fail(
                    "runtime_script",
                    "RUNTIME_PATTERN_FAILED",
                    output,
                    "runtime pattern display failed",
                )
            } else {
                OpenClawResult::ok((), format!("runtime pattern displayed: {}", request.pattern))
            }
        }
        Err(error) => OpenClawResult::fail(
            error.stage,
            error.code,
            error.message,
            "runtime pattern display failed",
        ),
    }
}

pub fn play_video_action(
    request: &PlayVideoRequest,
    state: &tauri::State<Mutex<ConnectionState>>,
) -> OpenClawResult<String> {
    let input_path = request.video_path.trim();
    if input_path.is_empty() {
        return OpenClawResult::fail(
            "input_validation",
            "VIDEO_PATH_EMPTY",
            "视频路径不能为空",
            "video path is empty",
        );
    }

    let file_name = match Path::new(input_path)
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.trim())
        .filter(|name| !name.is_empty())
    {
        Some(name) => name,
        None => {
            return OpenClawResult::fail(
                "input_validation",
                "VIDEO_FILE_NAME_INVALID",
                "视频文件名无效",
                "video file name is invalid",
            )
        }
    };

    let remote_video_path = format!("/vismm/fbshow/movie_online/{}", file_name);
    match run_video_nowait(state, &remote_video_path, request.zoom_mode, request.show_framerate) {
        Ok(()) => OpenClawResult::ok(
            remote_video_path.clone(),
            format!("video playback started: {}", remote_video_path),
        ),
        Err(error) => OpenClawResult::fail(
            error.stage,
            error.code,
            error.message,
            "video playback start failed",
        ),
    }
}

pub fn get_video_playback_status_action(
    state: &tauri::State<Mutex<ConnectionState>>,
) -> OpenClawResult<VideoPlaybackStatus> {
    match shell(
        state,
        r#"if [ -f /dev/shm/is_running ]; then echo running; else echo stopped; fi"#,
    ) {
        Ok(output) => {
            let is_running = output.lines().any(|line| line.trim() == "running");
            OpenClawResult::ok(
                VideoPlaybackStatus {
                    success: true,
                    is_running,
                    output,
                    error: None,
                },
                if is_running {
                    "video playback is running"
                } else {
                    "video playback is stopped"
                },
            )
        }
        Err(error) => OpenClawResult::fail(
            error.stage,
            error.code,
            error.message,
            "video playback status query failed",
        ),
    }
}

pub fn video_control_action(
    request: &VideoControlRequest,
    state: &tauri::State<Mutex<ConnectionState>>,
) -> OpenClawResult<()> {
    let command = match request.action.as_str() {
        "pause" => r#"echo > /dev/shm/pause_signal"#,
        "resume" => r#"echo > /dev/shm/pause_signal"#,
        "stop" => r#"echo > /dev/shm/stop_signal"#,
        other => {
            return OpenClawResult::fail(
                "input_validation",
                "VIDEO_CONTROL_UNSUPPORTED",
                format!("不支持的视频控制动作: {}", other),
                "video control action is unsupported",
            )
        }
    };

    match shell(state, command) {
        Ok(_) => OpenClawResult::ok((), format!("video control sent: {}", request.action)),
        Err(error) => OpenClawResult::fail(
            error.stage,
            error.code,
            error.message,
            "video control failed",
        ),
    }
}
