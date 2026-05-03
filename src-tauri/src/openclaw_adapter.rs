use std::sync::Mutex;

use crate::resources::project_file;
use crate::{
    adb_push_internal, adb_shell_internal, resolve_device_id, run_adb_nowait, shell_quote,
    ConnectionState,
};
use crate::openclaw_types::OpenClawError;

fn map_transport_error(stage: &'static str, code: &'static str, message: String) -> OpenClawError {
    let mapped_stage = if message.contains("未检测到 ADB 设备") || message.contains("获取 ADB 设备失败") {
        "device_resolution"
    } else {
        stage
    };

    OpenClawError {
        stage: mapped_stage,
        code,
        message,
    }
}

pub fn shell(
    state: &tauri::State<Mutex<ConnectionState>>,
    command: &str,
) -> Result<String, OpenClawError> {
    match adb_shell_internal(state, command) {
        Ok(result) if result.success => Ok(result.output),
        Ok(result) => Err(OpenClawError {
            stage: "adb_shell",
            code: "ADB_SHELL_FAILED",
            message: result.error.unwrap_or_else(|| {
                if result.output.trim().is_empty() {
                    "ADB shell 执行失败".to_string()
                } else {
                    result.output
                }
            }),
        }),
        Err(error) => Err(map_transport_error("adb_shell", "ADB_SHELL_ERROR", error)),
    }
}

pub fn push(
    state: &tauri::State<Mutex<ConnectionState>>,
    local_path: &str,
    remote_path: &str,
) -> Result<String, OpenClawError> {
    match adb_push_internal(state, local_path, remote_path) {
        Ok(result) if result.success => Ok(result.output),
        Ok(result) => Err(OpenClawError {
            stage: "adb_push",
            code: "ADB_PUSH_FAILED",
            message: result.error.unwrap_or_else(|| {
                if result.output.trim().is_empty() {
                    "ADB push 执行失败".to_string()
                } else {
                    result.output
                }
            }),
        }),
        Err(error) => Err(map_transport_error("adb_push", "ADB_PUSH_ERROR", error)),
    }
}

pub fn ensure_dir(
    state: &tauri::State<Mutex<ConnectionState>>,
    remote_dir: &str,
) -> Result<(), OpenClawError> {
    shell(state, &format!("mkdir -p {}", remote_dir)).map(|_| ())
}

pub fn run_python(
    state: &tauri::State<Mutex<ConnectionState>>,
    local_script_path: &str,
    remote_script_path: &str,
    args: &[&str],
) -> Result<String, OpenClawError> {
    push(state, local_script_path, remote_script_path)?;

    let mut command = format!("python3 {}", shell_quote(remote_script_path));
    if !args.is_empty() {
        command.push(' ');
        command.push_str(
            &args
                .iter()
                .map(|arg| shell_quote(arg))
                .collect::<Vec<_>>()
                .join(" "),
        );
    }

    shell(state, &command).map_err(|error| OpenClawError {
        stage: "runtime_script",
        code: error.code,
        message: error.message,
    })
}

pub fn run_project_python(
    state: &tauri::State<Mutex<ConnectionState>>,
    project_script_path: &str,
    remote_script_path: &str,
    args: &[&str],
) -> Result<String, OpenClawError> {
    run_python(state, &project_file(project_script_path), remote_script_path, args)
}

pub fn run_video_nowait(
    state: &tauri::State<Mutex<ConnectionState>>,
    remote_video_path: &str,
    zoom_mode: i32,
    show_framerate: i32,
) -> Result<(), OpenClawError> {
    let device_id = resolve_device_id(state)
        .map_err(|error| map_transport_error("device_resolution", "DEVICE_RESOLUTION_FAILED", error))?;

    let zoom_mode = zoom_mode.to_string();
    let show_framerate = show_framerate.to_string();

    run_adb_nowait(&[
        "-s",
        &device_id,
        "shell",
        "/usr/bin/python3",
        "/vismm/fbshow/videoPlay.py",
        remote_video_path,
        &zoom_mode,
        &show_framerate,
    ])
    .map_err(|error| map_transport_error("adb_shell", "VIDEO_START_FAILED", error))
}
