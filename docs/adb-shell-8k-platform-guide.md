# 8K 平台 ADB / Framebuffer / OLED 速查

更新时间：2026-05-04

本文重写自早期 ADB Shell 技术手册，保留当前 Big8K-Tauri-UI 最常用的命令、路径和风险提醒。完整实现以源码和 `resources/deploy/` 为准。

## 1. ADB 基础

常用命令：

```bash
adb devices -l
adb connect <ip>:5555
adb disconnect
adb -s <device_id> shell <cmd>
adb -s <device_id> push <local> <remote>
adb -s <device_id> pull <remote> <local>
adb reboot
```

多设备时必须指定 `device_id`。Tauri 后端当前通过 ADB 模块封装这些能力，并在连接状态中记录当前设备。

## 2. MIPI / vismpwr

板端 MIPI 工具：

```text
vismpwr
```

写命令格式：

```text
DT DELAY LEN DATA...
```

常见 DT：

| DT | 含义 |
|---|---|
| `05` | DCS Short Write |
| `29` | DCS Long Write |
| `39` | Generic Long Write |
| `0A` | DCS Read 相关数据行 |

常用命令：

```bash
vismpwr 05 00 01 01
vismpwr 05 00 01 28
vismpwr 05 00 01 10
vismpwr 05 00 01 11
vismpwr 05 00 01 29
vismpwr -r 01 0A
vismpwr 39 00 03 F0 5A 5A
```

代码转换和校验规则见：

- `code-format-concepts.md`
- `mipi-debug-notes.md`

## 3. Framebuffer 探测

写屏前先确认设备参数：

```bash
cat /sys/class/graphics/fb0/virtual_size
cat /sys/class/graphics/fb0/physical_size
cat /sys/class/graphics/fb0/bits_per_pixel
cat /sys/class/graphics/fb0/resolution
cat /sys/class/graphics/fb0/modes
```

当前常见现场值：

| 项 | 值 |
|---|---|
| Framebuffer | `/dev/fb0` |
| 虚拟分辨率 | `3036,1952` |
| 物理尺寸 | `600,376` mm |
| 位深 | `32` |
| 像素格式 | BGRA8888 |

实际代码不要硬编码分辨率，优先读取 `virtual_size`。

## 4. 显示图案和图片

运行时图案脚本：

```bash
python3 /vismm/fbshow/big8k_runtime/render_patterns.py pure_red
```

逻辑图案脚本：

```bash
python3 /vismm/fbshow/logicPictureShow.py 16
```

BMP 上屏：

```bash
/vismm/fbshow/fbShowBmp /vismm/fbshow/bmp_online/test.bmp
```

常用远端目录：

| 用途 | 路径 |
|---|---|
| BMP | `/vismm/fbshow/bmp_online/` |
| 视频 | `/vismm/fbshow/movie_online/` |
| 截图 | `/vismm/fbshow/save/` |
| 运行时图案 | `/vismm/fbshow/big8k_runtime/` |

## 5. 视频播放

脚本：

```text
/vismm/fbshow/videoPlay.py
```

播放：

```bash
python3 /vismm/fbshow/videoPlay.py /vismm/fbshow/movie_online/video.mp4 2 0
```

控制信号：

| 文件 | 含义 |
|---|---|
| `/dev/shm/pause_signal` | 暂停 / 恢复 |
| `/dev/shm/stop_signal` | 停止 |
| `/dev/shm/is_running` | 运行状态 |

当前源码审查已记录：宽泛停止 Python 进程有风险，后续应改为更精确的进程管理。

## 6. USB、输入和交互

常见节点：

| 节点 | 用途 |
|---|---|
| `/proc/chenfeng_adckey/chenfeng_adckey` | 物理按键 |
| `/dev/input/by-path/*-event-mouse` | USB 鼠标事件 |
| `/mnt/usbsd` | 单 USB 挂载点 |
| `/mnt/usbsd1` / `/mnt/usbsd2` | 多 USB 挂载点 |

按键值：

| 值 | 含义 |
|---|---|
| `03` | V+ / 向前 |
| `04` | V- / 向后 |
| `02` | 退出 |

## 7. OLED 配置下载

核心产物：

```text
vis-timing.bin
```

典型流程：

```text
生成 vis-timing.bin
adb push 到 /vismm/vis-timing.bin
执行 repack_initrd.sh
sync
reboot
```

高风险提醒：该流程会修改板端启动配置并重启。必须确保 timing、init code、PCLK 单位和 DSC 相关配置正确。

PCLK 约定：

| 位置 | 单位 |
|---|---|
| UI | kHz |
| `vis-timing.bin` / JSON | Hz |

## 8. 电源和 I2C

常见地址：

| 电源轨 | INA226 地址 | 备注 |
|---|---:|---|
| VCI | `0x41` | `rsense=0.2` |
| VDDIO | `0x45` | `rsense=0.2` |
| DVDD | `0x48` | `rsense=0.2` |
| ELVDD | `0x40` | `rsense=0.025` |
| ELVSS | `0x46` | 负压显示 |
| AVDD | `0x44` | `rsense=0.2` |
| VGL | `0x4A` | 负压显示 |
| VGLI | `0x4F` | 公式推算 |

默认 I2C bus：

```text
/dev/i2c-4
```

AD5272 / INA226 细节见 `ad5272_multi_rail_readme.md`。

## 9. 部署路径

板端目标结构：

```text
/vismm/
  vis-timing.bin
  autorun.py
  tools/
    repack_initrd.sh
  fbshow/
    fbShowBmp
    fbShowPattern
    fbShowMovie
    vismpwr
    autorun.py
    autorunUSB.py
    logicPictureShow.py
    videoPlay.py
    bmp_online/
    movie_online/
    save/
    big8k_runtime/
```

本地资源结构以 `resources/deploy/` 为准。

## 10. Deploy 动作对应

| 动作 | 目标 |
|---|---|
| `deploy_install_tools` | Python 库、cpio、repack、overlay 等基础工具 |
| `deploy_install_app` | fbshow 脚本和二进制 |
| `deploy_set_default_pattern` | 默认 L128 / pattern autorun |
| `deploy_set_default_movie` | default_movie autorun |
| `setup_loop_images` | 循环图片资源部署 |
| `deploy_set_multi_user` | `systemctl set-default multi-user.target` |
| `deploy_set_graphical` | `systemctl set-default graphical.target` 并重启 |

`deploy_enable_ssh` 当前前端存在，后端未注册。

## 11. 高风险命令提示

谨慎使用：

```bash
rm -rf
killall python3
sync && reboot
systemctl set-default ...
dpkg -i ...
chmod 777
```

后续代码应优先把这些能力收进 allowlist、二次确认和可追踪日志。

