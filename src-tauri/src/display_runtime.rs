use base64::Engine;
use std::path::Path;
use std::sync::Mutex;

use crate::{
    adb_push_internal, adb_shell_internal, project_file, resolve_device_id, run_adb_nowait,
    run_remote_python_script, shell_quote, ConnectionState, GenericResult,
    ImageDisplayFromBase64Request, ImageDisplayRequest, PatternResult, PlayVideoRequest,
    RuntimePatternRequest, VideoControlRequest, VideoPlaybackStatus,
};

#[tauri::command]
pub fn display_image_from_base64(
    request: ImageDisplayFromBase64Request,
    state: tauri::State<Mutex<ConnectionState>>,
) -> PatternResult {
    let filename = if request.filename.trim().is_empty() {
        "input_image.bin".to_string()
    } else {
        request.filename.trim().to_string()
    };
    let temp_dir = std::env::temp_dir();
    let local_path = temp_dir.join(&filename);
    let decoded = match base64::engine::general_purpose::STANDARD.decode(request.base64_data.as_bytes()) {
        Ok(data) => data,
        Err(err) => {
            return PatternResult {
                success: false,
                message: String::new(),
                error: Some(format!("Base64 解码失败: {}", err)),
            };
        }
    };
    if let Err(err) = std::fs::write(&local_path, decoded) {
        return PatternResult {
            success: false,
            message: String::new(),
            error: Some(format!("写入临时图片失败: {}", err)),
        };
    }
    let result = display_image(
        ImageDisplayRequest {
            image_path: local_path.to_string_lossy().to_string(),
            remote_name: request.remote_name.clone(),
        },
        state,
    );
    let _ = std::fs::remove_file(local_path);
    result
}

#[tauri::command]
pub fn display_remote_image(
    remote_image_path: String,
    state: tauri::State<Mutex<ConnectionState>>,
) -> PatternResult {
    if remote_image_path.trim().is_empty() {
        return PatternResult {
            success: false,
            message: String::new(),
            error: Some("远程图片路径不能为空".to_string()),
        };
    }

    if remote_image_path.to_ascii_lowercase().ends_with(".bmp") {
        let command = format!("./vismm/fbshow/fbShowBmp {}", shell_quote(&remote_image_path));
        return match adb_shell_internal(&state, &command) {
            Ok(result) if result.success => PatternResult {
                success: true,
                message: format!("已显示 BMP: {}", remote_image_path),
                error: None,
            },
            Ok(result) => PatternResult {
                success: false,
                message: result.output,
                error: result.error.or(Some("fbShowBmp 执行失败".to_string())),
            },
            Err(error) => PatternResult {
                success: false,
                message: String::new(),
                error: Some(error),
            },
        };
    }

    run_remote_python_script(
        &state,
        &project_file("python/fb_image_display.py"),
        "/data/local/tmp/fb_image_display.py",
        &[&remote_image_path],
    )
}

#[tauri::command]
pub fn display_image(
    request: ImageDisplayRequest,
    state: tauri::State<Mutex<ConnectionState>>,
) -> PatternResult {
    if request.image_path.trim().is_empty() {
        return PatternResult {
            success: false,
            message: String::new(),
            error: Some("图片路径不能为空".to_string()),
        };
    }

    if !Path::new(&request.image_path).exists() {
        return PatternResult {
            success: false,
            message: String::new(),
            error: Some(format!("图片不存在: {}", request.image_path)),
        };
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
    let _ = if is_bmp {
        adb_shell_internal(&state, "mkdir -p /vismm/fbshow/bmp_online")
    } else {
        adb_shell_internal(&state, "mkdir -p /data/local/tmp/big8k_images")
    };
    match adb_push_internal(&state, &request.image_path, &remote_image) {
        Ok(push_result) if push_result.success => {}
        Ok(push_result) => {
            return PatternResult {
                success: false,
                message: push_result.output,
                error: push_result.error.or(Some("图片上传失败".to_string())),
            };
        }
        Err(error) => {
            return PatternResult {
                success: false,
                message: String::new(),
                error: Some(error),
            };
        }
    }

    if is_bmp {
        let command = format!("./vismm/fbshow/fbShowBmp {}", shell_quote(&remote_image));
        return match adb_shell_internal(&state, &command) {
            Ok(result) if result.success => PatternResult {
                success: true,
                message: format!("已显示 BMP: {}", safe_remote_name),
                error: None,
            },
            Ok(result) => PatternResult {
                success: false,
                message: result.output,
                error: result.error.or(Some("fbShowBmp 执行失败".to_string())),
            },
            Err(error) => PatternResult {
                success: false,
                message: String::new(),
                error: Some(error),
            },
        };
    }

    run_remote_python_script(
        &state,
        &project_file("python/fb_image_display.py"),
        "/data/local/tmp/fb_image_display.py",
        &[&remote_image],
    )
}

#[tauri::command]
pub fn sync_runtime_patterns(state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
    let remote_dir = "/vismm/fbshow/big8k_runtime";
    match adb_shell_internal(&state, &format!("mkdir -p {}", remote_dir)) {
        Ok(result) if !result.success => {
            return PatternResult {
                success: false,
                message: result.output,
                error: result.error,
            };
        }
        Err(error) => {
            return PatternResult {
                success: false,
                message: String::new(),
                error: Some(error),
            };
        }
        _ => {}
    }

    match adb_push_internal(
        &state,
        &project_file("python/runtime_fbshow/render_patterns.py"),
        "/vismm/fbshow/big8k_runtime/render_patterns.py",
    ) {
        Ok(result) if result.success => {}
        Ok(result) => {
            return PatternResult {
                success: false,
                message: result.output,
                error: result.error,
            };
        }
        Err(error) => {
            return PatternResult {
                success: false,
                message: String::new(),
                error: Some(error),
            };
        }
    }

    let _ = adb_shell_internal(&state, "chmod 755 /vismm/fbshow/big8k_runtime/render_patterns.py");
    PatternResult {
        success: true,
        message: "已同步画面脚本到 /vismm/fbshow/big8k_runtime".to_string(),
        error: None,
    }
}

#[tauri::command]
pub fn run_runtime_pattern(
    request: RuntimePatternRequest,
    state: tauri::State<Mutex<ConnectionState>>,
) -> PatternResult {
    let command = format!(
        "python3 /vismm/fbshow/big8k_runtime/render_patterns.py {}",
        shell_quote(&request.pattern)
    );
    match adb_shell_internal(&state, &command) {
        Ok(result) => {
            let output = result.output.to_lowercase();
            let has_error = output.contains("error")
                || output.contains("no such file")
                || output.contains("not found")
                || output.contains("cannot")
                || output.contains("traceback")
                || result.error.is_some();

            if result.success && !has_error {
                PatternResult {
                    success: true,
                    message: format!("已显示画面 {}", request.pattern),
                    error: None,
                }
            } else {
                PatternResult {
                    success: false,
                    message: result.output.clone(),
                    error: result.error.or(Some(result.output)),
                }
            }
        }
        Err(error) => PatternResult {
            success: false,
            message: String::new(),
            error: Some(error),
        },
    }
}

#[tauri::command]
pub fn play_video(
    request: PlayVideoRequest,
    state: tauri::State<Mutex<ConnectionState>>,
) -> GenericResult {
    let input_path = request.video_path.trim();
    if input_path.is_empty() {
        return GenericResult {
            success: false,
            output: String::new(),
            error: Some("视频路径不能为空".to_string()),
        };
    }

    let device_id = match resolve_device_id(&state) {
        Ok(id) => id,
        Err(error) => {
            return GenericResult {
                success: false,
                output: String::new(),
                error: Some(error),
            };
        }
    };

    let file_name = std::path::Path::new(input_path)
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.trim())
        .filter(|name| !name.is_empty())
        .ok_or_else(|| "视频文件名无效".to_string());

    let file_name = match file_name {
        Ok(name) => name,
        Err(error) => {
            return GenericResult {
                success: false,
                output: String::new(),
                error: Some(error),
            };
        }
    };

    let remote_video_path = format!("/vismm/fbshow/movie_online/{}", file_name);
    let zoom_mode = request.zoom_mode.to_string();
    let show_framerate = request.show_framerate.to_string();

    match run_adb_nowait(&[
        "-s",
        &device_id,
        "shell",
        "/usr/bin/python3",
        "/vismm/fbshow/videoPlay.py",
        &remote_video_path,
        &zoom_mode,
        &show_framerate,
    ]) {
        Ok(()) => GenericResult {
            success: true,
            output: format!(
                "已后台启动视频播放: {} (zoom={}, framerate={})",
                remote_video_path, request.zoom_mode, request.show_framerate
            ),
            error: None,
        },
        Err(error) => GenericResult {
            success: false,
            output: String::new(),
            error: Some(error),
        },
    }
}

#[tauri::command]
pub fn get_video_playback_status(
    state: tauri::State<Mutex<ConnectionState>>,
) -> VideoPlaybackStatus {
    match adb_shell_internal(
        &state,
        r#"if [ -f /dev/shm/is_running ]; then echo running; else echo stopped; fi"#,
    ) {
        Ok(result) if result.success => {
            let is_running = result.output.lines().any(|line| line.trim() == "running");
            VideoPlaybackStatus {
                success: true,
                is_running,
                output: result.output,
                error: None,
            }
        }
        Ok(result) => VideoPlaybackStatus {
            success: false,
            is_running: false,
            output: result.output,
            error: result.error.or(Some("获取视频播放状态失败".to_string())),
        },
        Err(error) => VideoPlaybackStatus {
            success: false,
            is_running: false,
            output: String::new(),
            error: Some(error),
        },
    }
}

#[tauri::command]
pub fn send_video_control(
    request: VideoControlRequest,
    state: tauri::State<Mutex<ConnectionState>>,
) -> GenericResult {
    let command = match request.action.as_str() {
        "pause" => r#"echo > /dev/shm/pause_signal"#,
        "resume" => r#"echo > /dev/shm/pause_signal"#,
        "stop" => r#"echo > /dev/shm/stop_signal"#,
        other => {
            return GenericResult {
                success: false,
                output: String::new(),
                error: Some(format!("不支持的视频控制动作: {}", other)),
            };
        }
    };

    match adb_shell_internal(&state, command) {
        Ok(result) if result.success => GenericResult {
            success: true,
            output: if result.output.trim().is_empty() {
                format!("视频控制已发送: {}", request.action)
            } else {
                result.output
            },
            error: None,
        },
        Ok(result) => GenericResult {
            success: false,
            output: result.output,
            error: result.error.or(Some("视频控制失败".to_string())),
        },
        Err(error) => GenericResult {
            success: false,
            output: String::new(),
            error: Some(error),
        },
    }
}
