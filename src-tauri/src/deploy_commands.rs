use base64::Engine;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use crate::state::ConnectionState;
use crate::{
    adb_push_internal, adb_shell_internal, resolve_device_id, run_adb, run_adb_nowait,
    shell_quote, AdbActionResult, DeleteRemoteFileRequest, GenericResult, ListRemoteFilesRequest,
    ListRemoteFilesResult, RunRemoteScriptRequest, SetScriptAutorunRequest, SetupLoopImagesRequest,
    UploadFileBase64Request,
};

// 命令清单存储路径：优先使用新文件名 command_presets.json，兼容旧文件 cmdx_list.json。
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
pub fn deploy_install_tools(state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
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
pub fn deploy_install_app(state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
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
pub fn deploy_set_default_pattern(state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    deploy_named_autorun_bundle(
        &state,
        "resources/deploy/fb-RunApp/default",
        "fb_RunApp/default",
        "开机刷白脚本推送完成并运行",
    )
}

#[tauri::command]
pub fn deploy_set_default_movie(state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    deploy_named_autorun_bundle(
        &state,
        "resources/deploy/fb-RunApp/default_movie",
        "fb_RunApp/default_movie",
        "开机自动播放视频脚本推送完成并运行",
    )
}

#[tauri::command]
pub fn deploy_set_multi_user(state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
    set_default_target_and_reboot(&state, "multi-user.target")
}

#[tauri::command]
pub fn deploy_set_graphical(state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
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
pub fn list_remote_files(request: ListRemoteFilesRequest, state: tauri::State<Mutex<ConnectionState>>) -> ListRemoteFilesResult {
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
pub fn upload_file_base64(request: UploadFileBase64Request, state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
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
pub fn run_remote_script(request: RunRemoteScriptRequest, state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
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
pub fn set_script_autorun(request: SetScriptAutorunRequest, state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
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
pub fn delete_remote_file(request: DeleteRemoteFileRequest, state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
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
pub fn stop_remote_script(state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
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
pub fn setup_loop_images(_request: SetupLoopImagesRequest, state: tauri::State<Mutex<ConnectionState>>) -> GenericResult {
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
