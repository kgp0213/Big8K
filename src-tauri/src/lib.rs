use serde::{Deserialize, Serialize};
use ssh2::Session;
use std::net::{TcpStream, ToSocketAddrs};
use std::path::Path;
use std::process::Command;
use std::sync::Mutex;
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
    pub fb0_available: bool,
    pub vismpwr_available: bool,
    pub python3_available: bool,
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

#[tauri::command]
fn adb_probe_device(state: tauri::State<Mutex<ConnectionState>>) -> DeviceProbeResult {
    let command = "MODEL=$(getprop ro.product.model 2>/dev/null); VSIZE=$(cat /sys/class/graphics/fb0/virtual_size 2>/dev/null); BPP=$(cat /sys/class/graphics/fb0/bits_per_pixel 2>/dev/null); [ -e /dev/fb0 ] && echo FB0=1 || echo FB0=0; command -v vismpwr >/dev/null 2>&1 && echo VISMPWR=1 || echo VISMPWR=0; command -v python3 >/dev/null 2>&1 && echo PYTHON3=1 || echo PYTHON3=0; echo MODEL=$MODEL; echo VSIZE=$VSIZE; echo BPP=$BPP";

    match adb_shell_internal(&state, command) {
        Ok(result) if result.success => {
            let mut model = None;
            let mut virtual_size = None;
            let mut bits_per_pixel = None;
            let mut fb0_available = false;
            let mut vismpwr_available = false;
            let mut python3_available = false;

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
                } else if line.trim() == "FB0=1" {
                    fb0_available = true;
                } else if line.trim() == "VISMPWR=1" {
                    vismpwr_available = true;
                } else if line.trim() == "PYTHON3=1" {
                    python3_available = true;
                }
            }

            DeviceProbeResult {
                success: true,
                model,
                virtual_size,
                bits_per_pixel,
                fb0_available,
                vismpwr_available,
                python3_available,
                error: None,
            }
        }
        Ok(result) => DeviceProbeResult {
            success: false,
            model: None,
            virtual_size: None,
            bits_per_pixel: None,
            fb0_available: false,
            vismpwr_available: false,
            python3_available: false,
            error: result.error.or(Some("ADB 设备探测失败".to_string())),
        },
        Err(error) => DeviceProbeResult {
            success: false,
            model: None,
            virtual_size: None,
            bits_per_pixel: None,
            fb0_available: false,
            vismpwr_available: false,
            python3_available: false,
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
fn run_demo_screen(state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
    run_remote_python_script(
        &state,
        &project_file("fb_demo.py"),
        "/data/local/tmp/fb_demo.py",
        &[],
    )
}

#[tauri::command]
fn run_text_demo(state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
    run_remote_python_script(
        &state,
        &project_file("fb_text_demo.py"),
        "/data/local/tmp/fb_text_demo.py",
        &[],
    )
}

#[tauri::command]
fn run_poster_demo(state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
    run_remote_python_script(
        &state,
        &project_file("fb_text_poster.py"),
        "/data/local/tmp/fb_text_poster.py",
        &[],
    )
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
        &project_file("fb_text_custom.py"),
        "/data/local/tmp/fb_text_custom.py",
        &[
            &shell_quote(text),
            &shell_quote(&subtitle),
            &shell_quote(&style),
        ],
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

    let remote_image = "/data/local/tmp/input_image.png";
    match adb_push_internal(&state, &request.image_path, remote_image) {
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

    run_remote_python_script(
        &state,
        &project_file("fb_image_display.py"),
        "/data/local/tmp/fb_image_display.py",
        &[remote_image],
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
            ssh_connect,
            ssh_exec,
            display_solid_color,
            display_gradient,
            display_color_bar,
            display_checkerboard,
            run_demo_screen,
            run_text_demo,
            run_poster_demo,
            display_text,
            display_image,
            mipi_send_command,
            mipi_send_commands,
            mipi_software_reset,
            mipi_read_power_mode,
            mipi_sleep_in,
            mipi_sleep_out,
            clear_screen
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
