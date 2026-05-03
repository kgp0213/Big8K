use std::sync::Mutex;

use crate::adb::set_static_ip_internal;
use crate::state::ConnectionState;
use crate::{AdbActionResult, StaticIpRequest};

#[tauri::command]
pub fn set_static_ip(request: StaticIpRequest, state: tauri::State<Mutex<ConnectionState>>) -> AdbActionResult {
    match set_static_ip_internal(&state, &request) {
        Ok(result) => result,
        Err(error) => AdbActionResult {
            success: false,
            output: String::new(),
            error: Some(error),
        },
    }
}
