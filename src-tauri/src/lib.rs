mod display_runtime;
mod host_env;
mod oled_config;
mod openclaw_actions;
mod openclaw_adapter;
mod openclaw_types;

use base64::Engine;
use serde::{Deserialize, Serialize};
use display_runtime::{
    display_image, display_image_from_base64, display_remote_image, get_video_playback_status,
    play_video, run_runtime_pattern, send_video_control, sync_runtime_patterns,
};
use host_env::get_local_network_info;
use oled_config::{
    download_oled_config_and_reboot, export_oled_config_json, generate_timing_bin,
    parse_legacy_lcd_bin, pick_lcd_config_file,
};
#[cfg(feature = "ssh")]
use ssh2::Session;
#[cfg(feature = "ssh")]
use std::net::{TcpStream, ToSocketAddrs};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;
#[cfg(feature = "ssh")]
use std::time::Duration;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AdbDevice {
    pub id: String,
    pub status: String,
    pub product: Option<String>,
    pub model: Option<String>,
    pub transport_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AdbDevicesResult {
    pub success: bool,
    pub devices: Vec<AdbDevice>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AdbActionResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SshConnectResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SshExecResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PatternResult {
    pub success: bool,
    pub message: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenericResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceProbeResult {
    pub success: bool,
    pub model: Option<String>,
    pub panel_name: Option<String>,
    pub virtual_size: Option<String>,
    pub bits_per_pixel: Option<String>,
    pub mipi_mode: Option<String>,
    pub mipi_lanes: Option<u32>,
    pub fb0_available: bool,
    pub vismpwr_available: bool,
    pub python3_available: bool,
    pub cpu_usage: Option<String>,
    pub memory_usage: Option<String>,
    pub temperature_c: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConnectionState {
    pub selected_device_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TextDisplayRequest {
    pub text: String,
    pub subtitle: Option<String>,
    pub style: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageDisplayRequest {
    pub image_path: String,
    #[serde(default)]
    pub remote_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageDisplayFromBase64Request {
    #[serde(alias = "fileName")]
    pub filename: String,
    #[serde(alias = "base64Data")]
    pub base64_data: String,
    #[serde(default, alias = "remoteName")]
    pub remote_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LogicPatternRequest {
    pub pattern: u8,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RuntimePatternRequest {
    pub pattern: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ListRemoteFilesRequest {
    path: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ListRemoteFilesResult {
    success: bool,
    files: Vec<String>,
    error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct UploadFileBase64Request {
    base64_data: String,
    remote_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct RunRemoteScriptRequest {
    script_path: String,
    #[serde(default)]
    script_args: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SetScriptAutorunRequest {
    script_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct DeleteRemoteFileRequest {
    file_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct SetupLoopImagesRequest {
    image_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlayVideoRequest {
    pub video_path: String,
    pub zoom_mode: i32,
    pub show_framerate: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoControlRequest {
    pub action: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoPlaybackStatus {
    pub success: bool,
    pub is_running: bool,
    pub output: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StaticIpRequest {
    pub ip: String,
    pub gateway: String,
}

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
pub struct DownloadOledConfigRequest {
    pub request: TimingBinRequest,
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

#[derive(Debug, Serialize, Deserialize)]
pub struct PowerRailReading {
    pub name: String,
    pub addr: String,
    pub voltage: f64,
    pub current_ma: Option<f64>,
    pub power_mw: Option<f64>,
    pub status: String,
    pub gain_mode: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PowerRailsResult {
    pub success: bool,
    pub rails: Vec<PowerRailReading>,
    pub total_power_mw: Option<f64>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommandPresetItem {
    pub index: usize,
    pub name: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommandPresetListResult {
    pub success: bool,
    pub items: Vec<CommandPresetItem>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalImageInfo {
    pub name: String,
    pub path: String,
    pub ext: String,
    pub modified_ms: Option<u128>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalImagesResult {
    pub success: bool,
    pub images: Vec<LocalImageInfo>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImagePreviewResult {
    pub success: bool,
    pub data_url: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub error: Option<String>,
}

impl Default for ConnectionState {
    fn default() -> Self {
        Self {
            selected_device_id: None,
        }
    }
}

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

fn run_adb(args: &[&str]) -> Result<std::process::Output, String> {
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

fn query_adb_devices() -> AdbDevicesResult {
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

fn set_static_ip_internal(
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

pub(crate) fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\\', "\\\\").replace('\'', "'\"'\"'"))
}

fn project_root() -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or_else(|| std::path::Path::new(env!("CARGO_MANIFEST_DIR")))
        .to_path_buf()
}

pub(crate) fn project_file(path: &str) -> String {
    project_root().join(path).to_string_lossy().to_string()
}

#[tauri::command]
fn adb_devices() -> AdbDevicesResult {
    query_adb_devices()
}

#[tauri::command]
fn adb_select_device(device_id: String, state: tauri::State<Mutex<ConnectionState>>) -> AdbActionResult {
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
fn adb_connect(target: String) -> AdbActionResult {
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
fn adb_disconnect(target: Option<String>, state: tauri::State<Mutex<ConnectionState>>) -> AdbActionResult {
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
fn adb_shell(command: String, state: tauri::State<Mutex<ConnectionState>>) -> AdbActionResult {
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
fn adb_push(local_path: String, remote_path: String, state: tauri::State<Mutex<ConnectionState>>) -> AdbActionResult {
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
fn adb_pull(remote_path: String, local_path: String, state: tauri::State<Mutex<ConnectionState>>) -> AdbActionResult {
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

#[tauri::command]
fn set_static_ip(request: StaticIpRequest, state: tauri::State<Mutex<ConnectionState>>) -> AdbActionResult {
    match set_static_ip_internal(&state, &request) {
        Ok(result) => result,
        Err(error) => AdbActionResult {
            success: false,
            output: String::new(),
            error: Some(error),
        },
    }
}

#[cfg(feature = "ssh")]
fn ssh_connect_session(host: &str, port: u16, username: &str, password: &str) -> Result<Session, String> {
    let target = format!("{}:{}", host, port);
    let addr = match target.to_socket_addrs() {
        Ok(mut addrs) => addrs.next().ok_or_else(|| format!("SSH connection failed: invalid address {}", target))?,
        Err(e) => return Err(format!("SSH connection failed: {}", e)),
    };

    let tcp = TcpStream::connect_timeout(&addr, Duration::from_secs(5))
        .map_err(|e| format!("SSH connection failed: {}", e))?;

    let _ = tcp.set_read_timeout(Some(Duration::from_secs(5)));
    let _ = tcp.set_write_timeout(Some(Duration::from_secs(5)));

    let mut session = Session::new().map_err(|e| format!("SSH session init failed: {}", e))?;
    session.set_tcp_stream(tcp);
    session.set_timeout(5000);

    session.handshake().map_err(|e| format!("SSH handshake failed: {}", e))?;
    session
        .userauth_password(username, password)
        .map_err(|e| format!("SSH authentication failed: {}", e))?;

    if !session.authenticated() {
        return Err("SSH authentication failed: unknown reason".to_string());
    }

    Ok(session)
}

#[cfg(feature = "ssh")]
#[tauri::command]
fn ssh_connect(host: String, port: u16, username: String, password: String) -> SshConnectResult {
    match ssh_connect_session(&host, port, &username, &password) {
        Ok(_) => SshConnectResult {
            success: true,
            output: format!("SSH connected to {}@{}:{}", username, host, port),
            error: None,
        },
        Err(error) => SshConnectResult {
            success: false,
            output: String::new(),
            error: Some(error),
        },
    }
}

#[cfg(not(feature = "ssh"))]
#[tauri::command]
fn ssh_connect(_host: String, _port: u16, _username: String, _password: String) -> SshConnectResult {
    SshConnectResult {
        success: false,
        output: String::new(),
        error: Some("当前构建未启用 SSH 功能".to_string()),
    }
}

#[cfg(feature = "ssh")]
#[tauri::command]
fn ssh_exec(host: String, port: u16, username: String, password: String, command: String) -> SshExecResult {
    let session = match ssh_connect_session(&host, port, &username, &password) {
        Ok(session) => session,
        Err(error) => {
            return SshExecResult {
                success: false,
                output: String::new(),
                error: Some(error),
            }
        }
    };

    let mut channel = match session.channel_session() {
        Ok(channel) => channel,
        Err(error) => {
            return SshExecResult {
                success: false,
                output: String::new(),
                error: Some(format!("SSH channel open failed: {}", error)),
            }
        }
    };

    if let Err(error) = channel.exec(&command) {
        return SshExecResult {
            success: false,
            output: String::new(),
            error: Some(format!("SSH exec failed: {}", error)),
        };
    }

    let mut stdout = String::new();
    let mut stderr = String::new();
    let _ = std::io::Read::read_to_string(&mut channel, &mut stdout);
    let _ = std::io::Read::read_to_string(&mut channel.stderr(), &mut stderr);
    let _ = channel.wait_close();
    let exit_code = channel.exit_status().unwrap_or(1);

    if exit_code == 0 {
        SshExecResult {
            success: true,
            output: stdout,
            error: if stderr.trim().is_empty() { None } else { Some(stderr) },
        }
    } else {
        SshExecResult {
            success: false,
            output: stdout,
            error: Some(if stderr.trim().is_empty() {
                format!("SSH command exited with code {}", exit_code)
            } else {
                stderr
            }),
        }
    }
}

#[cfg(not(feature = "ssh"))]
#[tauri::command]
fn ssh_exec(_host: String, _port: u16, _username: String, _password: String, _command: String) -> SshExecResult {
    SshExecResult {
        success: false,
        output: String::new(),
        error: Some("当前构建未启用 SSH 功能".to_string()),
    }
}

#[tauri::command]
fn adb_probe_device(state: tauri::State<Mutex<ConnectionState>>) -> DeviceProbeResult {
    const PROBE_SCRIPT_VERSION: &str = "20260422_1918";
    const PROBE_SCRIPT_BODY: &str = include_str!("../scripts/probe_device_20260422_1405.sh");

    let empty_result = |error: String| DeviceProbeResult {
        success: false,
        model: None,
        panel_name: None,
        virtual_size: None,
        bits_per_pixel: None,
        mipi_mode: None,
        mipi_lanes: None,
        fb0_available: false,
        vismpwr_available: false,
        python3_available: false,
        cpu_usage: None,
        memory_usage: None,
        temperature_c: None,
        error: Some(error),
    };

    let device_id = match resolve_device_id(&state) {
        Ok(id) => id,
        Err(error) => return empty_result(error),
    };

    let remote_dir = "/dev/shm";
    let remote_script = format!("{}/probe_device_{}.sh", remote_dir, PROBE_SCRIPT_VERSION);

    match run_adb(&["-s", &device_id, "shell", "test", "-d", remote_dir]) {
        Ok(output) if output.status.success() => {}
        Ok(_) => return empty_result(format!("探测脚本临时目录不可用: {}", remote_dir)),
        Err(error) => return empty_result(error),
    }

    // Always refresh the probe script. Older/missing remote scripts caused the UI to show
    // "未读取" even though the bundled probe script itself was valid.
    let local_script_path = std::env::temp_dir().join(format!("probe_device_{}.sh", PROBE_SCRIPT_VERSION));
    let normalized_script = PROBE_SCRIPT_BODY.replace("\r\n", "\n").replace('\r', "\n");
    if let Err(error) = std::fs::write(&local_script_path, normalized_script.as_bytes()) {
        return empty_result(format!("写入本地探测脚本失败: {}", error));
    }

    let local_script = local_script_path.to_string_lossy().to_string();
    match adb_push_internal(&state, &local_script, &remote_script) {
        Ok(result) if result.success => {}
        Ok(result) => {
            let _ = std::fs::remove_file(&local_script_path);
            return empty_result(result.error.unwrap_or_else(|| "推送探测脚本失败".to_string()));
        }
        Err(error) => {
            let _ = std::fs::remove_file(&local_script_path);
            return empty_result(error);
        }
    }

    match run_adb(&["-s", &device_id, "shell", "chmod", "755", &remote_script]) {
        Ok(output) if output.status.success() => {}
        Ok(output) => {
            let _ = std::fs::remove_file(&local_script_path);
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return empty_result(if stderr.is_empty() {
                "设置探测脚本权限失败".to_string()
            } else {
                format!("设置探测脚本权限失败: {}", stderr)
            });
        }
        Err(error) => {
            let _ = std::fs::remove_file(&local_script_path);
            return empty_result(error);
        }
    }

    let _ = std::fs::remove_file(&local_script_path);

    let output = match run_adb(&["-s", &device_id, "shell", "sh", &remote_script]) {
        Ok(output) if output.status.success() => String::from_utf8_lossy(&output.stdout).to_string(),
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return empty_result(if !stderr.is_empty() {
                format!("ADB 设备探测失败: {}", stderr)
            } else if !stdout.is_empty() {
                format!("ADB 设备探测失败: {}", stdout)
            } else {
                "ADB 设备探测失败".to_string()
            });
        }
        Err(error) => return empty_result(error),
    };

    let mut model = None;
    let mut panel_name = None;
    let mut virtual_size = None;
    let mut bits_per_pixel = None;
    let mut mipi_mode = None;
    let mut mipi_lanes: Option<u32> = None;
    let mut fb0_available = false;
    let mut vismpwr_available = false;
    let mut python3_available = false;
    let mut cpu_usage = None;
    let mut memory_usage = None;
    let mut temperature_c = None;

    for line in output.lines() {
        if let Some(value) = line.strip_prefix("MIPI_MODE=") {
            if !value.trim().is_empty() {
                mipi_mode = Some(value.trim().to_string());
            }
        } else if let Some(value) = line.strip_prefix("PANEL_NAME=") {
            if !value.trim().is_empty() {
                panel_name = Some(value.trim().to_string());
            }
        } else if let Some(value) = line.strip_prefix("MODEL=") {
            if !value.trim().is_empty() {
                model = Some(value.trim().to_string());
            }
        } else if let Some(value) = line.strip_prefix("VSIZE=") {
            if !value.trim().is_empty() {
                virtual_size = Some(value.trim().to_string());
            }
        } else if let Some(value) = line.strip_prefix("BPP=") {
            if !value.trim().is_empty() {
                bits_per_pixel = Some(value.trim().to_string());
            }
        } else if let Some(value) = line.strip_prefix("LANES=") {
            let trimmed = value.trim();
            if let Ok(parsed) = trimmed.parse::<u32>() {
                if parsed > 0 {
                    mipi_lanes = Some(parsed);
                }
            }
        } else if let Some(value) = line.strip_prefix("FB0=") {
            fb0_available = value.trim() == "1";
        } else if let Some(value) = line.strip_prefix("VISMPWR=") {
            vismpwr_available = value.trim() == "1";
        } else if let Some(value) = line.strip_prefix("PYTHON3=") {
            python3_available = value.trim() == "1";
        } else if let Some(value) = line.strip_prefix("CPU=") {
            if !value.trim().is_empty() {
                cpu_usage = Some(value.trim().to_string());
            }
        } else if let Some(value) = line.strip_prefix("MEM=") {
            if !value.trim().is_empty() {
                memory_usage = Some(value.trim().to_string());
            }
        } else if let Some(value) = line.strip_prefix("TEMP=") {
            if !value.trim().is_empty() {
                temperature_c = Some(format!("{}°C", value.trim()));
            }
        }
    }

    if model.is_none()
        && panel_name.is_none()
        && virtual_size.is_none()
        && bits_per_pixel.is_none()
        && mipi_mode.is_none()
        && mipi_lanes.is_none()
        && !fb0_available
        && !vismpwr_available
        && !python3_available
        && cpu_usage.is_none()
        && memory_usage.is_none()
        && temperature_c.is_none()
    {
        let raw_output = output.trim();
        return empty_result(if raw_output.is_empty() {
            "设备探测脚本执行完成，但未返回有效信息：stdout 为空".to_string()
        } else {
            format!("设备探测脚本执行完成，但未返回有效信息。原始输出: {}", raw_output)
        });
    }

    DeviceProbeResult {
        success: true,
        model,
        panel_name,
        virtual_size,
        bits_per_pixel,
        mipi_mode,
        mipi_lanes,
        fb0_available,
        vismpwr_available,
        python3_available,
        cpu_usage,
        memory_usage,
        temperature_c,
        error: None,
    }
}

fn framebuffer_python_script(body: &str) -> String {
    // Use a here-doc to avoid shell quoting issues on adb shell / Android sh
    format!(
        "cat > /data/local/tmp/_fbs.py <<'PY'\n{}\nPY\npython3 /data/local/tmp/_fbs.py; status=$?; rm -f /data/local/tmp/_fbs.py; exit $status",
        body
    )
}

fn detect_framebuffer_size(state: &tauri::State<Mutex<ConnectionState>>) -> Result<(u32, u32), String> {
    let probe = adb_probe_device(state.clone());
    if !probe.success {
        return Err(probe.error.unwrap_or_else(|| "读取屏幕分辨率失败".to_string()));
    }

    let virtual_size = probe
        .virtual_size
        .ok_or_else(|| "未读取到 fb0 virtual_size".to_string())?;

    let normalized = virtual_size
        .trim()
        .replace('×', "x")
        .replace('X', "x")
        .replace(',', "x");
    let mut parts = normalized.split('x');
    let width = parts
        .next()
        .ok_or_else(|| "无效分辨率格式".to_string())?
        .trim()
        .parse::<u32>()
        .map_err(|_| format!("无法解析宽度: {}", virtual_size))?;
    let height = parts
        .next()
        .ok_or_else(|| "无效分辨率格式".to_string())?
        .trim()
        .parse::<u32>()
        .map_err(|_| format!("无法解析高度: {}", virtual_size))?;

    Ok((width, height))
}

#[tauri::command]
fn display_solid_color(color: String, state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
    let (width, height) = match detect_framebuffer_size(&state) {
        Ok(size) => size,
        Err(error) => {
            return PatternResult {
                success: false,
                message: String::new(),
                error: Some(error),
            }
        }
    };

    let script_content = format!(
        r#"import struct
W, H = {width}, {height}
COLORS = {{
    'red': (0, 0, 255, 255),
    'green': (0, 255, 0, 255),
    'blue': (255, 0, 0, 255),
    'white': (255, 255, 255, 255),
    'black': (0, 0, 0, 255),
    'gray32': (32, 32, 32, 255),
    'gray64': (64, 64, 64, 255),
    'gray128': (128, 128, 128, 255),
    'gray192': (192, 192, 192, 255),
    'yellow': (0, 255, 255, 255),
    'cyan': (255, 0, 0, 255),
    'purple': (255, 0, 255, 255),
}}
color_name = '{color}'
rgba = COLORS.get(color_name, COLORS['black'])
pixel = struct.pack('<4B', *rgba)
row = pixel * W
with open('/dev/fb0', 'wb') as fb:
    fb.write(row * H)
print('OK:' + color_name)
"#,
        width = width,
        height = height,
        color = color
    );

    let local_path = std::env::temp_dir().join("big8k_color.py");
    if let Err(e) = std::fs::write(&local_path, script_content.as_bytes()) {
        return PatternResult {
            success: false,
            message: String::new(),
            error: Some(format!("写本地脚本失败: {}", e)),
        };
    }

    let result = run_remote_python_script(
        &state,
        local_path.to_str().unwrap_or(""),
        "/data/local/tmp/big8k_color.py",
        &[],
    );

    let _ = std::fs::remove_file(&local_path);
    result
}

#[tauri::command]
fn display_gradient(gradient_type: String, state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
    let (width, height) = match detect_framebuffer_size(&state) {
        Ok(size) => size,
        Err(error) => {
            return PatternResult {
                success: false,
                message: String::new(),
                error: Some(error),
            }
        }
    };

    let body = format!(
        r#"WIDTH = {width}
HEIGHT = {height}
CHANNEL = '{gradient_type}'
with open('/dev/fb0', 'wb') as fb:
    for y in range(HEIGHT):
        v = int(y * 255 / max(HEIGHT - 1, 1))
        if CHANNEL == 'red':
            pixel = bytes((0, 0, v, 255))
        elif CHANNEL == 'green':
            pixel = bytes((0, v, 0, 255))
        elif CHANNEL == 'blue':
            pixel = bytes((v, 0, 0, 255))
        else:
            pixel = bytes((v, v, v, 255))
        fb.write(pixel * WIDTH)
print('OK')"#,
        width = width,
        height = height,
        gradient_type = gradient_type
    );

    match adb_shell_internal(&state, &framebuffer_python_script(&body)) {
        Ok(result) if result.success => PatternResult {
            success: true,
            message: format!("已显示渐变图案: {}", gradient_type),
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

#[tauri::command]
fn display_color_bar(state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
    let (width, height) = match detect_framebuffer_size(&state) {
        Ok(size) => size,
        Err(error) => {
            return PatternResult {
                success: false,
                message: String::new(),
                error: Some(error),
            }
        }
    };

    let body = format!(r#"WIDTH = {width}
HEIGHT = {height}
COLORS = [
    (255, 255, 255, 255),
    (0, 255, 255, 255),
    (255, 255, 0, 255),
    (0, 255, 0, 255),
    (255, 0, 255, 255),
    (0, 0, 255, 255),
    (255, 0, 0, 255),
    (0, 0, 0, 255),
]
bar_width = max(WIDTH // len(COLORS), 1)
with open('/dev/fb0', 'wb') as fb:
    row = bytearray()
    for x in range(WIDTH):
        idx = min(x // bar_width, len(COLORS) - 1)
        row.extend(COLORS[idx])
    row = bytes(row)
    for _ in range(HEIGHT):
        fb.write(row)
print('OK')"#,
        width = width,
        height = height
    );

    match adb_shell_internal(&state, &framebuffer_python_script(&body)) {
        Ok(result) if result.success => PatternResult {
            success: true,
            message: "已显示彩条图案".to_string(),
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

#[tauri::command]
fn display_checkerboard(state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
    let (width, height) = match detect_framebuffer_size(&state) {
        Ok(size) => size,
        Err(error) => {
            return PatternResult {
                success: false,
                message: String::new(),
                error: Some(error),
            }
        }
    };

    let body = format!(r#"WIDTH = {width}
HEIGHT = {height}
BLOCK = 80
WHITE = (255, 255, 255, 255)
BLACK = (0, 0, 0, 255)
with open('/dev/fb0', 'wb') as fb:
    for y in range(HEIGHT):
        row = bytearray()
        for x in range(WIDTH):
            if ((x // BLOCK) + (y // BLOCK)) % 2 == 0:
                row.extend(WHITE)
            else:
                row.extend(BLACK)
        fb.write(bytes(row))
print('OK')"#,
        width = width,
        height = height
    );

    match adb_shell_internal(&state, &framebuffer_python_script(&body)) {
        Ok(result) if result.success => PatternResult {
            success: true,
            message: "已显示棋盘格图案".to_string(),
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

#[cfg(feature = "image-tools")]
#[tauri::command]
fn pick_image_directory() -> Option<String> {
    rfd::FileDialog::new().pick_folder().map(|p| p.to_string_lossy().to_string())
}

#[cfg(not(feature = "image-tools"))]
#[tauri::command]
fn pick_image_directory() -> Option<String> {
    None
}

#[cfg(feature = "image-tools")]
#[tauri::command]
fn create_image_preview(image_path: String) -> ImagePreviewResult {
    let path = std::path::PathBuf::from(&image_path);
    if !path.is_file() {
        return ImagePreviewResult { success: false, data_url: None, width: None, height: None, error: Some("图片不存在".to_string()) };
    }
    let img = match image::open(&path) {
        Ok(img) => img,
        Err(err) => return ImagePreviewResult { success: false, data_url: None, width: None, height: None, error: Some(format!("读取图片失败: {}", err)) },
    };
    let width = img.width();
    let height = img.height();
    let thumb = img.thumbnail(420, 300);
    let mut bytes = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut bytes);
    if let Err(err) = thumb.write_to(&mut cursor, image::ImageFormat::Png) {
        return ImagePreviewResult { success: false, data_url: None, width: Some(width), height: Some(height), error: Some(format!("生成预览失败: {}", err)) };
    }
    let data_url = format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes));
    ImagePreviewResult { success: true, data_url: Some(data_url), width: Some(width), height: Some(height), error: None }
}

#[cfg(not(feature = "image-tools"))]
#[tauri::command]
fn create_image_preview(_image_path: String) -> ImagePreviewResult {
    ImagePreviewResult { success: false, data_url: None, width: None, height: None, error: Some("当前构建未启用图片预览功能".to_string()) }
}

#[cfg(feature = "image-tools")]
#[tauri::command]
fn list_images_in_directory(dir_path: String) -> LocalImagesResult {
    let dir = std::path::PathBuf::from(dir_path);
    if !dir.is_dir() {
        return LocalImagesResult { success: false, images: vec![], error: Some("目录不存在或不可访问".to_string()) };
    }

    let mut images = Vec::new();
    let allowed = ["bmp", "png", "jpg", "jpeg", "webp"];
    let read_dir = match std::fs::read_dir(&dir) {
        Ok(rd) => rd,
        Err(err) => return LocalImagesResult { success: false, images: vec![], error: Some(format!("读取目录失败: {}", err)) },
    };

    for entry in read_dir.flatten() {
        let path = entry.path();
        if !path.is_file() { continue; }
        let ext = path.extension().and_then(|v| v.to_str()).unwrap_or("").to_lowercase();
        if !allowed.contains(&ext.as_str()) { continue; }
        let metadata = entry.metadata().ok();
        let modified_ms = metadata
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis());
        images.push(LocalImageInfo {
            name: path.file_name().and_then(|v| v.to_str()).unwrap_or("").to_string(),
            path: path.to_string_lossy().to_string(),
            ext: format!(".{}", ext),
            modified_ms,
        });
    }

    LocalImagesResult { success: true, images, error: None }
}

#[cfg(not(feature = "image-tools"))]
#[tauri::command]
fn list_images_in_directory(_dir_path: String) -> LocalImagesResult {
    LocalImagesResult { success: false, images: vec![], error: Some("当前构建未启用图片目录浏览功能".to_string()) }
}

#[tauri::command]
fn read_power_rails(state: tauri::State<Mutex<ConnectionState>>) -> PowerRailsResult {
    let script = r#"
import json
import smbus2
import subprocess
import time
BUS=4

rails = [
    {"name":"VCI","addr":0x41,"rs_low":0.2,"gpio_sensitive":True},
    {"name":"VDDIO","addr":0x45,"rs_low":0.2,"gpio_sensitive":True},
    {"name":"DVDD","addr":0x48,"rs_low":0.2,"gpio_sensitive":False},
    {"name":"ELVDD","addr":0x40,"rs_low":0.025,"gpio_sensitive":False},
    {"name":"ELVSS","addr":0x46,"rs_low":None,"gpio_sensitive":False},
    {"name":"AVDD","addr":0x44,"rs_low":0.2,"gpio_sensitive":False},
    {"name":"VGH","addr":0x4C,"rs_low":0.2,"gpio_sensitive":False},
    {"name":"VGL","addr":0x4A,"rs_low":None,"gpio_sensitive":False},
]

def gpio3b5_set(value:int):
    pin = 109
    try:
        with open('/sys/class/gpio/export','w') as f:
            f.write(str(pin))
    except Exception:
        pass
    with open(f'/sys/class/gpio/gpio{pin}/direction','w') as f:
        f.write('out')
    with open(f'/sys/class/gpio/gpio{pin}/value','w') as f:
        f.write(str(value))
    time.sleep(0.2)

def _read_word(bus, addr, reg):
    bus.write_byte(addr, reg)
    msb, lsb = bus.read_i2c_block_data(addr, reg, 2)
    return (msb << 8) | lsb

def read_bus_voltage(addr):
    with smbus2.SMBus(BUS) as bus:
        raw = _read_word(bus, addr, 0x02)
        return raw * 1.25e-3

def read_shunt_raw(addr):
    with smbus2.SMBus(BUS) as bus:
        return _read_word(bus, addr, 0x01)

def calc_current_ma(raw, rs):
    signed = raw - 0x10000 if raw & 0x8000 else raw
    vshunt = signed * 2.5e-6
    return vshunt / rs * 1000.0

results=[]
total=0.0
for rail in rails:
    name=rail['name']
    addr=rail['addr']
    voltage=read_bus_voltage(addr)
    current_ma=None
    power_mw=None
    status='正常'
    gain_mode=None
    note=None

    if name == 'VGL':
        vddio = read_bus_voltage(0x45)
        vgl_sense = read_bus_voltage(0x4F)
        current_ma = 1000.0 * (vgl_sense - vddio / 2.0) / 50.0 / 0.2
        voltage = -abs(voltage)
        power_mw = abs(voltage) * abs(current_ma)
        gain_mode = 'INA282(50V/V)'
    elif name == 'ELVSS':
        voltage = -abs(voltage)
    elif rail['rs_low'] is not None:
        rs_low = rail['rs_low']
        if rail['gpio_sensitive']:
            gpio3b5_set(0)
            raw_low = read_shunt_raw(addr)
            current_low = calc_current_ma(raw_low, rs_low)
            current_ma = current_low
            gain_mode = 'GPIO3B5=0 / 0.2Ω'
            if abs(raw_low) < 0x1000 or abs(current_low) < 50.0:
                gpio3b5_set(1)
                raw_high = read_shunt_raw(addr)
                if raw_high >= 0x7000:
                    status = '高增益饱和'
                    note = 'GPIO3B5=1 时分流寄存器接近满量程，已回退低增益结果'
                else:
                    current_ma = calc_current_ma(raw_high, 1.2)
                    gain_mode = 'GPIO3B5=1 / 1.2Ω'
                    status = '高增益测量'
            power_mw = abs(voltage) * abs(current_ma)
        else:
            raw = read_shunt_raw(addr)
            current_ma = calc_current_ma(raw, rs_low)
            power_mw = abs(voltage) * abs(current_ma)
            gain_mode = f'固定采样 / {rs_low}Ω'

    if power_mw is not None:
        total += power_mw

    results.append({
        'name': name,
        'addr': f'0x{addr:02X}',
        'voltage': round(voltage, 6),
        'current_ma': None if current_ma is None else round(current_ma, 3),
        'power_mw': None if power_mw is None else round(power_mw, 3),
        'status': status,
        'gain_mode': gain_mode,
        'note': note,
    })

print(json.dumps({'rails': results, 'total_power_mw': round(total, 3)}, ensure_ascii=False))
"#;

    let shell = framebuffer_python_script(script);
    match adb_shell_internal(&state, &shell) {
        Ok(result) if result.success => {
            let text = result.output.trim();
            let json_line = text.lines().last().unwrap_or(text);
            match serde_json::from_str::<serde_json::Value>(json_line) {
                Ok(value) => {
                    let rails: Vec<PowerRailReading> = serde_json::from_value(value.get("rails").cloned().unwrap_or(serde_json::Value::Array(vec![]))).unwrap_or_default();
                    let total_power_mw = value.get("total_power_mw").and_then(|v| v.as_f64());
                    PowerRailsResult { success: true, rails, total_power_mw, error: None }
                }
                Err(e) => PowerRailsResult { success: false, rails: vec![], total_power_mw: None, error: Some(format!("解析电源检测结果失败: {} | 原始输出: {}", e, text)) }
            }
        }
        Ok(result) => PowerRailsResult { success: false, rails: vec![], total_power_mw: None, error: result.error.or(Some(result.output)) },
        Err(error) => PowerRailsResult { success: false, rails: vec![], total_power_mw: None, error: Some(error) },
    }
}

#[tauri::command]
fn run_demo_screen(state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
    let (width, height) = match detect_framebuffer_size(&state) {
        Ok(size) => size,
        Err(error) => {
            return PatternResult { success: false, message: String::new(), error: Some(error) }
        }
    };
    let width_arg = width.to_string();
    let height_arg = height.to_string();
    run_remote_python_script(
        &state,
        &project_file("python/fb_demo.py"),
        "/data/local/tmp/fb_demo.py",
        &[&width_arg, &height_arg],
    )
}

#[tauri::command]
fn run_logic_pattern(request: LogicPatternRequest, state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
    if request.pattern > 39 {
        return PatternResult {
            success: false,
            message: String::new(),
            error: Some("逻辑图案编号必须在 0-39 之间".to_string()),
        };
    }

    let command = format!("python3 /vismm/fbshow/logicPictureShow.py {}", request.pattern);
    match adb_shell_internal(&state, &command) {
        Ok(result) if result.success => PatternResult {
            success: true,
            message: format!("已显示逻辑图案 {}", request.pattern),
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

#[tauri::command]
fn display_text(request: TextDisplayRequest, state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
    let text = request.text.trim();
    if text.is_empty() {
        return PatternResult {
            success: false,
            message: String::new(),
            error: Some("文字内容不能为空".to_string()),
        };
    }

    let subtitle = request.subtitle.unwrap_or_default();
    let style = request.style.unwrap_or_else(|| "clean".to_string());

    run_remote_python_script(
        &state,
        &project_file("python/fb_text_custom.py"),
        "/data/local/tmp/fb_text_custom.py",
        &[
            &shell_quote(text),
            &shell_quote(&subtitle),
            &shell_quote(&style),
        ],
    )
}

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
fn mipi_send_command(command: String, state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
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
fn mipi_send_commands(commands: Vec<String>, state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
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
fn mipi_software_reset(state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    run_mipi_command(&state, "vismpwr 05 00 01 01", "已执行 Software Reset (01)")
}

#[tauri::command]
fn mipi_read_power_mode(state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
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
fn mipi_sleep_in(state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    run_mipi_command(&state, "vismpwr 05 00 01 28 && sleep 0.1 && vismpwr 05 00 01 10", "已执行关屏序列: 28 -> 10")
}

#[tauri::command]
fn mipi_sleep_out(state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    run_mipi_command(&state, "vismpwr 05 00 01 11 && sleep 0.12 && vismpwr 05 00 01 29", "已执行开屏序列: 11 -> 29")
}

#[tauri::command]
fn clear_screen(state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
    display_solid_color("black".to_string(), state)
}


// 命令清单存储路径：优先使用新文件名 command_presets.json，兼容旧文件 cmdx_list.json。
fn command_preset_data_paths() -> Result<(std::path::PathBuf, std::path::PathBuf), String> {
    let exe = std::env::current_exe().map_err(|e| format!("无法定位可执行文件路径: {}", e))?;
    let dir = exe.parent().ok_or_else(|| "无法定位可执行文件目录".to_string())?;
    Ok((dir.join("command_presets.json"), dir.join("cmdx_list.json")))
}

// 旧命令名兼容入口：保留给历史前端版本使用。
#[tauri::command]
fn load_cmdx_list() -> CommandPresetListResult {
    let mut items: Vec<CommandPresetItem> = (1..=30)
        .map(|i| CommandPresetItem {
            index: i - 1,
            name: format!("{:02}-CMD", i),
            content: String::new(),
        })
        .collect();

    let (primary_path, legacy_path) = match command_preset_data_paths() {
        Ok(paths) => paths,
        Err(err) => {
            return CommandPresetListResult { success: false, items, error: Some(err) };
        }
    };

    let path_to_read = if primary_path.exists() {
        primary_path.clone()
    } else {
        legacy_path.clone()
    };

    if path_to_read.exists() {
        match std::fs::read_to_string(&path_to_read) {
            Ok(raw) => match serde_json::from_str::<Vec<CommandPresetItem>>(&raw) {
                Ok(mut loaded) => {
                    loaded.sort_by_key(|item| item.index);
                    if !loaded.is_empty() {
                        items = loaded;
                    }
                    let note = if path_to_read == legacy_path {
                        Some(format!("已兼容读取旧命令清单文件: {}；后续保存将写入新文件 command_presets.json", legacy_path.display()))
                    } else {
                        None
                    };
                    CommandPresetListResult { success: true, items, error: note }
                }
                Err(err) => CommandPresetListResult { success: false, items, error: Some(format!("命令清单解析失败: {}", err)) },
            },
            Err(err) => CommandPresetListResult { success: false, items, error: Some(format!("读取命令清单失败: {}", err)) },
        }
    } else {
        CommandPresetListResult { success: true, items, error: None }
    }
}

// 旧命令名兼容入口：保留给历史前端版本使用。
#[tauri::command]
fn save_cmdx_list(items: Vec<CommandPresetItem>) -> GenericResult {
    let (primary_path, _) = match command_preset_data_paths() {
        Ok(paths) => paths,
        Err(err) => {
            return GenericResult { success: false, output: String::new(), error: Some(err) };
        }
    };

    let mut sorted = items;
    sorted.sort_by_key(|item| item.index);

    match serde_json::to_string_pretty(&sorted) {
        Ok(json) => match std::fs::write(&primary_path, json) {
            Ok(_) => GenericResult { success: true, output: format!("已保存命令清单: {}", primary_path.display()), error: None },
            Err(err) => GenericResult { success: false, output: String::new(), error: Some(format!("写入命令清单失败: {}", err)) },
        },
        Err(err) => GenericResult { success: false, output: String::new(), error: Some(format!("序列化命令清单失败: {}", err)) },
    }
}

// 新命令名：供当前前端与后续版本使用。
#[tauri::command]
fn load_command_presets() -> CommandPresetListResult {
    load_cmdx_list()
}

// 新命令名：供当前前端与后续版本使用。
#[tauri::command]
fn save_command_presets(items: Vec<CommandPresetItem>) -> GenericResult {
    save_cmdx_list(items)
}

fn resolve_existing_path(candidates: &[PathBuf]) -> Result<PathBuf, String> {
    for candidate in candidates {
        if candidate.exists() {
            return Ok(candidate.clone());
        }
    }

    let listed = candidates
        .iter()
        .map(|p| format!("{:?}", p))
        .collect::<Vec<_>>()
        .join("，");
    Err(format!("资源目录不存在，已尝试：{}", listed))
}

fn candidate_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            roots.push(exe_dir.to_path_buf());
            let mut current = exe_dir.to_path_buf();
            for _ in 0..4 {
                if let Some(parent) = current.parent() {
                    roots.push(parent.to_path_buf());
                    current = parent.to_path_buf();
                } else {
                    break;
                }
            }
        }
    }

    if let Ok(cwd) = std::env::current_dir() {
        roots.push(cwd.clone());
        let mut current = cwd;
        for _ in 0..4 {
            if let Some(parent) = current.parent() {
                roots.push(parent.to_path_buf());
                current = parent.to_path_buf();
            } else {
                break;
            }
        }
    }

    roots.sort();
    roots.dedup();
    roots
}

fn resolve_deploy_resource_dir(relative: &str, legacy_relative: Option<&str>) -> Result<PathBuf, String> {
    let roots = candidate_roots();
    let mut candidates = Vec::new();

    for root in roots {
        candidates.push(root.join(relative));
        if let Some(legacy) = legacy_relative {
            candidates.push(root.join(legacy));
        }
    }

    resolve_existing_path(&candidates)
}

fn adb_push_path(state: &tauri::State<Mutex<ConnectionState>>, local: &Path, remote: &str) -> Result<AdbActionResult, String> {
    let local_path = local.to_string_lossy().to_string();
    adb_push_internal(state, &local_path, remote)
}


fn ensure_remote_dirs(state: &tauri::State<Mutex<ConnectionState>>, dirs: &[&str]) -> Result<(), String> {
    if dirs.is_empty() {
        return Ok(());
    }
    let command = format!("mkdir -p {}", dirs.join(" "));
    let result = adb_shell_internal(state, &command)?;
    if result.success {
        Ok(())
    } else {
        Err(result.error.unwrap_or_else(|| format!("创建目录失败: {}", command)))
    }
}

fn run_shell_required(state: &tauri::State<Mutex<ConnectionState>>, command: &str) -> Result<String, String> {
    let result = adb_shell_internal(state, command)?;
    if result.success {
        Ok(result.output)
    } else {
        Err(result.error.unwrap_or_else(|| format!("执行命令失败: {}", command)))
    }
}

fn push_whl_and_install(state: &tauri::State<Mutex<ConnectionState>>, local_dir: &Path, remote_dir: &str) -> Result<Vec<String>, String> {
    let mut logs = Vec::new();
    ensure_remote_dirs(state, &[remote_dir])?;
    run_shell_required(state, &format!("chmod 777 {}", remote_dir))?;
    logs.push(format!("创建远程目录并设置权限: {}", remote_dir));

    let mut whl_files = fs::read_dir(local_dir)
        .map_err(|err| format!("读取 whl 目录失败: {}", err))?
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|path| path.extension().map_or(false, |ext| ext.eq_ignore_ascii_case("whl")))
        .collect::<Vec<_>>();

    whl_files.sort();
    if whl_files.is_empty() {
        return Err(format!("错误：未找到任何 .whl 文件，目录: {}", local_dir.display()));
    }

    logs.push(format!("找到 {} 个 whl 文件", whl_files.len()));

    for whl in whl_files {
        let file_name = whl
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .ok_or_else(|| format!("无效 whl 文件名: {}", whl.display()))?;

        let push_result = adb_push_path(state, &whl, &format!("{}/", remote_dir))?;
        if !push_result.success {
            return Err(push_result.error.unwrap_or_else(|| format!("上传 whl 失败: {}", file_name)));
        }
        logs.push(format!("上传 whl: {}", file_name));

        let install_command = format!("cd {} && pip install --no-index --find-links=. {}", remote_dir, shell_quote(&file_name));
        let install_output = run_shell_required(state, &install_command)?;
        logs.push(format!("安装 whl: {}", file_name));
        if !install_output.trim().is_empty() {
            logs.push(install_output.trim().to_string());
        }
    }

    let verify_output = run_shell_required(state, r#"python3 -c \"from PIL import Image; print(Image.__version__)\""#)?;
    logs.push(if verify_output.contains("9.5.0") {
        "Pillow 安装成功".to_string()
    } else {
        format!("Pillow 安装验证输出: {}", verify_output.trim())
    });

    Ok(logs)
}

fn ensure_i2c4_overlay_support(
    state: &tauri::State<Mutex<ConnectionState>>,
    dist_packages: &Path,
    logs: &mut Vec<String>,
) -> Result<(), String> {
    let detected_uenv = run_shell_required(
        state,
        "if [ -f /boot/boot.cmd ] && grep -q '/uEnv/uEnv.txt' /boot/boot.cmd; then echo /boot/uEnv/uEnv.txt; else echo unknown; fi",
    )?;
    let detected_uenv = detected_uenv.trim();
    if detected_uenv == "/boot/uEnv/uEnv.txt" {
        logs.push("已验证 boot.cmd 当前从 /boot/uEnv/uEnv.txt 读取 overlay 配置".to_string());
    } else {
        logs.push(format!("未能明确验证实际生效 uEnv 文件，仍按 /boot/uEnv/uEnv.txt 处理（检测结果: {}）", detected_uenv));
    }

    let has_i2c4 = run_shell_required(state, "if ls /dev | grep -qx 'i2c-4'; then echo yes; else echo no; fi")?;
    if has_i2c4.trim() == "yes" {
        logs.push("检测到 /dev/i2c-4 已存在，跳过 i2c4-m2 保守修复".to_string());
        return Ok(());
    }
    logs.push("未检测到 /dev/i2c-4，开始检查 i2c4-m2 overlay".to_string());

    let has_overlay = run_shell_required(
        state,
        "if [ -f /boot/dtb/overlay/rk3588-i2c4-m2-overlay.dtbo ]; then echo yes; else echo no; fi",
    )?;
    if has_overlay.trim() != "yes" {
        let local_overlay = dist_packages.join("rk3588-i2c4-m2-overlay.dtbo");
        if !local_overlay.exists() {
            return Err(format!("缺少 i2c4-m2 overlay 资源文件: {}", local_overlay.display()));
        }

        let push_result = adb_push_path(state, &local_overlay, "/boot/dtb/overlay/rk3588-i2c4-m2-overlay.dtbo")?;
        if !push_result.success {
            return Err(push_result.error.unwrap_or_else(|| "上传 rk3588-i2c4-m2-overlay.dtbo 失败".to_string()));
        }
        logs.push("已补齐 /boot/dtb/overlay/rk3588-i2c4-m2-overlay.dtbo".to_string());
    } else {
        logs.push("目标板已存在 /boot/dtb/overlay/rk3588-i2c4-m2-overlay.dtbo".to_string());
    }

    let overlay_line = "dtoverlay  =/dtb/overlay/rk3588-i2c4-m2-overlay.dtbo";
    let has_uenv_overlay = run_shell_required(
        state,
        "if grep -q '^dtoverlay[[:space:]]*=[[:space:]]*/dtb/overlay/rk3588-i2c4-m2-overlay.dtbo$' /boot/uEnv/uEnv.txt; then echo yes; else echo no; fi",
    )?;
    if has_uenv_overlay.trim() == "yes" {
        logs.push("/boot/uEnv/uEnv.txt 已启用 i2c4-m2 overlay".to_string());
    } else {
        run_shell_required(
            state,
            &format!(
                "python3 - <<'PY'\nfrom pathlib import Path\npath = Path('/boot/uEnv/uEnv.txt')\nraw = path.read_bytes()\nnewline = b'\\r\\n' if b'\\r\\n' in raw else b'\\n'\ntext = raw.decode('utf-8')\nline = {overlay_line:?}\nneedle = '/dtb/overlay/rk3588-i2c4-m2-overlay.dtbo'\nif needle not in text:\n    marker = '#overlay_end'\n    if marker in text:\n        text = text.replace(marker, line + ('\\r\\n' if newline == b'\\r\\n' else '\\n') + marker, 1)\n    else:\n        if not text.endswith(('\\n', '\\r\\n')):\n            text += '\\r\\n' if newline == b'\\r\\n' else '\\n'\n        text += line + ('\\r\\n' if newline == b'\\r\\n' else '\\n')\n    path.write_bytes(text.encode('utf-8'))\nPY"
            ),
        )?;
        logs.push("已在 /boot/uEnv/uEnv.txt 中补充 i2c4-m2 overlay 配置".to_string());
    }

    logs.push("i2c4-m2 保守修复完成；如需生效，请手动重启设备".to_string());
    Ok(())
}

#[tauri::command]
fn deploy_install_tools(state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    let dist_packages = match resolve_deploy_resource_dir("resources/deploy/dist-packages", Some("dist-packages")) {
        Ok(path) => path,
        Err(error) => {
            return GenericResult {
                success: false,
                output: String::new(),
                error: Some(error),
            };
        }
    };

    let python_libs = match resolve_deploy_resource_dir("resources/deploy/python-libs", Some("Python_lib")) {
        Ok(path) => path,
        Err(error) => {
            return GenericResult {
                success: false,
                output: String::new(),
                error: Some(error),
            };
        }
    };

    let mut logs = Vec::new();

    if let Err(error) = ensure_remote_dirs(&state, &[
        "/vismm",
        "/vismm/fbshow",
        "/vismm/fbshow/default",
        "/vismm/fbshow/bmp_online",
        "/vismm/tools",
        "/vismm/Python_lib",
        "/tmp/cpio",
    ]) {
        return GenericResult {
            success: false,
            output: logs.join("\n"),
            error: Some(error),
        };
    }
    logs.push("已确保关键目录存在".to_string());

    let dist_push = match adb_push_path(&state, &dist_packages.join("."), "/usr/lib/python3/dist-packages") {
        Ok(result) => result,
        Err(error) => {
            return GenericResult {
                success: false,
                output: logs.join("\n"),
                error: Some(error),
            };
        }
    };
    if !dist_push.success {
        return GenericResult {
            success: false,
            output: logs.join("\n"),
            error: dist_push.error.or(Some("上传 dist-packages 失败".to_string())),
        };
    }
    logs.push("已上传 dist-packages 到 /usr/lib/python3/dist-packages".to_string());

    match run_shell_required(&state, "chmod 777 /usr/lib/python3/dist-packages") {
        Ok(_) => logs.push("已设置 /usr/lib/python3/dist-packages 权限".to_string()),
        Err(error) => {
            return GenericResult {
                success: false,
                output: logs.join("\n"),
                error: Some(error),
            };
        }
    }

    match push_whl_and_install(&state, &python_libs, "/vismm/Python_lib") {
        Ok(mut whl_logs) => logs.append(&mut whl_logs),
        Err(error) => {
            return GenericResult {
                success: false,
                output: logs.join("\n"),
                error: Some(error),
            };
        }
    }

    let deb_file = dist_packages.join("cpio_2.13+dfsg-2ubuntu0.4_arm64.deb");
    if !deb_file.exists() {
        return GenericResult {
            success: false,
            output: logs.join("\n"),
            error: Some(format!("缺少 cpio 安装包: {}", deb_file.display())),
        };
    }

    let deb_push = match adb_push_path(&state, &deb_file, "/tmp/cpio/cpio_2.13+dfsg-2ubuntu0.4_arm64.deb") {
        Ok(result) => result,
        Err(error) => {
            return GenericResult {
                success: false,
                output: logs.join("\n"),
                error: Some(error),
            };
        }
    };
    if !deb_push.success {
        return GenericResult {
            success: false,
            output: logs.join("\n"),
            error: deb_push.error.or(Some("上传 cpio 安装包失败".to_string())),
        };
    }
    logs.push("已上传 cpio 安装包".to_string());

    let install_output = match run_shell_required(&state, "dpkg -i /tmp/cpio/cpio_2.13+dfsg-2ubuntu0.4_arm64.deb") {
        Ok(output) => output,
        Err(error) => {
            return GenericResult {
                success: false,
                output: logs.join("\n"),
                error: Some(error),
            };
        }
    };
    logs.push("已执行 cpio 安装".to_string());
    if install_output.contains("Setting up cpio") {
        logs.push("cpio 安装成功".to_string());
    } else if !install_output.trim().is_empty() {
        logs.push(install_output.trim().to_string());
    }

    match run_shell_required(&state, "dpkg -l | grep cpio") {
        Ok(output) => logs.push(format!("验证 cpio: {}", output.trim())),
        Err(error) => {
            return GenericResult {
                success: false,
                output: logs.join("\n"),
                error: Some(error),
            };
        }
    }

    let repack_script = dist_packages.join("repack_initrd.sh");
    if !repack_script.exists() {
        return GenericResult {
            success: false,
            output: logs.join("\n"),
            error: Some(format!("缺少 repack_initrd.sh: {}", repack_script.display())),
        };
    }

    let repack_push = match adb_push_path(&state, &repack_script, "/vismm/tools/repack_initrd.sh") {
        Ok(result) => result,
        Err(error) => {
            return GenericResult {
                success: false,
                output: logs.join("\n"),
                error: Some(error),
            };
        }
    };
    if !repack_push.success {
        return GenericResult {
            success: false,
            output: logs.join("\n"),
            error: repack_push.error.or(Some("上传 repack_initrd.sh 失败".to_string())),
        };
    }
    logs.push("已上传 repack_initrd.sh 到 /vismm/tools".to_string());

    match run_shell_required(&state, "chmod +x /vismm/tools/repack_initrd.sh") {
        Ok(_) => logs.push("已设置 /vismm/tools/repack_initrd.sh 可执行权限".to_string()),
        Err(error) => {
            return GenericResult {
                success: false,
                output: logs.join("\n"),
                error: Some(error),
            };
        }
    }

    if let Err(error) = ensure_i2c4_overlay_support(&state, &dist_packages, &mut logs) {
        return GenericResult {
            success: false,
            output: logs.join("\n"),
            error: Some(error),
        };
    }

    GenericResult {
        success: true,
        output: logs.join("\n"),
        error: None,
    }
}

/// 部署刷图应用（Install App）
/// 对应 C# 的 ADB_ShowApp_Setup，推送 fb_operate 目录下的所有文件到设备
/// UI分组: 默认显示与模式(含SSH) + 系统UI(仅graphical)
/// 对齐 C# 的 ADB_AutorunApp_Setup，保持简洁但保留日志
fn deploy_autorun_bundle(state: &tauri::State<Mutex<ConnectionState>>, bundle_dir: &Path, logs: &mut Vec<String>) -> Result<(), String> {
    logs.push(format!("开始部署 autorun bundle: {}", bundle_dir.display()));

    let autorun = bundle_dir.join("autorun.py");
    logs.push(format!("检查 autorun.py: {}", autorun.display()));
    if !autorun.exists() {
        return Err(format!("缺少 autorun.py: {}", autorun.display()));
    }

    let service_dir = resolve_deploy_resource_dir("resources/deploy/fb-RunApp/default", Some("fb_RunApp/default"))?;
    logs.push(format!("service 目录: {}", service_dir.display()));
    let service_candidates = [
        service_dir.join("big8k-autorun.service"),
        service_dir.join("chenfeng-service.service"),
    ];
    let service_file = service_candidates
        .iter()
        .find(|path| path.exists())
        .cloned()
        .ok_or_else(|| format!("缺少 autorun service 文件"))?;
    let service_name = service_file
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .ok_or_else(|| "无效 service 文件名".to_string())?;
    logs.push(format!("使用 service 文件: {}", service_file.display()));

    let _ = adb_shell_internal(state, "rm -f /vismm/autorun.py");
    logs.push("已删除旧 autorun.py".to_string());

    let push_fbshow = adb_push_path(state, &autorun, "/vismm/fbshow/autorun.py")?;
    if !push_fbshow.success {
        return Err(push_fbshow.error.unwrap_or_else(|| "推送 /vismm/fbshow/autorun.py 失败".to_string()));
    }
    logs.push("已推送 autorun.py -> /vismm/fbshow/autorun.py".to_string());
    run_shell_required(state, "chmod 444 /vismm/fbshow/autorun.py")?;
    logs.push("已设置 /vismm/fbshow/autorun.py 权限".to_string());

    let push_root = adb_push_path(state, &autorun, "/vismm/autorun.py")?;
    if !push_root.success {
        return Err(push_root.error.unwrap_or_else(|| "推送 /vismm/autorun.py 失败".to_string()));
    }
    logs.push("已推送 autorun.py -> /vismm/autorun.py".to_string());
    run_shell_required(state, "chmod 444 /vismm/autorun.py")?;
    logs.push("已设置 /vismm/autorun.py 权限".to_string());

    let push_service = adb_push_path(state, &service_file, &format!("/etc/systemd/system/{}", service_name))?;
    if !push_service.success {
        return Err(push_service.error.unwrap_or_else(|| format!("推送 service 失败: {}", service_name)));
    }
    logs.push(format!("已推送 {} -> /etc/systemd/system/{}", service_name, service_name));

    let daemon_reload = run_shell_required(state, "systemctl daemon-reload")?;
    logs.push("已执行 systemctl daemon-reload".to_string());
    if !daemon_reload.trim().is_empty() {
        logs.push(format!("daemon-reload 输出: {}", daemon_reload.trim()));
    }

    let enable_output = run_shell_required(state, &format!("systemctl enable {}", service_name))?;
    logs.push(format!("已执行 systemctl enable {}", service_name));
    if !enable_output.trim().is_empty() {
        logs.push(format!("enable 输出: {}", enable_output.trim()));
    }

    let restart_output = run_shell_required(state, &format!("systemctl restart {}", service_name))?;
    logs.push(format!("已执行 systemctl restart {}", service_name));
    if !restart_output.trim().is_empty() {
        logs.push(format!("restart 输出: {}", restart_output.trim()));
    }

    logs.push(format!("autorun 部署完成 ({})", service_name));
    Ok(())
}

fn deploy_named_autorun_bundle(
    state: &tauri::State<Mutex<ConnectionState>>,
    resource_relative: &str,
    legacy_relative: &str,
    success_message: &str,
) -> GenericResult {
    let bundle_dir = match resolve_deploy_resource_dir(resource_relative, Some(legacy_relative)) {
        Ok(path) => path,
        Err(error) => {
            return GenericResult {
                success: false,
                output: String::new(),
                error: Some(error),
            };
        }
    };

    let mut logs = Vec::new();
    match deploy_autorun_bundle(state, &bundle_dir, &mut logs) {
        Ok(_) => {
            logs.push(success_message.to_string());
            GenericResult {
                success: true,
                output: logs.join("\n"),
                error: None,
            }
        }
        Err(error) => GenericResult {
            success: false,
            output: logs.join("\n"),
            error: Some(error),
        },
    }
}

fn set_default_target_and_reboot(state: &tauri::State<Mutex<ConnectionState>>, target: &str) -> GenericResult {
    let mut logs = Vec::new();
    match run_shell_required(state, &format!("systemctl set-default {}", target)) {
        Ok(output) => {
            logs.push(format!("已切换为 {}", target));
            if !output.trim().is_empty() {
                logs.push(output.trim().to_string());
            }
        }
        Err(error) => {
            return GenericResult {
                success: false,
                output: logs.join("\n"),
                error: Some(error),
            };
        }
    }

    match run_shell_required(state, "reboot") {
        Ok(output) => {
            logs.push("已执行 reboot".to_string());
            if !output.trim().is_empty() {
                logs.push(output.trim().to_string());
            }
            GenericResult {
                success: true,
                output: logs.join("\n"),
                error: None,
            }
        }
        Err(error) => GenericResult {
            success: false,
            output: logs.join("\n"),
            error: Some(error),
        },
    }
}

#[tauri::command]
fn deploy_install_app(state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    let fb_operate = match resolve_deploy_resource_dir("resources/deploy/fb-operate", Some("fb_operate")) {
        Ok(path) => path,
        Err(error) => {
            return GenericResult {
                success: false,
                output: String::new(),
                error: Some(error),
            };
        }
    };

    let mut logs: Vec<String> = Vec::new();

    // 创建目录
    let mkdir_result = adb_shell_internal(&state, "mkdir -p /vismm/fbshow/movie_online && mkdir -p /vismm/fbshow/bmp_online");
    match mkdir_result {
        Ok(result) if result.success => logs.push("创建目录: /vismm/fbshow/movie_online, /vismm/fbshow/bmp_online".to_string()),
        Ok(result) => {
            return GenericResult {
                success: false,
                output: logs.join("\n"),
                error: Some(format!("创建目录失败: {}", result.error.unwrap_or_default())),
            };
        }
        Err(err) => {
            return GenericResult {
                success: false,
                output: logs.join("\n"),
                error: Some(format!("创建目录异常: {}", err)),
            };
        }
    }

    // 定义需要推送的文件
    let push_files = [
        ("vismpwr", "/usr/local/bin/vismpwr"),
        ("disableService.sh", "/vismm/disableService.sh"),
        ("repack_initrd.sh", "/usr/local/bin/repack_initrd.sh"),
        ("fbShowBmp", "/vismm/fbshow/fbShowBmp"),
        ("fbShowPattern", "/vismm/fbshow/fbShowPattern"),
        ("fbShowMovie", "/vismm/fbshow/fbShowMovie"),
        ("xdotool", "/usr/bin/xdotool"),
    ];

    for (file_name, remote_path) in &push_files {
        let local_path = fb_operate.join(file_name);
        if !local_path.exists() {
            logs.push(format!("跳过不存在的文件: {}", file_name));
            continue;
        }

        let local = local_path.to_string_lossy().to_string();
        match adb_push_internal(&state, &local, remote_path) {
            Ok(result) if result.success => logs.push(format!("推送 {} -> {}", file_name, remote_path)),
            Ok(result) => {
                logs.push(format!("推送 {} 失败: {}", file_name, result.error.unwrap_or_default()));
            }
            Err(err) => {
                logs.push(format!("推送 {} 异常: {}", file_name, err));
            }
        }
    }

    // 推送所有 .py 文件
    if let Ok(entries) = std::fs::read_dir(&fb_operate) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "py") {
                let file_name = path.file_name().unwrap().to_string_lossy().to_string();
                let local = path.to_string_lossy().to_string();
                let remote = format!("/vismm/fbshow/{}", file_name);
                match adb_push_internal(&state, &local, &remote) {
                    Ok(result) if result.success => logs.push(format!("推送 {} -> /vismm/fbshow/", file_name)),
                    Ok(result) => logs.push(format!("推送 {} 失败: {}", file_name, result.error.unwrap_or_default())),
                    Err(err) => logs.push(format!("推送 {} 异常: {}", file_name, err)),
                }
            }
        }
    }

    // 设置权限
    let chmod_commands = [
        "chmod +x /usr/local/bin/vismpwr",
        "chmod +x /vismm/disableService.sh",
        "chmod +x /usr/local/bin/repack_initrd.sh",
        "chmod 777 /vismm/fbshow/fbShowBmp",
        "chmod 777 /vismm/fbshow/fbShowPattern",
        "chmod 777 /vismm/fbshow/fbShowMovie",
        "chmod 777 /usr/bin/xdotool",
        "chmod +x /vismm/disableService.sh",
    ];

    for cmd in &chmod_commands {
        match adb_shell_internal(&state, cmd) {
            Ok(result) if result.success => logs.push(format!("权限设置: {}", cmd)),
            _ => logs.push(format!("权限设置失败: {}", cmd)),
        }
    }

    // 关闭非必要服务
    let disable_service_result = adb_shell_internal(&state, "/vismm/disableService.sh");
    match disable_service_result {
        Ok(result) if result.success => logs.push("执行 disableService.sh 完成".to_string()),
        _ => logs.push("执行 disableService.sh 失败".to_string()),
    }

    // 关闭光标闪烁服务
    let cursor_blink_commands = [
        "systemctl enable disable-cursor-blink.service",
        "systemctl start disable-cursor-blink.service",
    ];

    for cmd in &cursor_blink_commands {
        match adb_shell_internal(&state, cmd) {
            Ok(result) if result.success => logs.push(format!("执行: {}", cmd)),
            _ => logs.push(format!("执行失败: {}", cmd)),
        }
    }

    let default_bundle = match resolve_deploy_resource_dir("resources/deploy/fb-RunApp/default", Some("fb_RunApp/default")) {
        Ok(path) => path,
        Err(error) => {
            return GenericResult {
                success: false,
                output: logs.join("\n"),
                error: Some(error),
            };
        }
    };

    if let Err(error) = deploy_autorun_bundle(&state, &default_bundle, &mut logs) {
        return GenericResult {
            success: false,
            output: logs.join("\n"),
            error: Some(error),
        };
    }

    logs.push("Install App 完成".to_string());

    GenericResult {
        success: true,
        output: logs.join("\n"),
        error: None,
    }
}

#[tauri::command]
fn deploy_set_default_pattern(state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    deploy_named_autorun_bundle(
        &state,
        "resources/deploy/fb-RunApp/default",
        "fb_RunApp/default",
        "开机刷白脚本推送完成并运行",
    )
}

#[tauri::command]
fn deploy_set_default_movie(state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    deploy_named_autorun_bundle(
        &state,
        "resources/deploy/fb-RunApp/default_movie",
        "fb_RunApp/default_movie",
        "开机自动播放视频脚本推送完成并运行",
    )
}

#[tauri::command]
fn deploy_set_multi_user(state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    set_default_target_and_reboot(&state, "multi-user.target")
}

#[tauri::command]
fn deploy_set_graphical(state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    let mut logs = Vec::new();
    match run_shell_required(&state, "systemctl set-default graphical.target") {
        Ok(output) => {
            logs.push("已切换为 graphical.target".to_string());
            if !output.trim().is_empty() {
                logs.push(output.trim().to_string());
            }
        }
        Err(error) => return GenericResult { success: false, output: logs.join("\n"), error: Some(error) },
    }

    match run_shell_required(&state, "reboot") {
        Ok(output) => {
            logs.push("已执行 reboot".to_string());
            if !output.trim().is_empty() {
                logs.push(output.trim().to_string());
            }
            GenericResult { success: true, output: logs.join("\n"), error: None }
        }
        Err(error) => GenericResult { success: false, output: logs.join("\n"), error: Some(error) },
    }
}

#[tauri::command]
fn list_remote_files(request: ListRemoteFilesRequest, state: tauri::State<Mutex<ConnectionState>>) -> ListRemoteFilesResult {
    let device_id = match resolve_device_id(&state) {
        Ok(id) => id,
        Err(error) => {
            return ListRemoteFilesResult {
                success: false,
                files: vec![],
                error: Some(error),
            };
        }
    };

    let command = vec!["-s", &device_id, "shell", "ls", "-1", &request.path];
    match run_adb(&command) {
        Ok(output) => {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let files: Vec<String> = stdout
                    .lines()
                    .map(|line| line.trim().to_string())
                    .filter(|line| !line.is_empty())
                    .collect();
                ListRemoteFilesResult {
                    success: true,
                    files,
                    error: None,
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                ListRemoteFilesResult {
                    success: false,
                    files: vec![],
                    error: Some(if stderr.is_empty() { "列出目录失败".to_string() } else { stderr }),
                }
            }
        }
        Err(error) => ListRemoteFilesResult {
            success: false,
            files: vec![],
            error: Some(error),
        },
    }
}

#[tauri::command]
fn upload_file_base64(request: UploadFileBase64Request, state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
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

    // 解码 base64
    let decoded = match base64::engine::general_purpose::STANDARD.decode(&request.base64_data) {
        Ok(data) => data,
        Err(error) => {
            return GenericResult {
                success: false,
                output: String::new(),
                error: Some(format!("Base64 解码失败: {}", error)),
            };
        }
    };

    // 写入临时文件
    let temp_dir = std::env::temp_dir();
    let temp_file = temp_dir.join("big8k_upload_temp");
    if let Err(error) = std::fs::write(&temp_file, &decoded) {
        return GenericResult {
            success: false,
            output: String::new(),
            error: Some(format!("写入临时文件失败: {}", error)),
        };
    }

    // 确保 远程目录存在
    if let Some(parent) = Path::new(&request.remote_path).parent() {
        let parent_path = parent.to_string_lossy();
        let mkdir_cmd = vec!["-s", &device_id, "shell", "mkdir", "-p", &parent_path];
        let _ = run_adb(&mkdir_cmd);
    }

    // 使用 adb push 推送
    let local_path = temp_file.to_string_lossy().to_string();
    let command = vec!["-s", &device_id, "push", &local_path, &request.remote_path];
    let result = match run_adb(&command) {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            if output.status.success() {
                GenericResult {
                    success: true,
                    output: stdout,
                    error: None,
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                GenericResult {
                    success: false,
                    output: stdout,
                    error: Some(if stderr.is_empty() { "上传失败".to_string() } else { stderr }),
                }
            }
        }
        Err(error) => GenericResult {
            success: false,
            output: String::new(),
            error: Some(error),
        },
    };

    // 清理临时文件
    let _ = std::fs::remove_file(&temp_file);

    result
}

#[tauri::command]
fn run_remote_script(request: RunRemoteScriptRequest, state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
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

    let mut command = format!("python3 {}", shell_quote(&request.script_path));
    if let Some(args) = request.script_args.as_ref().map(|value| value.trim()).filter(|value| !value.is_empty()) {
        command.push(' ');
        command.push_str(args);
    }

    match run_adb_nowait(&["-s", &device_id, "shell", &command]) {
        Ok(()) => GenericResult {
            success: true,
            output: format!("脚本已后台启动: {}", request.script_path),
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
fn set_script_autorun(request: SetScriptAutorunRequest, state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    let script_path = request.script_path.trim();
    if script_path.is_empty() {
        return GenericResult { success: false, output: String::new(), error: Some("脚本路径不能为空".to_string()) };
    }

    let mut logs = Vec::new();
    for target in ["/vismm/fbshow/autorun.py", "/vismm/autorun.py"] {
        let command = format!("cp {} {} && chmod 444 {}", shell_quote(script_path), target, target);
        match run_shell_required(&state, &command) {
            Ok(output) => {
                logs.push(format!("已设置 {} <- {}", target, script_path));
                if !output.trim().is_empty() {
                    logs.push(output.trim().to_string());
                }
            }
            Err(error) => {
                return GenericResult { success: false, output: logs.join("\n"), error: Some(error) };
            }
        }
    }

    GenericResult { success: true, output: logs.join("\n"), error: None }
}

#[tauri::command]
fn delete_remote_file(request: DeleteRemoteFileRequest, state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    let file_path = request.file_path.trim();
    if file_path.is_empty() {
        return GenericResult { success: false, output: String::new(), error: Some("文件路径不能为空".to_string()) };
    }

    let command = format!("rm -f {}", shell_quote(file_path));
    match adb_shell_internal(&state, &command) {
        Ok(result) if result.success => GenericResult {
            success: true,
            output: if result.output.trim().is_empty() { format!("已删除文件: {}", file_path) } else { result.output },
            error: None,
        },
        Ok(result) => GenericResult {
            success: false,
            output: result.output,
            error: result.error.or(Some("删除文件失败".to_string())),
        },
        Err(error) => GenericResult {
            success: false,
            output: String::new(),
            error: Some(error),
        },
    }
}

#[tauri::command]
fn stop_remote_script(state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
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

    // 杀掉所有 python3 进程
    let command = vec!["-s", &device_id, "shell", "killall", "python3"];
    match run_adb(&command) {
        Ok(output) => {
            if output.status.success() {
                GenericResult {
                    success: true,
                    output: "已停止脚本执行".to_string(),
                    error: None,
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                GenericResult {
                    success: false,
                    output: String::new(),
                    error: Some(if stderr.is_empty() { "停止失败".to_string() } else { stderr }),
                }
            }
        }
        Err(error) => GenericResult {
            success: false,
            output: String::new(),
            error: Some(error),
        },
    }
}

#[tauri::command]
fn setup_loop_images(_request: SetupLoopImagesRequest, state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    let bundle_dir = match resolve_deploy_resource_dir("resources/deploy/fb-RunApp/default_bmp", Some("fb_RunApp/default_bmp")) {
        Ok(path) => path,
        Err(error) => {
            return GenericResult { success: false, output: String::new(), error: Some(error) };
        }
    };

    let mut logs = Vec::new();
    match deploy_autorun_bundle(&state, &bundle_dir, &mut logs) {
        Ok(_) => {
            logs.push("循环播放图片脚本推送完成并运行！".to_string());
            GenericResult { success: true, output: logs.join("\n"), error: None }
        }
        Err(error) => GenericResult { success: false, output: logs.join("\n"), error: Some(error) },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(ConnectionState::default()))
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            adb_devices,
            adb_select_device,
            adb_connect,
            adb_disconnect,
            adb_shell,
            adb_push,
            adb_pull,
            adb_probe_device,
            get_local_network_info,
            set_static_ip,
            ssh_connect,
            ssh_exec,
            display_solid_color,
            display_gradient,
            display_color_bar,
            display_checkerboard,
            sync_runtime_patterns,
            run_runtime_pattern,
            read_power_rails,
            pick_image_directory,
            create_image_preview,
            list_images_in_directory,
            run_demo_screen,
            run_logic_pattern,
            display_text,
            display_image_from_base64,
            display_remote_image,
            display_image,
            setup_loop_images,
            play_video,
            get_video_playback_status,
            send_video_control,
            mipi_send_command,
            mipi_send_commands,
            mipi_software_reset,
            mipi_read_power_mode,
            mipi_sleep_in,
            mipi_sleep_out,
            clear_screen,
            pick_lcd_config_file,
            parse_legacy_lcd_bin,
            generate_timing_bin,
            export_oled_config_json,
            download_oled_config_and_reboot,
            load_cmdx_list,
            save_cmdx_list,
            load_command_presets,
            save_command_presets,
            deploy_install_tools,
            deploy_install_app,
            deploy_set_default_pattern,
            deploy_set_default_movie,
            deploy_set_multi_user,
            deploy_set_graphical,
            list_remote_files,
            upload_file_base64,
            run_remote_script,
            stop_remote_script,
            set_script_autorun,
            delete_remote_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
