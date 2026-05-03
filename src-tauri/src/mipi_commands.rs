use std::sync::Mutex;

use crate::{adb_shell_internal, ConnectionState, GenericResult};

// MIPI 下发统一走 vismpwr。
// 新 UI 不再沿用旧 C# 上位机里“先读 RK3588 固件版本号，再分支选择不同下发方式”的兼容逻辑。
// 前端传入的标准格式指令会直接拼成 vismpwr 命令，通过 adb shell 执行。
fn run_mipi_command(state: &tauri::State<Mutex<ConnectionState>>, command: &str, success_message: &str) -> GenericResult {
    match adb_shell_internal(state, command) {
        Ok(result) if result.success => GenericResult {
            success: true,
            output: success_message.to_string(),
            error: result.error,
        },
        Ok(result) => GenericResult {
            success: false,
            output: result.output,
            error: result.error.or(Some("MIPI 指令执行失败".to_string())),
        },
        Err(error) => GenericResult {
            success: false,
            output: String::new(),
            error: Some(error),
        },
    }
}

#[tauri::command]
pub fn mipi_send_command(command: String, state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return GenericResult {
            success: false,
            output: String::new(),
            error: Some("MIPI 指令不能为空".to_string()),
        };
    }

    run_mipi_command(&state, &format!("vismpwr {}", trimmed), &format!("已发送 MIPI 指令: {}", trimmed))
}

#[tauri::command]
pub fn mipi_send_commands(commands: Vec<String>, state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    // 统一按 vismpwr 逐行拼接执行，不再根据固件版本切换旧 / 新下发路径。
    let normalized: Vec<String> = commands
        .into_iter()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect();

    if normalized.is_empty() {
        return GenericResult {
            success: false,
            output: String::new(),
            error: Some("MIPI 指令列表不能为空".to_string()),
        };
    }

    let joined = normalized
        .iter()
        .map(|line| format!("vismpwr {}", line))
        .collect::<Vec<_>>()
        .join(" && ");

    run_mipi_command(&state, &joined, &format!("已发送全部 MIPI 指令，共 {} 条", normalized.len()))
}

#[tauri::command]
pub fn mipi_software_reset(state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    run_mipi_command(&state, "vismpwr 05 00 01 01", "已执行 Software Reset (01)")
}

#[tauri::command]
pub fn mipi_read_power_mode(state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    match adb_shell_internal(&state, "vismpwr -r 01 0A") {
        Ok(result) if result.success => {
            let output = result.output.trim();
            GenericResult {
                success: true,
                output: if output.is_empty() {
                    "已读取状态 (0A)，但设备未返回可见输出".to_string()
                } else {
                    format!("读取状态 (0A) 成功: {}", output)
                },
                error: result.error,
            }
        }
        Ok(result) => GenericResult {
            success: false,
            output: result.output,
            error: result.error.or(Some("读取状态 (0A) 失败".to_string())),
        },
        Err(error) => GenericResult {
            success: false,
            output: String::new(),
            error: Some(error),
        },
    }
}

#[tauri::command]
pub fn mipi_sleep_in(state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    run_mipi_command(&state, "vismpwr 05 00 01 28 && sleep 0.1 && vismpwr 05 00 01 10", "已执行关屏序列: 28 -> 10")
}

#[tauri::command]
pub fn mipi_sleep_out(state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    run_mipi_command(&state, "vismpwr 05 00 01 11 && sleep 0.12 && vismpwr 05 00 01 29", "已执行开屏序列: 11 -> 29")
}
