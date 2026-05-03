use std::sync::Mutex;

use crate::adb::{adb_push_internal, adb_shell_internal, query_adb_devices, resolve_device_id, run_adb};
use crate::state::ConnectionState;
use crate::{AdbActionResult, AdbDevicesResult};

#[tauri::command]
pub fn adb_devices() -> AdbDevicesResult {
    query_adb_devices()
}

#[tauri::command]
pub fn adb_select_device(device_id: String, state: tauri::State<Mutex<ConnectionState>>) -> AdbActionResult {
    let result = query_adb_devices();
    if !result.success {
        return AdbActionResult {
            success: false,
            output: String::new(),
            error: result.error,
        };
    }

    let exists = result.devices.iter().any(|device| device.id == device_id);
    if !exists {
        return AdbActionResult {
            success: false,
            output: String::new(),
            error: Some(format!("设备不存在: {}", device_id)),
        };
    }

    match state.lock() {
        Ok(mut guard) => {
            guard.selected_device_id = Some(device_id.clone());
            AdbActionResult {
                success: true,
                output: format!("已选择设备: {}", device_id),
                error: None,
            }
        }
        Err(_) => AdbActionResult {
            success: false,
            output: String::new(),
            error: Some("无法写入连接状态".to_string()),
        },
    }
}

#[tauri::command]
pub fn adb_connect(target: String) -> AdbActionResult {
    match run_adb(&["connect", &target]) {
        Ok(output) => AdbActionResult {
            success: output.status.success(),
            output: String::from_utf8_lossy(&output.stdout).to_string(),
            error: {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                if stderr.is_empty() { None } else { Some(stderr) }
            },
        },
        Err(error) => AdbActionResult {
            success: false,
            output: String::new(),
            error: Some(error),
        },
    }
}

#[tauri::command]
pub fn adb_disconnect(target: Option<String>, state: tauri::State<Mutex<ConnectionState>>) -> AdbActionResult {
    let args = if let Some(ref value) = target {
        vec!["disconnect", value.as_str()]
    } else {
        vec!["disconnect"]
    };

    let result = match run_adb(&args) {
        Ok(output) => AdbActionResult {
            success: output.status.success(),
            output: String::from_utf8_lossy(&output.stdout).to_string(),
            error: {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                if stderr.is_empty() { None } else { Some(stderr) }
            },
        },
        Err(error) => AdbActionResult {
            success: false,
            output: String::new(),
            error: Some(error),
        },
    };

    if result.success {
        if let Ok(mut guard) = state.lock() {
            guard.selected_device_id = None;
        }
    }

    result
}

#[tauri::command]
pub fn adb_shell(command: String, state: tauri::State<Mutex<ConnectionState>>) -> AdbActionResult {
    match adb_shell_internal(&state, &command) {
        Ok(result) => result,
        Err(error) => AdbActionResult {
            success: false,
            output: String::new(),
            error: Some(error),
        },
    }
}

#[tauri::command]
pub fn adb_push(local_path: String, remote_path: String, state: tauri::State<Mutex<ConnectionState>>) -> AdbActionResult {
    match adb_push_internal(&state, &local_path, &remote_path) {
        Ok(result) => result,
        Err(error) => AdbActionResult {
            success: false,
            output: String::new(),
            error: Some(error),
        },
    }
}

#[tauri::command]
pub fn adb_pull(remote_path: String, local_path: String, state: tauri::State<Mutex<ConnectionState>>) -> AdbActionResult {
    let device_id = match resolve_device_id(&state) {
        Ok(id) => id,
        Err(error) => {
            return AdbActionResult {
                success: false,
                output: String::new(),
                error: Some(error),
            }
        }
    };

    match run_adb(&["-s", &device_id, "pull", &remote_path, &local_path]) {
        Ok(output) => AdbActionResult {
            success: output.status.success(),
            output: String::from_utf8_lossy(&output.stdout).to_string(),
            error: {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                if stderr.is_empty() { None } else { Some(stderr) }
            },
        },
        Err(error) => AdbActionResult {
            success: false,
            output: String::new(),
            error: Some(error),
        },
    }
}
