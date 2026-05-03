use base64::Engine;
use std::sync::Mutex;

use crate::state::ConnectionState;
use crate::{
    GenericResult, ImageDisplayFromBase64Request, ImageDisplayRequest, PatternResult,
    PlayVideoRequest, RuntimePatternRequest, VideoControlRequest, VideoPlaybackStatus,
};
use crate::display_actions::{
    display_local_image_action, display_remote_image_action, display_runtime_pattern_action,
    generic_result_from_action, get_video_playback_status_action, play_video_action,
    sync_runtime_patterns_action, video_control_action,
};
use crate::action_result::ActionResult;

fn pattern_result_from_action(result: ActionResult<()>) -> PatternResult {
    let error = result.error.map(|error| {
        format!("[{}:{}] {}", error.stage, error.code, error.message)
    });

    PatternResult {
        success: result.success,
        message: result.summary,
        error,
    }
}

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
                message: "base64 image decode failed".to_string(),
                error: Some(format!("[input_validation:BASE64_DECODE_FAILED] Base64 解码失败: {}", err)),
            };
        }
    };
    if let Err(err) = std::fs::write(&local_path, decoded) {
        return PatternResult {
            success: false,
            message: "temporary image write failed".to_string(),
            error: Some(format!("[resource_prepare:TEMP_IMAGE_WRITE_FAILED] 写入临时图片失败: {}", err)),
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
    pattern_result_from_action(display_remote_image_action(&remote_image_path, &state))
}

#[tauri::command]
pub fn display_image(
    request: ImageDisplayRequest,
    state: tauri::State<Mutex<ConnectionState>>,
) -> PatternResult {
    pattern_result_from_action(display_local_image_action(&request, &state))
}

#[tauri::command]
pub fn sync_runtime_patterns(state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
    pattern_result_from_action(sync_runtime_patterns_action(&state))
}

#[tauri::command]
pub fn run_runtime_pattern(
    request: RuntimePatternRequest,
    state: tauri::State<Mutex<ConnectionState>>,
) -> PatternResult {
    pattern_result_from_action(display_runtime_pattern_action(&request, &state))
}

#[tauri::command]
pub fn play_video(
    request: PlayVideoRequest,
    state: tauri::State<Mutex<ConnectionState>>,
) -> GenericResult {
    generic_result_from_action(play_video_action(&request, &state))
}

#[tauri::command]
pub fn get_video_playback_status(
    state: tauri::State<Mutex<ConnectionState>>,
) -> VideoPlaybackStatus {
    let result = get_video_playback_status_action(&state);
    match (result.success, result.data, result.error) {
        (true, Some(status), _) => status,
        (_, _, Some(error)) => VideoPlaybackStatus {
            success: false,
            is_running: false,
            output: result.summary,
            error: Some(format!("[{}:{}] {}", error.stage, error.code, error.message)),
        },
        _ => VideoPlaybackStatus {
            success: false,
            is_running: false,
            output: result.summary,
            error: Some("[result_parse:VIDEO_STATUS_EMPTY] 获取视频播放状态失败".to_string()),
        },
    }
}

#[tauri::command]
pub fn send_video_control(
    request: VideoControlRequest,
    state: tauri::State<Mutex<ConnectionState>>,
) -> GenericResult {
    generic_result_from_action(video_control_action(&request, &state))
}
