use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use crate::resources::project_root;
use crate::state::ConnectionState;
use crate::{AdbActionResult, AdbDevice, AdbDevicesResult, PatternResult, StaticIpRequest};

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn bundled_adb_path() -> Result<PathBuf, String> {
    let adb_name = if cfg!(target_os = "windows") { "adb.exe" } else { "adb" };
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.join("resources").join(adb_name));
            candidates.push(exe_dir.join("_up_").join("resources").join(adb_name));
            if let Some(parent) = exe_dir.parent() {
                candidates.push(parent.join("resources").join(adb_name));
            }
        }
    }

    candidates.push(project_root().join("resources").join(adb_name));
    candidates.push(PathBuf::from("resources").join(adb_name));

    for candidate in candidates {
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "未找到随包 ADB：请确认 resources\\{} 与 AdbWinApi.dll、AdbWinUsbApi.dll 已随程序发布",
        adb_name
    ))
}

fn adb_command() -> Result<Command, String> {
    let adb_path = bundled_adb_path()?;
    let mut command = Command::new(&adb_path);
    if let Some(parent) = adb_path.parent() {
        command.current_dir(parent);
    }
    Ok(command)
}

pub(crate) fn run_adb(args: &[&str]) -> Result<std::process::Output, String> {
    let mut command = adb_command()?;
    command.args(args);

    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command
        .output()
        .map_err(|e| format!("执行随包 adb 失败: {}。请确认 resources 目录包含 adb.exe 及其 DLL 依赖", e))
}

pub(crate) fn run_adb_nowait(args: &[&str]) -> Result<(), String> {
    let mut command = adb_command()?;
    command.args(args);
    command.stdout(Stdio::null()).stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("执行随包 adb 后台命令失败: {}。请确认 resources 目录包含 adb.exe 及其 DLL 依赖", e))
}

fn parse_adb_devices(stdout: &str) -> Vec<AdbDevice> {
    stdout
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() || line.starts_with("List of devices") {
                return None;
            }

            let mut parts = line.split_whitespace();
            let id = parts.next()?.to_string();
            let status = parts.next()?.to_string();

            let mut product = None;
            let mut model = None;
            let mut transport_id = None;

            for part in parts {
                if let Some(value) = part.strip_prefix("product:") {
                    product = Some(value.to_string());
                } else if let Some(value) = part.strip_prefix("model:") {
                    model = Some(value.to_string());
                } else if let Some(value) = part.strip_prefix("transport_id:") {
                    transport_id = Some(value.to_string());
                }
            }

            Some(AdbDevice {
                id,
                status,
                product,
                model,
                transport_id,
            })
        })
        .collect()
}

pub(crate) fn query_adb_devices() -> AdbDevicesResult {
    match run_adb(&["devices", "-l"]) {
        Ok(output) => {
            if !output.status.success() {
                return AdbDevicesResult {
                    success: false,
                    devices: vec![],
                    error: Some(String::from_utf8_lossy(&output.stderr).to_string()),
                };
            }

            let stdout = String::from_utf8_lossy(&output.stdout);
            AdbDevicesResult {
                success: true,
                devices: parse_adb_devices(&stdout),
                error: None,
            }
        }
        Err(error) => AdbDevicesResult {
            success: false,
            devices: vec![],
            error: Some(error),
        },
    }
}

pub(crate) fn resolve_device_id(state: &tauri::State<Mutex<ConnectionState>>) -> Result<String, String> {
    let selected_device = {
        let guard = state
            .lock()
            .map_err(|_| "无法获取连接状态锁".to_string())?;
        guard.selected_device_id.clone()
    };

    let devices_result = query_adb_devices();
    if !devices_result.success {
        return Err(devices_result.error.unwrap_or_else(|| "获取 ADB 设备失败".to_string()));
    }

    let devices = devices_result.devices;
    if devices.is_empty() {
        return Err("未检测到 ADB 设备".to_string());
    }

    if let Some(selected) = selected_device {
        if devices.iter().any(|device| device.id == selected) {
            return Ok(selected);
        }
    }

    Ok(devices[0].id.clone())
}

pub(crate) fn adb_shell_internal(
    state: &tauri::State<Mutex<ConnectionState>>,
    command: &str,
) -> Result<AdbActionResult, String> {
    let device_id = resolve_device_id(state)?;

    match run_adb(&["-s", &device_id, "shell", command]) {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            if output.status.success() {
                Ok(AdbActionResult {
                    success: true,
                    output: stdout,
                    error: if stderr.is_empty() { None } else { Some(stderr) },
                })
            } else {
                Ok(AdbActionResult {
                    success: false,
                    output: stdout,
                    error: Some(if stderr.is_empty() {
                        "ADB shell 执行失败".to_string()
                    } else {
                        stderr
                    }),
                })
            }
        }
        Err(error) => Err(error),
    }
}

pub(crate) fn adb_push_internal(
    state: &tauri::State<Mutex<ConnectionState>>,
    local_path: &str,
    remote_path: &str,
) -> Result<AdbActionResult, String> {
    let device_id = resolve_device_id(state)?;
    match run_adb(&["-s", &device_id, "push", local_path, remote_path]) {
        Ok(output) => Ok(AdbActionResult {
            success: output.status.success(),
            output: String::from_utf8_lossy(&output.stdout).to_string(),
            error: {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                if stderr.is_empty() { None } else { Some(stderr) }
            },
        }),
        Err(error) => Err(error),
    }
}

fn detect_primary_network_interface(state: &tauri::State<Mutex<ConnectionState>>) -> Result<String, String> {
    let result = adb_shell_internal(state, "ifconfig")?;
    if !result.success {
        return Err(result.error.unwrap_or_else(|| "读取网络接口失败".to_string()));
    }

    let interface = result
        .output
        .lines()
        .find_map(|line| {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with(' ') || trimmed.starts_with('\t') {
                return None;
            }

            let name = trimmed
                .split([' ', ':'])
                .next()
                .map(str::trim)
                .filter(|value| !value.is_empty())?;

            if matches!(name, "lo" | "docker0") {
                None
            } else {
                Some(name.to_string())
            }
        })
        .ok_or_else(|| "未识别到可用网络接口".to_string())?;

    Ok(interface)
}

fn build_netplan_yaml(interface: &str, ip: &str, gateway: &str) -> String {
    format!(
        "# Let NetworkManager manage all devices on this system\nnetwork:\n  ethernets:\n    {}:\n      addresses: [{}/24]\n      dhcp4: false\n      optional: true\n      gateway4: {}\n      nameservers:\n        addresses: [{},114.114.114.114,8.8.8.8,8.8.4.4]\n  version: 2\n  renderer: NetworkManager\n",
        interface, ip, gateway, gateway
    )
}

pub(crate) fn set_static_ip_internal(
    state: &tauri::State<Mutex<ConnectionState>>,
    request: &StaticIpRequest,
) -> Result<AdbActionResult, String> {
    let interface = detect_primary_network_interface(state)?;
    let yaml = build_netplan_yaml(&interface, &request.ip, &request.gateway);
    let temp_path = std::env::temp_dir().join("01-network-manager-all.yaml");
    std::fs::write(&temp_path, yaml.as_bytes()).map_err(|error| format!("写入临时 netplan 文件失败: {}", error))?;

    let local_path = temp_path.to_string_lossy().to_string();
    let push_result = adb_push_internal(state, &local_path, "/etc/netplan/")?;
    if !push_result.success {
      return Ok(AdbActionResult {
          success: false,
          output: push_result.output,
          error: push_result.error.or(Some("推送 netplan 配置失败".to_string())),
      });
    }

    let apply_result = adb_shell_internal(state, "sudo netplan apply")?;
    if apply_result.success {
        Ok(AdbActionResult {
            success: true,
            output: format!("已将网卡 {} 设置为静态 IP {}，网关 {}", interface, request.ip, request.gateway),
            error: None,
        })
    } else {
        Ok(AdbActionResult {
            success: false,
            output: apply_result.output,
            error: apply_result.error.or(Some("netplan apply 执行失败".to_string())),
        })
    }
}

pub(crate) fn run_remote_python_script(
    state: &tauri::State<Mutex<ConnectionState>>,
    local_script_path: &str,
    remote_script_path: &str,
    args: &[&str],
) -> PatternResult {
    match adb_push_internal(state, local_script_path, remote_script_path) {
        Ok(push_result) if push_result.success => {}
        Ok(push_result) => {
            return PatternResult {
                success: false,
                message: push_result.output,
                error: push_result.error.or(Some("推送脚本失败".to_string())),
            }
        }
        Err(error) => {
            return PatternResult {
                success: false,
                message: String::new(),
                error: Some(error),
            }
        }
    }

    let mut command = format!("python3 {}", remote_script_path);
    if !args.is_empty() {
        command.push(' ');
        command.push_str(&args.join(" "));
    }

    match adb_shell_internal(state, &command) {
        Ok(result) if result.success => PatternResult {
            success: true,
            message: format!("脚本执行成功: {}", Path::new(local_script_path).display()),
            error: None,
        },
        Ok(result) => PatternResult {
            success: false,
            message: result.output,
            error: result.error,
        },
        Err(error) => PatternResult {
            success: false,
            message: String::new(),
            error: Some(error),
        },
    }
}
