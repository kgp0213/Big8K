"""
Big8K Screen Skill
Standalone OpenClaw skill package for the repo-aligned P0 scope.
"""

from .actions import (
    ACTION_REGISTRY,
    device_probe,
    deploy_install_app,
    deploy_install_tools,
    display_image_base64,
    display_local_image,
    display_logic_pattern,
    display_remote_image,
    display_runtime_pattern,
    download_oled_config_and_reboot,
    execute_action,
    export_oled_config_json,
    generate_timing_bin,
    get_video_playback_status,
    list_devices,
    play_video,
    select_device,
    sync_runtime_patterns,
    video_control,
)

__version__ = "1.0.0"

__all__ = [
    "ACTION_REGISTRY",
    "device_probe",
    "deploy_install_app",
    "deploy_install_tools",
    "display_image_base64",
    "display_local_image",
    "display_logic_pattern",
    "display_remote_image",
    "display_runtime_pattern",
    "download_oled_config_and_reboot",
    "execute_action",
    "export_oled_config_json",
    "generate_timing_bin",
    "get_video_playback_status",
    "list_devices",
    "play_video",
    "select_device",
    "sync_runtime_patterns",
    "video_control",
]
