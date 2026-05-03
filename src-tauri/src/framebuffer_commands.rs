use std::sync::Mutex;

use crate::state::ConnectionState;
use crate::{
    adb_push_internal, adb_shell_internal, project_file, resolve_device_id, run_adb,
    run_remote_python_script, shell_quote, DeviceProbeResult, ImagePreviewResult,
    LocalImagesResult, LogicPatternRequest, PatternResult, PowerRailReading, PowerRailsResult,
    TextDisplayRequest,
};

#[tauri::command]
pub fn adb_probe_device(state: tauri::State<Mutex<ConnectionState>>) -> DeviceProbeResult {
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
pub fn display_solid_color(color: String, state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
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
pub fn display_gradient(gradient_type: String, state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
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
pub fn display_color_bar(state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
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
pub fn display_checkerboard(state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
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
pub fn pick_image_directory() -> Option<String> {
    rfd::FileDialog::new().pick_folder().map(|p| p.to_string_lossy().to_string())
}

#[cfg(not(feature = "image-tools"))]
#[tauri::command]
pub fn pick_image_directory() -> Option<String> {
    None
}

#[cfg(feature = "image-tools")]
#[tauri::command]
pub fn create_image_preview(image_path: String) -> ImagePreviewResult {
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
pub fn create_image_preview(_image_path: String) -> ImagePreviewResult {
    ImagePreviewResult { success: false, data_url: None, width: None, height: None, error: Some("当前构建未启用图片预览功能".to_string()) }
}

#[cfg(feature = "image-tools")]
#[tauri::command]
pub fn list_images_in_directory(dir_path: String) -> LocalImagesResult {
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
pub fn list_images_in_directory(_dir_path: String) -> LocalImagesResult {
    LocalImagesResult { success: false, images: vec![], error: Some("当前构建未启用图片目录浏览功能".to_string()) }
}

#[tauri::command]
pub fn read_power_rails(state: tauri::State<Mutex<ConnectionState>>) -> PowerRailsResult {
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
pub fn run_demo_screen(state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
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
pub fn run_logic_pattern(request: LogicPatternRequest, state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
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
pub fn display_text(request: TextDisplayRequest, state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
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
pub fn clear_screen(state: tauri::State<Mutex<ConnectionState>>) -> PatternResult {
    display_solid_color("black".to_string(), state)
}
