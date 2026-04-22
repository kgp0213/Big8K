# Big8K Screen Skill

面向 OpenClaw P0 的 Big8K 屏幕控制 Skill。

## 范围

本包聚焦当前仓库已具备后端接线的第一波能力：
- ADB 设备发现 / 选择 / 探测
- OLED 配置导出、生成 `vis-timing.bin`、下载并重启
- runtime pattern / logic pattern 显示
- 本地图片、远端图片、base64 图片显示
- 视频播放、状态查询、控制
- 部署工具与应用资源

不再把 CA410 亮度计流程作为当前独立交付面的主能力。

## 公开动作

- `big8k.list_devices`
- `big8k.select_device`
- `big8k.device_probe`
- `big8k.generate_timing_bin`
- `big8k.export_oled_config_json`
- `big8k.download_oled_config_and_reboot`
- `big8k.sync_runtime_patterns`
- `big8k.display_runtime_pattern`
- `big8k.display_logic_pattern`
- `big8k.display_local_image`
- `big8k.display_remote_image`
- `big8k.display_image_base64`
- `big8k.play_video`
- `big8k.video_control`
- `big8k.get_video_playback_status`
- `big8k.deploy_install_tools`
- `big8k.deploy_install_app`

## 安装

```bash
pip install -r requirements.txt
```

依赖：
- Python 3.8+
- ADB 在系统 PATH 中可用

## Python API 示例

```python
from big8k_screen import list_devices, select_device, device_probe

print(list_devices())
print(select_device("DEVICE_SERIAL"))
print(device_probe())
```

```python
from big8k_screen import sync_runtime_patterns, display_runtime_pattern

print(sync_runtime_patterns())
print(display_runtime_pattern("white"))
```

```python
from big8k_screen import display_local_image, display_remote_image, display_image_base64

print(display_local_image(r"C:\tmp\pattern.png"))
print(display_remote_image("/data/local/tmp/pattern.bmp"))
print(display_image_base64("pattern.png", "iVBORw0KGgoAAAANSUhEUg..."))
```

```python
from big8k_screen import play_video, video_control, get_video_playback_status

print(play_video(r"C:\tmp\demo.mp4", zoom_mode=0, show_framerate=0))
print(get_video_playback_status())
print(video_control("pause"))
print(video_control("resume"))
print(video_control("stop"))
```

```python
from big8k_screen import (
    generate_timing_bin,
    export_oled_config_json,
    download_oled_config_and_reboot,
)

request = {
    "pclk": 74250,
    "hact": 1920,
    "hfp": 88,
    "hbp": 148,
    "hsync": 44,
    "vact": 1080,
    "vfp": 4,
    "vbp": 36,
    "vsync": 5,
    "hs_polarity": True,
    "vs_polarity": True,
    "de_polarity": True,
    "clk_polarity": False,
    "interface_type": "MIPI",
    "mipi_mode": "Video",
    "video_type": "BURST_MODE",
    "lanes": 4,
    "format": "RGB888",
    "phy_mode": "DPHY",
    "dsc_enable": False,
    "dsc_version": "Vesa1.2",
    "slice_width": 0,
    "slice_height": 0,
    "scrambling_enable": False,
    "data_swap": False,
    "init_codes": [],
}

print(generate_timing_bin(request))
print(export_oled_config_json(request))
print(download_oled_config_and_reboot(request))
```

## 结果结构

所有动作返回统一结构，成功时通常包含：

```json
{
  "success": true,
  "action": "big8k.display_runtime_pattern",
  "device_id": "optional",
  "data": {},
  "artifacts": [],
  "warnings": [],
  "summary": "runtime pattern displayed",
  "next_suggestion": "optional"
}
```

失败时包含：

```json
{
  "success": false,
  "action": "big8k.display_runtime_pattern",
  "device_id": "optional",
  "error": {
    "stage": "runtime_script",
    "code": "shell_failed",
    "message": "具体错误信息"
  },
  "warnings": [],
  "summary": "failed to display runtime pattern"
}
```

## 参数约定

### `video_control`
仅支持：
- `pause`
- `resume`
- `stop`

### `display_runtime_pattern`
常用 pattern：
- `gray8`
- `gray64`
- `gray128`
- `gray192`
- `gray255`
- `red`
- `green`
- `blue`
- `white`
- `black`
- `checkerboard`
- `gradient`

## 工作流

见 `workflows.yaml`，其中保留的是 P0 可直接落地的 OpenClaw 工作流，而不是旧的 CA410 测量工作流。
