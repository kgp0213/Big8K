mod host_env;

use base64::Engine;
use serde::{Deserialize, Serialize};
use host_env::get_local_network_info;
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
struct PlayVideoRequest {
    video_path: String,
    zoom_mode: i32,
    show_framerate: i32,
}

#[derive(Debug, Serialize, Deserialize)]
struct VideoControlRequest {
    action: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct VideoPlaybackStatus {
    success: bool,
    is_running: bool,
    output: String,
    error: Option<String>,
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

fn run_adb(args: &[&str]) -> Result<std::process::Output, String> {
    let mut command = Command::new("adb");
    command.args(args);

    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command
        .output()
        .map_err(|e| format!("执行 adb 失败: {}。请确认 adb 已安装并加入 PATH", e))
}

fn run_adb_nowait(args: &[&str]) -> Result<(), String> {
    let mut command = Command::new("adb");
    command.args(args);
    command.stdout(Stdio::null()).stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("执行 adb 后台命令失败: {}。请确认 adb 已安装并加入 PATH", e))
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

fn resolve_device_id(state: &tauri::State<Mutex<ConnectionState>>) -> Result<String, String> {
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

fn adb_shell_internal(
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

fn adb_push_internal(
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

fn run_remote_python_script(
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

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\\', "\\\\").replace('\'', "'\"'\"'"))
}

fn project_root() -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or_else(|| std::path::Path::new(env!("CARGO_MANIFEST_DIR")))
        .to_path_buf()
}

fn project_file(path: &str) -> String {
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
    let command = r#"MODEL=$(getprop ro.product.model 2>/dev/null); VSIZE=$(cat /sys/class/graphics/fb0/virtual_size 2>/dev/null); BPP=$(cat /sys/class/graphics/fb0/bits_per_pixel 2>/dev/null); if dmesg 2>/dev/null | grep -q 'Initialized in CMD mode'; then MIPI_MODE=CMD; else MIPI_MODE=VIDEO; fi; LANES=$( (dmesg 2>/dev/null | grep -ioE 'dsi,lanes: *[0-9]+' | tail -n 1 | grep -ioE '[0-9]+') || (dmesg 2>/dev/null | grep -ioE 'lanes=[0-9]+' | tail -n 1 | grep -ioE '[0-9]+') ); [ -e /dev/fb0 ] && echo FB0=1 || echo FB0=0; command -v vismpwr >/dev/null 2>&1 && echo VISMPWR=1 || echo VISMPWR=0; command -v python3 >/dev/null 2>&1 && echo PYTHON3=1 || echo PYTHON3=0; CPU=$(awk '/cpu / {usage=($2+$4)*100/($2+$4+$5)} END {printf("%.1f%%", usage)}' /proc/stat 2>/dev/null); MEM=$(awk '/MemTotal/ {t=$2} /MemAvailable/ {a=$2} END {if (t>0) printf("%.1f%% (%dMB / %dMB)", (t-a)*100/t, (t-a)/1024, t/1024)}' /proc/meminfo 2>/dev/null); TEMP=$(awk '{printf("%.1f", $1/1000)}' /sys/class/thermal/thermal_zone0/temp 2>/dev/null); echo MODEL=$MODEL; echo VSIZE=$VSIZE; echo BPP=$BPP; echo MIPI_MODE=$MIPI_MODE; echo LANES=$LANES; echo CPU=$CPU; echo MEM=$MEM; echo TEMP=$TEMP"#;

    match adb_shell_internal(&state, command) {
        Ok(result) if result.success => {
            let mut model = None;
            let mut virtual_size = None;
            let mut bits_per_pixel = None;
            let mut mipi_mode = None;
            let mut mipi_lanes = None;
            let mut fb0_available = false;
            let mut vismpwr_available = false;
            let mut python3_available = false;
            let mut cpu_usage = None;
            let mut memory_usage = None;
            let mut temperature_c = None;

            for line in result.output.lines() {
                if let Some(value) = line.strip_prefix("MODEL=") {
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
                } else if let Some(value) = line.strip_prefix("MIPI_MODE=") {
                    if !value.trim().is_empty() {
                        mipi_mode = Some(value.trim().to_string());
                    }
                } else if let Some(value) = line.strip_prefix("LANES=") {
                    if let Ok(parsed) = value.trim().parse::<u32>() {
                        if parsed > 0 {
                            mipi_lanes = Some(parsed);
                        }
                    }
                } else if line.trim() == "FB0=1" {
                    fb0_available = true;
                } else if line.trim() == "VISMPWR=1" {
                    vismpwr_available = true;
                } else if line.trim() == "PYTHON3=1" {
                    python3_available = true;
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

            DeviceProbeResult {
                success: true,
                model,
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
        Ok(result) => DeviceProbeResult {
            success: false,
            model: None,
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
            error: result.error.or(Some("ADB 设备探测失败".to_string())),
        },
        Err(error) => DeviceProbeResult {
            success: false,
            model: None,
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
        },
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

#[tauri::command]
fn sync_runtime_patterns(state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
    let remote_dir = "/vismm/fbshow/big8k_runtime";
    match adb_shell_internal(&state, &format!("mkdir -p {}", remote_dir)) {
        Ok(result) if !result.success => {
            return PatternResult { success: false, message: result.output, error: result.error };
        }
        Err(error) => {
            return PatternResult { success: false, message: String::new(), error: Some(error) };
        }
        _ => {}
    }

    match adb_push_internal(&state, &project_file("python/runtime_fbshow/render_patterns.py"), "/vismm/fbshow/big8k_runtime/render_patterns.py") {
        Ok(result) if result.success => {}
        Ok(result) => {
            return PatternResult { success: false, message: result.output, error: result.error };
        }
        Err(error) => {
            return PatternResult { success: false, message: String::new(), error: Some(error) };
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
fn run_runtime_pattern(request: RuntimePatternRequest, state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
    let command = format!("python3 /vismm/fbshow/big8k_runtime/render_patterns.py {}", shell_quote(&request.pattern));
    match adb_shell_internal(&state, &command) {
        Ok(result) => {
            // adb shell 本身可能返回成功，但 Python 脚本可能失败
            // 检查输出中是否包含错误信息
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

#[tauri::command]
fn display_image_from_base64(request: ImageDisplayFromBase64Request, state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
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
            return PatternResult { success: false, message: String::new(), error: Some(format!("Base64 解码失败: {}", err)) }
        }
    };
    if let Err(err) = std::fs::write(&local_path, decoded) {
        return PatternResult { success: false, message: String::new(), error: Some(format!("写入临时图片失败: {}", err)) };
    }
    let result = display_image(ImageDisplayRequest { image_path: local_path.to_string_lossy().to_string(), remote_name: request.remote_name.clone() }, state);
    let _ = std::fs::remove_file(local_path);
    result
}

#[tauri::command]
fn display_remote_image(remote_image_path: String, state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
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
fn display_image(request: ImageDisplayRequest, state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
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
        .map(|c| if c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-' { c } else { '_' })
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

fn write_entry(buffer: &mut Vec<u8>, offset: u32, length: u32) {
    buffer.extend_from_slice(&offset.to_le_bytes());
    buffer.extend_from_slice(&length.to_le_bytes());
}

fn align(size: usize, alignment: usize) -> usize {
    (size + alignment - 1) & !(alignment - 1)
}

fn parse_hex_csv_line(line: &str) -> Result<Vec<u8>, String> {
    let bytes: Result<Vec<u8>, String> = line
        .split(|c: char| c == ',' || c.is_whitespace())
        .filter(|part| !part.trim().is_empty())
        .map(|part| u8::from_str_radix(part.trim(), 16).map_err(|_| format!("初始化代码字节解析失败: {}", part.trim())))
        .collect();
    bytes
}

fn parse_legacy_lcd_bin_file(path: &str) -> Result<LegacyLcdConfigResult, String> {
    let bytes = std::fs::read(path).map_err(|e| format!("读取点屏配置失败: {}", e))?;
    if bytes.len() < 200 {
        return Err(format!("点屏配置文件长度不足，至少需要 200 字节，实际 {} 字节", bytes.len()));
    }

    let raw_pclk_hz = u32::from_be_bytes([bytes[1], bytes[2], bytes[3], bytes[4]]) as u64;
    let pclk = if raw_pclk_hz >= 1_000_000 {
        raw_pclk_hz / 1000
    } else {
        raw_pclk_hz
    };
    let hact = u16::from_be_bytes([bytes[5], bytes[6]]) as u32;
    let vact = u16::from_be_bytes([bytes[7], bytes[8]]) as u32;
    let hbp = u16::from_be_bytes([bytes[9], bytes[10]]) as u32;
    let vbp = u16::from_be_bytes([bytes[11], bytes[12]]) as u32;
    let hfp = u16::from_be_bytes([bytes[13], bytes[14]]) as u32;
    let vfp = u16::from_be_bytes([bytes[15], bytes[16]]) as u32;
    let hsync = u16::from_be_bytes([bytes[17], bytes[18]]) as u32;
    let vsync = u16::from_be_bytes([bytes[19], bytes[20]]) as u32;

    let hs_polarity = bytes[21] != 0;
    let vs_polarity = bytes[22] != 0;
    let de_polarity = bytes[23] != 0;
    let clk_polarity = bytes[24] != 0;

    let lanes = bytes[27];
    let interface_type = match bytes[30] {
        1 => "EDP",
        2 => "DP",
        _ => "MIPI",
    }
    .to_string();
    let mipi_mode = match bytes[31] {
        1 => "Command",
        _ => "Video",
    }
    .to_string();
    let video_type = match bytes[32] {
        0 => "BURST_MODE",
        1 => "NON_BURST_SYNC_PULSES",
        _ => "NON_BURST_SYNC_EVENTS",
    }
    .to_string();
    let format = match bytes[33] {
        0 => "RGB888",
        1 => "RGB666",
        2 => "RGB666_PACKED",
        3 => "RGB565",
        _ => "RGB888",
    }
    .to_string();
    let phy_mode = if bytes[34] == 1 { "CPHY" } else { "DPHY" }.to_string();
    let dsc_enable = bytes[35] != 0;
    let scrambling_enable = bytes[36] != 0;
    let data_swap = bytes[37] != 0;
    let dual_channel = bytes[38] != 0;
    let slice_width = u16::from_be_bytes([bytes[39], bytes[40]]) as u32;
    let slice_height = u16::from_be_bytes([bytes[41], bytes[42]]) as u32;
    let dsc_version = if bytes[43] == 1 && bytes[44] == 2 {
        "Vesa1.2"
    } else {
        "Ver1.1"
    }
    .to_string();

    let mut init_codes = Vec::new();
    let mut i = 200usize;
    while i < bytes.len() {
        if i + 2 >= bytes.len() {
            break;
        }
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
            hact,
            vact,
            pclk,
            hfp,
            hbp,
            hsync,
            vfp,
            vbp,
            vsync,
            hs_polarity,
            vs_polarity,
            de_polarity,
            clk_polarity,
            interface_type,
            mipi_mode,
            video_type,
            lanes,
            format,
            phy_mode,
            dsc_enable,
            dsc_version,
            slice_width,
            slice_height,
            scrambling_enable,
            data_swap,
            dual_channel,
        }),
        init_codes,
        error: None,
    })
}

fn parse_oled_config_json_file(path: &str) -> Result<LegacyLcdConfigResult, String> {
    let raw = std::fs::read_to_string(path).map_err(|e| format!("读取 OLED 配置 JSON 失败: {}", e))?;
    let request: TimingBinRequest = serde_json::from_str(&raw).map_err(|e| format!("解析 OLED 配置 JSON 失败: {}", e))?;

    Ok(LegacyLcdConfigResult {
        success: true,
        path: Some(path.to_string()),
        timing: Some(LegacyTimingConfig {
            hact: request.hact,
            vact: request.vact,
            pclk: request.pclk,
            hfp: request.hfp,
            hbp: request.hbp,
            hsync: request.hsync,
            vfp: request.vfp,
            vbp: request.vbp,
            vsync: request.vsync,
            hs_polarity: request.hs_polarity,
            vs_polarity: request.vs_polarity,
            de_polarity: request.de_polarity,
            clk_polarity: request.clk_polarity,
            interface_type: request.interface_type,
            mipi_mode: request.mipi_mode,
            video_type: request.video_type,
            lanes: request.lanes,
            format: request.format,
            phy_mode: request.phy_mode,
            dsc_enable: request.dsc_enable,
            dsc_version: request.dsc_version,
            slice_width: request.slice_width,
            slice_height: request.slice_height,
            scrambling_enable: request.scrambling_enable,
            data_swap: request.data_swap,
            dual_channel: false,
        }),
        init_codes: request.init_codes,
        error: None,
    })
}

#[tauri::command]
fn pick_lcd_config_file() -> Option<String> {
    rfd::FileDialog::new()
        .add_filter("LCD config", &["bin", "json"])
        .pick_file()
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn parse_legacy_lcd_bin(path: String) -> LegacyLcdConfigResult {
    let extension = Path::new(&path)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .unwrap_or_default();

    let parsed = if extension == "json" {
        parse_oled_config_json_file(&path)
    } else {
        parse_legacy_lcd_bin_file(&path)
    };

    match parsed {
        Ok(result) => result,
        Err(err) => LegacyLcdConfigResult {
            success: false,
            path: Some(path),
            timing: None,
            init_codes: Vec::new(),
            error: Some(err),
        },
    }
}

#[tauri::command]
fn generate_timing_bin(request: TimingBinRequest) -> GenericResult {
    let exe = match std::env::current_exe() {
        Ok(path) => path,
        Err(err) => {
            return GenericResult { success: false, output: String::new(), error: Some(format!("无法定位程序目录: {}", err)) };
        }
    };
    let dir = match exe.parent() {
        Some(dir) => dir,
        None => {
            return GenericResult { success: false, output: String::new(), error: Some("无法定位程序目录".to_string()) };
        }
    };
    let output_path = dir.join("vis-timing.bin");

    let mut init_seq: Vec<u8> = Vec::new();
    for line in request.init_codes.iter().filter(|line| !line.trim().is_empty()) {
        match parse_hex_csv_line(line) {
            Ok(bytes) => {
                if bytes.len() < 3 {
                    return GenericResult { success: false, output: String::new(), error: Some(format!("初始化代码长度不足(至少3字节): {}", line)) };
                }
                init_seq.extend_from_slice(&bytes);
            }
            Err(err) => {
                return GenericResult { success: false, output: String::new(), error: Some(err) };
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
    panel_name[..16].copy_from_slice(b"DSI-Panel0123456");
    out.extend_from_slice(&panel_name);
    let mut version = [0u8; 8];
    version.copy_from_slice(b"1.234567");
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

    match std::fs::write(&output_path, out) {
        Ok(_) => GenericResult { success: true, output: output_path.to_string_lossy().to_string(), error: None },
        Err(err) => GenericResult { success: false, output: String::new(), error: Some(format!("写入 timing bin 失败: {}", err)) },
    }
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

#[derive(Debug, Deserialize)]
struct ExportOledConfigJsonRequest {
    request: TimingBinRequest,
}

#[tauri::command]
fn export_oled_config_json(payload: ExportOledConfigJsonRequest) -> GenericResult {
    let path = match rfd::FileDialog::new()
        .add_filter("OLED config json", &["json"])
        .set_file_name("oled-config.json")
        .save_file()
    {
        Some(path) => path,
        None => {
            return GenericResult {
                success: false,
                output: String::new(),
                error: Some("已取消导出 OLED 配置 JSON".to_string()),
            }
        }
    };

    let mut export_request = payload.request;
    if export_request.pclk < 1_000_000 {
        export_request.pclk = export_request.pclk.saturating_mul(1000);
    }

    let json = match serde_json::to_string_pretty(&export_request) {
        Ok(json) => json,
        Err(err) => {
            return GenericResult {
                success: false,
                output: String::new(),
                error: Some(format!("序列化 OLED 配置 JSON 失败: {}", err)),
            }
        }
    };

    if let Err(err) = std::fs::write(&path, json) {
        return GenericResult {
            success: false,
            output: String::new(),
            error: Some(format!("写入 OLED 配置 JSON 失败: {}", err)),
        };
    }

    GenericResult {
        success: true,
        output: format!("已导出 OLED 配置 JSON: {}；vis-timing.bin 默认保存在程序目录", path.display()),
        error: None,
    }
}

#[tauri::command]
fn download_oled_config_and_reboot(
    payload: DownloadOledConfigRequest,
    state: tauri::State<Mutex<ConnectionState>>,
) -> GenericResult {
    let generated = generate_timing_bin(payload.request);
    if !generated.success {
        return generated;
    }

    let local_path = generated.output.clone();
    match adb_push_internal(&state, &local_path, "/vismm/vis-timing.bin") {
        Ok(result) if result.success => {}
        Ok(result) => {
            return GenericResult {
                success: false,
                output: result.output,
                error: result.error.or(Some("初始化配置下载失败：push 失败".to_string())),
            };
        }
        Err(error) => {
            return GenericResult {
                success: false,
                output: String::new(),
                error: Some(error),
            };
        }
    }

    match adb_shell_internal(&state, "/vismm/tools/repack_initrd.sh && sync") {
        Ok(result) if result.success => {}
        Ok(result) => {
            return GenericResult {
                success: false,
                output: result.output,
                error: result.error.or(Some("repack_initrd 执行失败".to_string())),
            };
        }
        Err(error) => {
            return GenericResult {
                success: false,
                output: String::new(),
                error: Some(error),
            };
        }
    }

    match adb_shell_internal(&state, "reboot") {
        Ok(result) if result.success => GenericResult {
            success: true,
            output: format!("初始化配置下载完成并重启设备：{}", local_path),
            error: None,
        },
        Ok(result) => GenericResult {
            success: false,
            output: result.output,
            error: result.error.or(Some("重启命令执行失败".to_string())),
        },
        Err(error) => GenericResult {
            success: false,
            output: String::new(),
            error: Some(error),
        },
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

#[tauri::command]
fn play_video(request: PlayVideoRequest, state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    let input_path = request.video_path.trim();
    if input_path.is_empty() {
        return GenericResult { success: false, output: String::new(), error: Some("视频路径不能为空".to_string()) };
    }

    let device_id = match resolve_device_id(&state) {
        Ok(id) => id,
        Err(error) => {
            return GenericResult { success: false, output: String::new(), error: Some(error) };
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
            return GenericResult { success: false, output: String::new(), error: Some(error) };
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
            output: format!("已后台启动视频播放: {} (zoom={}, framerate={})", remote_video_path, request.zoom_mode, request.show_framerate),
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
fn get_video_playback_status(state: tauri::State<Mutex<ConnectionState>>) -> VideoPlaybackStatus {
    match adb_shell_internal(&state, r#"if [ -f /dev/shm/is_running ]; then echo running; else echo stopped; fi"#) {
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
fn send_video_control(request: VideoControlRequest, state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    let command = match request.action.as_str() {
        "pause" => r#"echo > /dev/shm/pause_signal"#,
        "resume" => r#"echo > /dev/shm/pause_signal"#,
        "stop" => r#"echo > /dev/shm/stop_signal"#,
        other => {
            return GenericResult { success: false, output: String::new(), error: Some(format!("不支持的视频控制动作: {}", other)) };
        }
    };

    match adb_shell_internal(&state, command) {
        Ok(result) if result.success => GenericResult {
            success: true,
            output: if result.output.trim().is_empty() { format!("视频控制已发送: {}", request.action) } else { result.output },
            error: None,
        },
        Ok(result) => GenericResult { success: false, output: result.output, error: result.error.or(Some("视频控制失败".to_string())) },
        Err(error) => GenericResult { success: false, output: String::new(), error: Some(error) },
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
