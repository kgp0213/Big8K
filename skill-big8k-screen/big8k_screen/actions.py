"""
Big8K Screen Skill Actions
Repo-aligned standalone OpenClaw actions for the P0 scope.
"""

from __future__ import annotations

import base64
import json
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .adb_device import ADBDevice
from .screen_control import RUNTIME_PATTERNS, ScreenController


_device: Optional[ADBDevice] = None
_screen: Optional[ScreenController] = None


def _get_device(device_id: Optional[str] = None) -> ADBDevice:
    global _device, _screen
    if _device is None or (device_id and _device.device_id != device_id):
        _device = ADBDevice(device_id)
        _screen = ScreenController(_device)
    return _device


def _get_screen(device_id: Optional[str] = None) -> ScreenController:
    global _screen
    device = _get_device(device_id)
    if _screen is None:
        _screen = ScreenController(device)
    return _screen


def _current_device_id() -> Optional[str]:
    if _device is None:
        return None
    resolved = _device.resolve_device_id()
    if resolved.get("success"):
        return resolved.get("device_id")
    return _device.device_id


def _ok(
    action: str,
    summary: str,
    *,
    data: Optional[Dict[str, Any]] = None,
    artifacts: Optional[List[str]] = None,
    warnings: Optional[List[str]] = None,
    next_suggestion: Optional[str] = None,
) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "success": True,
        "action": action,
        "device_id": _current_device_id(),
        "data": data or {},
        "artifacts": artifacts or [],
        "warnings": warnings or [],
        "summary": summary,
    }
    if next_suggestion:
        result["next_suggestion"] = next_suggestion
    return result


def _fail(
    action: str,
    stage: str,
    code: str,
    message: str,
    summary: str,
    *,
    warnings: Optional[List[str]] = None,
    next_suggestion: Optional[str] = None,
) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "success": False,
        "action": action,
        "device_id": _current_device_id(),
        "error": {
            "stage": stage,
            "code": code,
            "message": message,
        },
        "warnings": warnings or [],
        "summary": summary,
    }
    if next_suggestion:
        result["next_suggestion"] = next_suggestion
    return result


def _extract_error(stage: str, code: str, fallback_message: str, result: Dict[str, Any]) -> Dict[str, str]:
    return {
        "stage": stage,
        "code": code,
        "message": result.get("error") or result.get("stderr") or result.get("stdout") or fallback_message,
    }


def _build_timing_request(params: Dict[str, Any]) -> Dict[str, Any]:
    required_fields = [
        "pclk",
        "hact",
        "hfp",
        "hbp",
        "hsync",
        "vact",
        "vfp",
        "vbp",
        "vsync",
        "hs_polarity",
        "vs_polarity",
        "de_polarity",
        "clk_polarity",
        "interface_type",
        "mipi_mode",
        "video_type",
        "lanes",
        "format",
        "phy_mode",
        "dsc_enable",
        "dsc_version",
        "slice_width",
        "slice_height",
        "scrambling_enable",
        "data_swap",
        "init_codes",
    ]
    missing = [field for field in required_fields if field not in params]
    if missing:
        raise ValueError(f"Missing timing fields: {', '.join(missing)}")

    request = dict(params)
    request["pclk"] = int(request["pclk"])
    for field in [
        "hact",
        "hfp",
        "hbp",
        "hsync",
        "vact",
        "vfp",
        "vbp",
        "vsync",
        "slice_width",
        "slice_height",
    ]:
        request[field] = int(request[field])
    request["lanes"] = int(request["lanes"])
    for field in [
        "hs_polarity",
        "vs_polarity",
        "de_polarity",
        "clk_polarity",
        "dsc_enable",
        "scrambling_enable",
        "data_swap",
    ]:
        request[field] = bool(request[field])
    if not isinstance(request["init_codes"], list):
        raise ValueError("init_codes must be a list of strings")
    request["init_codes"] = [str(line) for line in request["init_codes"]]
    return request


def _align(size: int, alignment: int) -> int:
    return (size + alignment - 1) & ~(alignment - 1)


def _write_entry(buffer: bytearray, offset: int, length: int) -> None:
    buffer.extend(int(offset).to_bytes(4, "little"))
    buffer.extend(int(length).to_bytes(4, "little"))


def _parse_hex_csv_line(line: str) -> List[int]:
    parts = [part.strip() for part in line.replace(",", " ").split() if part.strip()]
    try:
        return [int(part, 16) for part in parts]
    except ValueError as exc:
        raise ValueError(f"初始化代码字节解析失败: {line}") from exc


def _timing_bin_output_path() -> Path:
    return Path.cwd() / "vis-timing.bin"


def _normalize_fixed_bytes(value: Optional[str], length: int, *, digits_only: bool = False, default: str = "") -> bytes:
    text = (value or default).strip()
    if digits_only:
        text = "".join(ch for ch in text if ch.isdigit())
    if not text:
        text = default
    if len(text) > length:
        text = text[:length]
    if len(text) < length:
        text = text + ("x" * (length - len(text)))
    return text.encode("ascii", errors="ignore")[:length].ljust(length, b"x")


def _generate_timing_bin_file(request: Dict[str, Any]) -> Path:
    init_seq = bytearray()
    for line in request["init_codes"]:
        if not line.strip():
            continue
        bytes_line = _parse_hex_csv_line(line)
        if len(bytes_line) < 3:
            raise ValueError(f"初始化代码长度不足(至少3字节): {line}")
        init_seq.extend(bytes_line)

    header_size = 96
    timing_size = 48
    exit_seq = bytes([0x05, 0x78, 0x01, 0x28, 0x05, 0x00, 0x01, 0x10])
    vesa_dsc_size = 16
    other_info_size = 16

    timing_offset = _align(header_size, 16)
    init_seq_offset = timing_offset + timing_size
    exit_seq_offset = init_seq_offset + len(init_seq)
    vesa_dsc_offset = exit_seq_offset + len(exit_seq)
    other_info_offset = vesa_dsc_offset + vesa_dsc_size
    total_size = other_info_offset + other_info_size

    out = bytearray()
    out.extend((0xA5A55A5A).to_bytes(4, "little"))
    out.extend(_normalize_fixed_bytes("Visonox890123456", 16, default="Visonox890123456"))
    out.extend(_normalize_fixed_bytes(request.get("panel_name"), 16, default="DSI-Panel0123456"))
    out.extend(_normalize_fixed_bytes(request.get("version"), 8, digits_only=True, default=datetime.now().strftime("%y%m%d%H")))

    _write_entry(out, timing_offset, timing_size)
    _write_entry(out, init_seq_offset, len(init_seq))
    _write_entry(out, exit_seq_offset, len(exit_seq))
    _write_entry(out, 0, 0)
    _write_entry(out, vesa_dsc_offset, vesa_dsc_size)
    _write_entry(out, other_info_offset, other_info_size)
    out.extend(total_size.to_bytes(4, "little"))

    while len(out) < timing_offset:
        out.append(0)

    pclk_hz = request["pclk"] if request["pclk"] >= 1_000_000 else request["pclk"] * 1000
    out.extend(int(pclk_hz).to_bytes(8, "little"))
    for field in ["hact", "hfp", "hbp", "hsync", "vact", "vfp", "vbp", "vsync"]:
        out.extend(int(request[field]).to_bytes(4, "little"))

    display_flags = 0
    display_flags |= 1 << 1 if request["hs_polarity"] else 1 << 0
    display_flags |= 1 << 3 if request["vs_polarity"] else 1 << 2
    display_flags |= 1 << 5 if request["de_polarity"] else 1 << 4
    display_flags |= 1 << 7 if request["clk_polarity"] else 1 << 6
    out.extend(display_flags.to_bytes(4, "little"))
    out.extend(bytes(4))

    out.extend(init_seq)
    out.extend(exit_seq)

    phy_mode = 1 if str(request["phy_mode"]).upper() == "CPHY" else 0
    ver_major, ver_minor = (1, 2) if "1.2" in str(request["dsc_version"]) else (1, 1)
    out.extend(bytes([
        phy_mode,
        1 if request["scrambling_enable"] else 0,
        1 if request["dsc_enable"] else 0,
        ver_major,
        ver_minor,
        0,
        0,
        0,
    ]))
    out.extend(int(request["slice_width"]).to_bytes(4, "little"))
    out.extend(int(request["slice_height"]).to_bytes(4, "little"))

    mipi_mode_video_type = 0
    if str(request["mipi_mode"]).lower() == "video":
        mipi_mode_video_type |= 1 << 0
        if str(request["video_type"]).upper() == "NON_BURST_SYNC_PULSES":
            mipi_mode_video_type |= 1 << 2
        elif str(request["video_type"]).upper() == "BURST_MODE":
            mipi_mode_video_type |= 1 << 1
    mipi_mode_video_type |= 1 << 11
    mipi_mode_video_type |= 1 << 9
    out.extend(bytes([
        mipi_mode_video_type & 0xFF,
        (mipi_mode_video_type >> 8) & 0xFF,
        1 if request["data_swap"] else 0,
        {"EDP": 1, "DP": 2}.get(str(request["interface_type"]), 0),
        {"RGB888": 0, "RGB666": 1, "RGB666_PACKED": 2, "RGB565": 3}.get(str(request["format"]), 0),
        int(request["lanes"]),
        phy_mode,
        0x56,
        0x69,
        0x73,
        0,
        0,
        0,
        0,
        0,
        0,
    ]))

    output_path = _timing_bin_output_path()
    output_path.write_bytes(out)
    return output_path


def list_devices() -> Dict[str, Any]:
    device = _get_device()
    result = device.list_devices()
    if not result.get("success"):
        error = _extract_error("device_resolution", "ADB_DEVICES_FAILED", "Failed to list devices", result)
        return _fail(
            "big8k.list_devices",
            error["stage"],
            error["code"],
            error["message"],
            "device listing failed",
        )
    return _ok(
        "big8k.list_devices",
        f"found {result.get('count', 0)} device(s)",
        data={
            "devices": result.get("devices", []),
            "count": result.get("count", 0),
        },
    )


def select_device(device_id: str) -> Dict[str, Any]:
    device = _get_device(device_id)
    result = device.select_device(device_id)
    if not result.get("success"):
        error = _extract_error("device_resolution", "DEVICE_SELECT_FAILED", "Failed to select device", result)
        return _fail(
            "big8k.select_device",
            error["stage"],
            error["code"],
            error["message"],
            "device selection failed",
        )
    return _ok(
        "big8k.select_device",
        f"selected device: {device_id}",
        data={"device_id": device_id},
    )


def device_probe() -> Dict[str, Any]:
    device = _get_device()
    result = device.probe_device()
    if not result.get("success"):
        error = _extract_error("device_resolution", "DEVICE_PROBE_FAILED", "Failed to probe device", result)
        return _fail(
            "big8k.device_probe",
            error["stage"],
            error["code"],
            error["message"],
            "device probe failed",
            next_suggestion="确认 ADB 已连接并已选择目标设备。",
        )

    probe = result.get("probe", {})
    next_suggestion = None
    if not probe.get("python3_available"):
        next_suggestion = "先修复设备侧 Python3 环境。"
    elif not probe.get("vismpwr_available"):
        next_suggestion = "先执行 big8k.deploy_install_app 安装设备侧工具。"
    elif not probe.get("fb0_available"):
        next_suggestion = "先检查 framebuffer 驱动和设备启动状态。"

    return _ok(
        "big8k.device_probe",
        "device readiness checked",
        data={
            "device_id": result.get("device_id"),
            "fb0_available": probe.get("fb0_available", False),
            "vismpwr_available": probe.get("vismpwr_available", False),
            "python3_available": probe.get("python3_available", False),
            "virtual_size": probe.get("virtual_size"),
            "bits_per_pixel": probe.get("bits_per_pixel"),
        },
        next_suggestion=next_suggestion,
    )


def generate_timing_bin(**params: Any) -> Dict[str, Any]:
    try:
        request = _build_timing_request(params)
        output_path = _generate_timing_bin_file(request)
    except ValueError as exc:
        return _fail(
            "big8k.generate_timing_bin",
            "input_validation",
            "TIMING_REQUEST_INVALID",
            str(exc),
            "timing bin generation failed",
        )
    except OSError as exc:
        return _fail(
            "big8k.generate_timing_bin",
            "resource_prepare",
            "TIMING_BIN_WRITE_FAILED",
            f"写入 timing bin 失败: {exc}",
            "timing bin generation failed",
        )

    return _ok(
        "big8k.generate_timing_bin",
        f"timing bin generated: {output_path}",
        data={"path": str(output_path)},
        artifacts=[str(output_path)],
    )


def export_oled_config_json(output_path: str = "oled-config.json", **params: Any) -> Dict[str, Any]:
    try:
        request = _build_timing_request(params)
    except ValueError as exc:
        return _fail(
            "big8k.export_oled_config_json",
            "input_validation",
            "TIMING_REQUEST_INVALID",
            str(exc),
            "OLED config JSON export failed",
        )

    target_path = Path(output_path)
    export_request = dict(request)
    if export_request["pclk"] < 1_000_000:
        export_request["pclk"] *= 1000

    try:
        target_path.write_text(json.dumps(export_request, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError as exc:
        return _fail(
            "big8k.export_oled_config_json",
            "resource_prepare",
            "OLED_CONFIG_JSON_WRITE_FAILED",
            f"写入 OLED 配置 JSON 失败: {exc}",
            "OLED config JSON export failed",
        )

    return _ok(
        "big8k.export_oled_config_json",
        f"OLED config JSON exported: {target_path}",
        data={"path": str(target_path)},
        artifacts=[str(target_path)],
    )


def download_oled_config_and_reboot(**params: Any) -> Dict[str, Any]:
    try:
        request = _build_timing_request(params)
        output_path = _generate_timing_bin_file(request)
    except ValueError as exc:
        return _fail(
            "big8k.download_oled_config_and_reboot",
            "input_validation",
            "TIMING_REQUEST_INVALID",
            str(exc),
            "OLED config download failed",
        )
    except OSError as exc:
        return _fail(
            "big8k.download_oled_config_and_reboot",
            "resource_prepare",
            "TIMING_BIN_WRITE_FAILED",
            f"写入 timing bin 失败: {exc}",
            "OLED config download failed",
        )

    device = _get_device()
    push_result = device.push(str(output_path), "/vismm/vis-timing.bin")
    if not push_result.get("success"):
        error = _extract_error("adb_push", "ADB_PUSH_FAILED", "Failed to push timing bin", push_result)
        return _fail(
            "big8k.download_oled_config_and_reboot",
            error["stage"],
            error["code"],
            error["message"],
            "OLED config download failed",
        )

    shell_result = device.shell("/vismm/tools/repack_initrd.sh && sync", timeout=300)
    if shell_result.get("returncode") != 0:
        error = _extract_error("adb_shell", "REPACK_INITRD_FAILED", "Failed to repack initrd", shell_result)
        return _fail(
            "big8k.download_oled_config_and_reboot",
            error["stage"],
            error["code"],
            error["message"],
            "OLED config repack failed",
        )

    reboot_result = device.shell("reboot", timeout=30)
    if reboot_result.get("returncode") != 0:
        error = _extract_error("adb_shell", "DEVICE_REBOOT_FAILED", "Failed to reboot device", reboot_result)
        return _fail(
            "big8k.download_oled_config_and_reboot",
            error["stage"],
            error["code"],
            error["message"],
            "device reboot failed",
        )

    return _ok(
        "big8k.download_oled_config_and_reboot",
        f"OLED config downloaded and reboot triggered: {output_path}",
        data={"path": str(output_path)},
        artifacts=[str(output_path)],
    )


def sync_runtime_patterns() -> Dict[str, Any]:
    result = _get_screen().sync_runtime_patterns()
    if not result.get("success"):
        error = _extract_error("resource_prepare", "RUNTIME_PATTERN_SYNC_FAILED", "Failed to sync runtime patterns", result)
        return _fail(
            "big8k.sync_runtime_patterns",
            error["stage"],
            error["code"],
            error["message"],
            "runtime pattern sync failed",
        )
    return _ok(
        "big8k.sync_runtime_patterns",
        "runtime patterns synchronized",
        data={"script_path": result.get("script_path")},
        artifacts=[result["script_path"]] if result.get("script_path") else [],
    )


def display_runtime_pattern(pattern: str) -> Dict[str, Any]:
    result = _get_screen().display_runtime_pattern(pattern)
    if not result.get("success"):
        error = _extract_error("runtime_script", "RUNTIME_PATTERN_FAILED", "Failed to display runtime pattern", result)
        return _fail(
            "big8k.display_runtime_pattern",
            error["stage"],
            error["code"],
            error["message"],
            "runtime pattern display failed",
            next_suggestion="先执行 big8k.sync_runtime_patterns，再确认 pattern 名称是否合法。",
        )
    return _ok(
        "big8k.display_runtime_pattern",
        f"runtime pattern displayed: {pattern}",
        data={
            "pattern": pattern,
            "available_patterns": RUNTIME_PATTERNS,
        },
    )


def display_logic_pattern(pattern_id: int) -> Dict[str, Any]:
    result = _get_screen().display_logic_pattern(int(pattern_id))
    if not result.get("success"):
        error = _extract_error("runtime_script", "LOGIC_PATTERN_FAILED", "Failed to display logic pattern", result)
        return _fail(
            "big8k.display_logic_pattern",
            error["stage"],
            error["code"],
            error["message"],
            "logic pattern display failed",
        )
    return _ok(
        "big8k.display_logic_pattern",
        f"logic pattern displayed: {pattern_id}",
        data={"pattern_id": int(pattern_id)},
    )


def display_local_image(image_path: str, remote_name: Optional[str] = None) -> Dict[str, Any]:
    result = _get_screen().display_local_image(image_path, remote_name=remote_name)
    if not result.get("success"):
        error = _extract_error("adb_push", "LOCAL_IMAGE_DISPLAY_FAILED", "Failed to display local image", result)
        return _fail(
            "big8k.display_local_image",
            error["stage"],
            error["code"],
            error["message"],
            "local image display failed",
        )
    return _ok(
        "big8k.display_local_image",
        f"local image uploaded and displayed: {result['remote_name']}",
        data={
            "image_path": image_path,
            "remote_path": result["remote_path"],
            "remote_name": result["remote_name"],
        },
        artifacts=[image_path],
    )


def display_remote_image(remote_path: str) -> Dict[str, Any]:
    result = _get_screen().display_remote_image(remote_path)
    if not result.get("success"):
        error = _extract_error("adb_shell", "REMOTE_IMAGE_DISPLAY_FAILED", "Failed to display remote image", result)
        return _fail(
            "big8k.display_remote_image",
            error["stage"],
            error["code"],
            error["message"],
            "remote image display failed",
        )
    return _ok(
        "big8k.display_remote_image",
        f"remote image displayed: {remote_path}",
        data={"remote_path": remote_path},
    )


def display_image_base64(filename: str, base64_data: str, remote_name: Optional[str] = None) -> Dict[str, Any]:
    safe_filename = filename.strip() or "input_image.bin"
    try:
        decoded = base64.b64decode(base64_data.encode("utf-8"), validate=True)
    except Exception as exc:
        return _fail(
            "big8k.display_image_base64",
            "input_validation",
            "BASE64_DECODE_FAILED",
            f"Base64 解码失败: {exc}",
            "base64 image decode failed",
        )

    suffix = Path(safe_filename).suffix or ".bin"
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(decoded)
            temp_path = Path(temp_file.name)
    except OSError as exc:
        return _fail(
            "big8k.display_image_base64",
            "resource_prepare",
            "TEMP_IMAGE_WRITE_FAILED",
            f"写入临时图片失败: {exc}",
            "temporary image write failed",
        )

    try:
        result = display_local_image(str(temp_path), remote_name=remote_name or safe_filename)
    finally:
        temp_path.unlink(missing_ok=True)
    return result


def play_video(video_path: str, zoom_mode: int = 0, show_framerate: int = 0) -> Dict[str, Any]:
    result = _get_screen().play_video(video_path, zoom_mode=int(zoom_mode), show_framerate=int(show_framerate))
    if not result.get("success"):
        error = _extract_error("adb_shell", "VIDEO_START_FAILED", "Failed to start video playback", result)
        return _fail(
            "big8k.play_video",
            error["stage"],
            error["code"],
            error["message"],
            "video playback start failed",
        )
    return _ok(
        "big8k.play_video",
        f"video playback started: {result['remote_video_path']}",
        data={
            "video_path": video_path,
            "remote_video_path": result["remote_video_path"],
            "zoom_mode": int(zoom_mode),
            "show_framerate": int(show_framerate),
        },
    )


def video_control(action: str) -> Dict[str, Any]:
    result = _get_screen().video_control(action)
    if not result.get("success"):
        error = _extract_error("video_control", "VIDEO_CONTROL_FAILED", "Failed to control video playback", result)
        return _fail(
            "big8k.video_control",
            error["stage"],
            error["code"],
            error["message"],
            "video control failed",
        )
    return _ok(
        "big8k.video_control",
        f"video control sent: {action}",
        data={"action": action},
    )


def get_video_playback_status() -> Dict[str, Any]:
    result = _get_screen().get_video_playback_status()
    if not result.get("success"):
        error = _extract_error("result_parse", "VIDEO_STATUS_FAILED", "Failed to query video status", result)
        return _fail(
            "big8k.get_video_playback_status",
            error["stage"],
            error["code"],
            error["message"],
            "video playback status query failed",
        )
    return _ok(
        "big8k.get_video_playback_status",
        "video playback is running" if result.get("is_running") else "video playback is stopped",
        data={
            "is_running": result.get("is_running", False),
            "status": result.get("status", "unknown"),
            "output": result.get("output", ""),
        },
    )


def deploy_install_tools() -> Dict[str, Any]:
    result = _get_screen().deploy_install_tools()
    if not result.get("success"):
        error = _extract_error("resource_prepare", "DEPLOY_INSTALL_TOOLS_FAILED", "Failed to install tools", result)
        return _fail(
            "big8k.deploy_install_tools",
            error["stage"],
            error["code"],
            error["message"],
            "install tools failed",
            warnings=result.get("logs", []),
        )
    return _ok(
        "big8k.deploy_install_tools",
        "install tools completed",
        data={"logs": result.get("logs", [])},
    )


def deploy_install_app() -> Dict[str, Any]:
    result = _get_screen().deploy_install_app()
    if not result.get("success"):
        error = _extract_error("resource_prepare", "DEPLOY_INSTALL_APP_FAILED", "Failed to install app", result)
        return _fail(
            "big8k.deploy_install_app",
            error["stage"],
            error["code"],
            error["message"],
            "install app failed",
            warnings=result.get("logs", []),
        )
    return _ok(
        "big8k.deploy_install_app",
        "install app completed",
        data={"logs": result.get("logs", [])},
    )


__all__ = [
    "list_devices",
    "select_device",
    "device_probe",
    "generate_timing_bin",
    "export_oled_config_json",
    "download_oled_config_and_reboot",
    "sync_runtime_patterns",
    "display_runtime_pattern",
    "display_logic_pattern",
    "display_local_image",
    "display_remote_image",
    "display_image_base64",
    "play_video",
    "video_control",
    "get_video_playback_status",
    "deploy_install_tools",
    "deploy_install_app",
    "execute_action",
    "ACTION_REGISTRY",
]


ACTION_REGISTRY = {
    "big8k.list_devices": list_devices,
    "big8k.select_device": select_device,
    "big8k.device_probe": device_probe,
    "big8k.generate_timing_bin": generate_timing_bin,
    "big8k.export_oled_config_json": export_oled_config_json,
    "big8k.download_oled_config_and_reboot": download_oled_config_and_reboot,
    "big8k.sync_runtime_patterns": sync_runtime_patterns,
    "big8k.display_runtime_pattern": display_runtime_pattern,
    "big8k.display_logic_pattern": display_logic_pattern,
    "big8k.display_local_image": display_local_image,
    "big8k.display_remote_image": display_remote_image,
    "big8k.display_image_base64": display_image_base64,
    "big8k.play_video": play_video,
    "big8k.video_control": video_control,
    "big8k.get_video_playback_status": get_video_playback_status,
    "big8k.deploy_install_tools": deploy_install_tools,
    "big8k.deploy_install_app": deploy_install_app,
}


def execute_action(action_name: str, params: Optional[dict] = None) -> Dict[str, Any]:
    params = params or {}
    action_func = ACTION_REGISTRY.get(action_name)
    if action_func is None:
        return _fail(
            action_name,
            "input_validation",
            "UNKNOWN_ACTION",
            f"Unknown action: {action_name}",
            "action lookup failed",
        )

    try:
        return action_func(**params)
    except TypeError as exc:
        return _fail(
            action_name,
            "input_validation",
            "INVALID_PARAMETERS",
            f"Invalid parameters: {exc}",
            "action parameter validation failed",
        )
    except Exception as exc:
        return _fail(
            action_name,
            "result_parse",
            "UNHANDLED_EXCEPTION",
            f"Execution error: {exc}",
            "action execution failed",
        )
