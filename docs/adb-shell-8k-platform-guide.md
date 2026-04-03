# 8K 平台 ADB Shell 控制技术手册

> 基于 Big8K-Tauri-UI 工程源码整理
> 整理时间：2026-04-03

---

## 一、ADB 基础通信架构

### 1.1 核心命令执行函数

所有 ADB 命令都通过 `adb_shell_internal()` 函数执行：

```rust
// lib.rs 第 467-497 行
pub(crate) fn adb_shell_internal(state, command) -> Result<AdbActionResult, String>
```

**基本执行模式**：
```bash
# 单设备
adb shell <command>

# 指定设备（多设备时必须）
adb -s <device_id> shell <command>
```

### 1.2 常用 ADB 设备操作命令

| 命令 | 说明 |
|------|------|
| `adb devices -l` | 列出已连接设备 |
| `adb connect <ip>:5555` | 网络连接设备 |
| `adb disconnect` | 断开连接 |
| `adb -s <device_id> shell <cmd>` | 向指定设备执行命令 |
| `adb -s <device_id> push <local> <remote>` | 推送文件到设备 |
| `adb -s <device_id> pull <remote> <local>` | 从设备拉取文件 |
| `adb reboot` | 重启设备 |

---

## 二、MIPI DSI 寄存器读写命令

### 2.1 vismpwr 工具

**核心 MIPI 命令下发工具**：`vismpwr`（位于设备 `/usr/local/bin/vismpwr`）

### 2.2 命令格式规范

vismpwr 支持的命令格式：**`DT DELAY LEN DATA...`**

| DT 值 | 类型 | 说明 |
|-------|------|------|
| `05` | DCS Short Write | 单字节命令，如 05 00 01 28 (Sleep In) |
| `29` | DCS Long Write | 多字节命令，后跟数据 |
| `39` | Generic Long Write | 通用长写，用于发送寄存器值 |
| `0A` | DCS Read | 读取寄存器，返回数据 |

**示例**：
```bash
# 单字节命令（Software Reset）
vismpwr 05 00 01 01

# 读取 Power Mode 寄存器 (0A)
vismpwr -r 01 0A

# 写入寄存器
vismpwr 39 00 03 F0 5A 5A

# 批量命令执行
vismpwr 05 00 01 28 && sleep 0.1 && vismpwr 05 00 01 10
```

### 2.3 OLED 常用寄存器命令

| 操作 | 命令 | 说明 |
|------|------|------|
| Software Reset | `vismpwr 05 00 01 01` | 软件复位 |
| Sleep In | `vismpwr 05 00 01 28 && sleep 0.1 && vismpwr 05 00 01 10` | 进入睡眠 |
| Sleep Out | `vismpwr 05 00 01 11 && sleep 0.12 && vismpwr 05 00 01 29` | 退出睡眠 |
| Read Power Mode | `vismpwr -r 01 0A` | 读取电源状态 |
| Display On | `vismpwr 05 00 01 29` | 显示开启 |
| Display Off | `vismpwr 05 00 01 28` | 显示关闭 |

### 2.4 代码格式转换规则

工程中实现了左右双编辑器架构：

**左侧格式化代码** → vismpwr 可下发格式
- `DT DELAY LEN DATA...` 严格格式
- 仅支持 DT = 05 / 29 / 39 / 0A
- LEN 字段必须与后续数据数量一致

**右侧标准代码** → 支持多种输入格式
- 裸十六进制数据 → 自动包装为 `39 00 LEN DATA...`
- `REGW05/29/0A DATA...` → 转换为对应 DT 格式
- `DELAY N` → 插入到上一条命令的 delay 字段

---

## 三、屏幕显示内容控制

### 3.1 Framebuffer 探测（写屏前必做）

**在写入 Framebuffer 前，必须先探测分辨率和设备参数：**

```bash
# 获取虚拟分辨率（双buffer时等于物理分辨率）
cat /sys/class/graphics/fb0/virtual_size
# 输出：3036,1952

# 获取物理分辨率
cat /sys/class/graphics/fb0/physical_size
# 输出：600,376  (mm物理尺寸)

# 获取每像素位数
cat /sys/class/graphics/fb0/bits_per_pixel
# 输出：32

# 获取可见区域
cat /sys/class/graphics/fb0/resolution
# 输出：3036,1952

# 查看支持的视频模式
cat /sys/class/graphics/fb0/modes
# 输出：U:3036x1952p-60
```

**Python 探测脚本示例**：
```python
import subprocess

def get_fb_resolution():
    """获取Framebuffer分辨率"""
    cmd = "cat /sys/class/graphics/fb0/virtual_size"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    width, height = map(int, result.stdout.strip().split(','))
    return width, height

# 使用
screen_width, screen_height = get_fb_resolution()
fb_size = screen_height * screen_width * 4  # BGRA8888 = 4字节/像素
```

### 3.2 Framebuffer 写屏方法

**设备路径**：`/dev/fb0`
**分辨率**：3036 × 1952
**像素格式**：BGRA8888（每像素 4 字节）

#### 方法一：直接写入（适用于简单场景）

```python
import numpy as np

width, height = 3036, 1952
fb_path = '/dev/fb0'

# 创建纯色图像 (BGRA格式)
pixel = np.array([0, 0, 255, 255], dtype=np.uint8)  # 蓝色
image = np.full((height, width, 4), pixel, dtype=np.uint8)

# 写入Framebuffer
with open(fb_path, 'wb') as fb:
    fb.write(image.tobytes())
```

#### 方法二：内存映射 mmap（推荐，性能更好）

```python
import mmap
import numpy as np

width, height = 3036, 1952
fb_size = height * width * 4
fb_path = '/dev/fb0'

# 使用mmap直接操作内存
with open(fb_path, 'r+b') as fb:
    mm = mmap.mmap(fb.fileno(), fb_size, mmap.MAP_SHARED, mmap.PROT_WRITE)
    
    # 创建numpy数组视图直接操作
    fb_array = np.frombuffer(mm, dtype=np.uint8).reshape((height, width, 4))
    
    # 直接修改像素
    fb_array[:, :] = [0, 255, 0, 255]  # 绿色
    
    # 或者复制图像数据
    image = cv2.cvtColor(frame, cv2.COLOR_BGR2BGRA)
    np.copyto(fb_array, image)
    
    mm.close()
```

**mmap 优势**：
- 避免频繁 open/close 文件
- 支持 numpy 直接操作，效率高
- 可以创建数组视图，直接修改像素

```python
# 写纯色（black/white/red/green/blue/yellow/cyan/purple）
with open('/dev/fb0', 'wb') as fb:
    pixel = struct.pack('<4B', 0, 0, 255, 255)  # BGRA
    row = pixel * width
    fb.write(row * height)

# 写渐变
with open('/dev/fb0', 'wb') as fb:
    for y in range(height):
        v = int(y * 255 / max(height - 1, 1))
        pixel = bytes((v, v, v, 255))  # 灰度渐变
        fb.write(pixel * width)

# 彩条
colors = [(255,255,255,255), (0,255,255,255), (255,255,0,255), ...]
bar_width = max(width // len(colors), 1)
```

### 3.3 运行时图案渲染

**脚本路径**：`/vismm/fbshow/big8k_runtime/render_patterns.py`

**支持的图案**：

| 图案名称 | 说明 |
|----------|------|
| `pure_red/green/blue/black/white` | 纯色 |
| `gray/red/green/blue_gradient` | 垂直渐变 |
| `h/v_gradient` | 水平/垂直灰度渐变 |
| `colorbar` | 8 色彩条 |
| `checkerboard` | 棋盘格 |
| `radial_gray` | 放射状灰阶 |
| `colorful_1/2/3` | 炫彩图案 |

**使用方式**：
```bash
adb shell "python3 /vismm/fbshow/big8k_runtime/render_patterns.py pure_red"
```

### 3.4 逻辑图案

**脚本路径**：`/vismm/fbshow/logicPictureShow.py`

支持 40 种逻辑测试图案（0-39）：
- 0-9：ColorBar + 渐变组合
- 10-15：边框、Crosstalk、1Dot Inversion
- 16-19：棋盘格
- 20-22：单色渐变
- 23-26：几何图案（F字、线条、圆形）
- 27-31：灰阶梯度
- 32-39：黑屏、单线、炫彩

```bash
adb shell "python3 /vismm/fbshow/logicPictureShow.py 16"  # 棋盘格
```

### 3.5 图片显示

| 图片类型 | 工具/方法 |
|----------|-----------|
| BMP | `fbShowBmp` 二进制工具 |
| 其他格式 | Python + cv2 转 BGRA |

```bash
# BMP 显示（推荐，性能最好）
adb shell "/vismm/fbshow/fbShowBmp /vismm/fbshow/bmp_online/image.bmp"

# Python 显示任意格式（PNG/JPG等）
adb shell "python3 /vismm/fbshow/autorunUSB.py /path/to/image.png"
```

**Python 图片显示核心代码**：
```python
import cv2
import numpy as np
import mmap
import subprocess

def display_image(image_path, fb_path='/dev/fb0'):
    """显示任意格式图片"""
    # 1. 获取分辨率
    cmd = "cat /sys/class/graphics/fb0/virtual_size"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    screen_width, screen_height = map(int, result.stdout.strip().split(','))
    
    # 2. 读取并调整图片
    image = cv2.imread(image_path)  # BGR格式
    if image is None:
        raise ValueError(f"无法读取图片: {image_path}")
    
    img_height, img_width = image.shape[:2]
    
    # 3. 缩放到屏幕分辨率
    if img_width != screen_width or img_height != screen_height:
        image = cv2.resize(image, (screen_width, screen_height), 
                          interpolation=cv2.INTER_AREA)
    
    # 4. 转换为 BGRA 并写入
    image = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
    
    fb_size = screen_height * screen_width * 4
    with open(fb_path, 'r+b') as fb:
        mm = mmap.mmap(fb.fileno(), fb_size, mmap.MAP_SHARED, mmap.PROT_WRITE)
        mm.write(image.tobytes())
        mm.close()
```

### 3.6 按键切换画面（交互模式）

系统支持通过物理按键和鼠标滚轮实时切换显示画面。

#### 3.6.1 物理按键读取

**按键设备节点**：`/proc/chenfeng_adckey/chenfeng_adckey`

```python
def getKeyValue():
    """读取物理按键值"""
    result = subprocess.run(
        "cat /proc/chenfeng_adckey/chenfeng_adckey",
        shell=True, capture_output=True, text=True
    )
    time.sleep(0.1)
    return result.stdout.strip().replace(" ", "")

# 按键值：
# "03" - 向前切换（V+）
# "04" - 向后切换（V-）
# "02" - 退出程序
```

#### 3.6.2 鼠标事件读取

**鼠标设备路径**：`/dev/input/by-path/*-event-mouse`

```python
import struct
import os

def find_mouse_devices():
    """查找鼠标设备"""
    return [os.path.join('/dev/input/by-path', d) 
            for d in os.listdir('/dev/input/by-path') 
            if 'event-mouse' in d]

def read_mouse_event(device_path):
    """读取鼠标事件"""
    with open(device_path, 'rb') as f:
        while True:
            data = f.read(24)
            if len(data) == 24:
                _, _, ev_type, code, value = struct.unpack('llHHI', data)
                
                # 有符号转换
                if value > 0x7FFFFFFF:
                    value -= 0x100000000
                
                # ev_type=1: 按键事件
                #   code=272: 左键, 273: 右键, 274: 中键
                # ev_type=2: 移动/滚轮事件
                #   code=0: X轴, 1: Y轴, 8: 滚轮
                yield {'type': ev_type, 'code': code, 'value': value}
```

#### 3.6.3 交互模式示例（autorunUSB.py）

```python
import cv2
import numpy as np
import mmap
import subprocess
import threading
import os
import itertools

class DisplayConfig:
    def __init__(self):
        self.screen_width = 0
        self.screen_height = 0
        self.fb_path = '/dev/fb0'

def get_fb_config():
    """初始化显示配置"""
    config = DisplayConfig()
    cmd = "cat /sys/class/graphics/fb0/virtual_size"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    config.screen_width, config.screen_height = map(int, result.stdout.strip().split(','))
    return config

def display_on_fb(image):
    """写入Framebuffer"""
    global display_config
    if image.shape[2] == 3:
        image = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
    # 缩放到屏幕分辨率
    if image.shape[1] != display_config.screen_width:
        image = cv2.resize(image, (display_config.screen_width, display_config.screen_height))
    
    fb_size = display_config.screen_height * display_config.screen_width * 4
    with open(display_config.fb_path, 'r+b') as fb:
        mm = mmap.mmap(fb.fileno(), fb_size, mmap.MAP_SHARED, mmap.PROT_WRITE)
        mm.write(image.tobytes())
        mm.close()

def get_image_paths(directory):
    """获取目录中的图片列表"""
    return [os.path.join(directory, f) 
            for f in os.listdir(directory) 
            if f.endswith(('.png', '.jpg', '.jpeg', '.bmp'))]

def mouse_scroll_fun(device_path, image_paths):
    """鼠标滚轮控制图片切换"""
    index = 0
    gray_value = 128
    scroll_function_index = 0  # 0=图片, 1=DBV, 2=灰度, 3=左右移动
    
    gray_values_cycle = itertools.cycle(['255255255', '191000000', '127127127', 
                                         '064064064', '032032032', '000000000'])
    
    with open(device_path, 'rb') as f:
        while True:
            data = f.read(24)
            if len(data) == 24:
                _, _, ev_type, code, value = struct.unpack('llHHI', data)
                
                # 滚轮事件
                if ev_type == 2 and code == 8:
                    if scroll_function_index == 0:
                        # 切换图片
                        index = (index + (1 if value < 0x7FFFFFFF else -1)) % len(image_paths)
                        img = cv2.imread(image_paths[index])
                        display_on_fb(img)
                    elif scroll_function_index == 2:
                        # 调节灰度
                        if value > 0x7FFFFFFF:
                            value -= 0x100000000
                        gray_value = (gray_value + value) % 256
                        color = np.array([gray_value]*3 + [255], dtype=np.uint8)
                        image = np.full((display_config.screen_height, 
                                        display_config.screen_width, 4), color)
                        display_on_fb(image)
                
                # 左键：显示预设灰阶
                elif ev_type == 1 and code == 272 and value == 1:
                    gray_str = next(gray_values_cycle)
                    r, g, b = int(gray_str[:3]), int(gray_str[3:6]), int(gray_str[6:9])
                    color = np.array([b, g, r, 255], dtype=np.uint8)
                    image = np.full((display_config.screen_height,
                                    display_config.screen_width, 4), color)
                    display_on_fb(image)
                
                # 右键：切换滚轮功能模式
                elif ev_type == 1 and code == 273 and value == 1:
                    scroll_function_index = (scroll_function_index + 1) % 4

def key_fun(image_paths):
    """按键控制图片切换"""
    index = 0
    os.system("/vismm/fbshow/fbShowPattern \"255255255\"")  # 默认白色
    
    with open('/dev/input/by-path/*-event-mouse', 'rb') as f:
        while True:
            key = getKeyValue()
            if key == "04":  # V+ 向前
                index = (index + 1) % len(image_paths)
                img = cv2.imread(image_paths[index])
                display_on_fb(img)
            elif key == "03":  # V- 向后
                index = (index - 1) % len(image_paths)
                img = cv2.imread(image_paths[index])
                display_on_fb(img)

def main():
    global display_config
    display_config = get_fb_config()
    
    # USB设备挂载和图片目录
    # ...
    image_paths = get_image_paths('/mnt/usbsd/bmp_online')
    if not image_paths:
        image_paths = get_image_paths('/vismm/fbshow/bmp_online')
    
    if image_paths:
        display_on_fb(cv2.imread(image_paths[0]))
    
    # 启动鼠标控制
    mouse_devices = find_mouse_devices()
    for mouse_path in mouse_devices:
        threading.Thread(target=mouse_scroll_fun, 
                        args=(mouse_path, image_paths)).start()
    
    # 启动按键控制
    key_fun(image_paths)

if __name__ == "__main__":
    main()
```

#### 3.6.4 按键功能映射表

| 按键/操作 | 功能 | 说明 |
|-----------|------|------|
| 按键 V+ (03) | 图案+1 | 切换到下一个图案 |
| 按键 V- (04) | 图案-1 | 切换到上一个图案 |
| 左键点击 | 预设灰阶1 | 显示白色 255255255 |
| 右键点击 | 滚轮模式循环 | 切换滚轮功能 (0-3) |
| 滚轮上滑 | 图案+1 | 切换到下一个图片 |
| 滚轮下滑 | 图案-1 | 切换到上一个图片 |
| 中键按住+X移动 | 调节灰度 | 灰度值随鼠标X变化 |
| 中键按住+Y移动 | 调节灰度 | 灰度值随鼠标Y变化 |

### 3.6 视频播放

**脚本路径**：`/vismm/fbshow/videoPlay.py`

**控制信号文件**（位于 `/dev/shm/`）：
- `pause_signal` - 暂停/继续
- `stop_signal` - 停止播放
- `is_running` - 状态标志

```bash
# 播放视频（后台）
adb shell "/usr/bin/python3 /vismm/fbshow/videoPlay.py /vismm/fbshow/movie_online/video.mp4 0 0"

# 暂停
adb shell "echo > /dev/shm/pause_signal"

# 停止
adb shell "echo > /dev/shm/stop_signal"

# 检查状态
adb shell "if [ -f /dev/shm/is_running ]; then echo running; else echo stopped; fi"
```

#### 视频播放控制参数

`videoPlay.py` 参数说明：
```bash
python3 videoPlay.py <video_path> <IsResize> [<IsShowFramerate>]

# 参数：
#   video_path      - 视频文件路径
#   IsResize        - 缩放模式 (0=保持比例填黑边, 1=按比例缩放, 2=拉伸到全屏, 3=旋转90°)
#   IsShowFramerate - 是否显示帧率 (0=不显示, 1=显示)

# 示例：
python3 videoPlay.py /vismm/fbshow/movie_online/video.mp4 2 1
```

#### 自适应屏幕流传输（PC→8K平台）

**PC端 streamer**：截取PC屏幕并流传输到8K平台
```python
# adaptive_screen_streamer.py
# 功能：自动探测远程分辨率，支持旋转，8FPS流传输
# 端口：5001(控制), 5100(数据)
```

**8K平台端 receiver**：接收并显示流内容
```python
# adaptive_stream_receiver.py
# 功能：监听端口接收JPEG帧，直接写入Framebuffer
# 端口：5001(控制GET_RES), 5100(数据)

# 启动：
python3 /vismm/fbshow/adaptive_stream_receiver.py
```

### 3.7 Framebuffer 截图（读取显示内容）

```python
import cv2
import numpy as np
import mmap
import subprocess
import datetime
import os

def screenshot_fb(save_dir='/vismm/fbshow/save'):
    """截取当前Framebuffer内容"""
    # 1. 获取分辨率
    cmd = "cat /sys/class/graphics/fb0/virtual_size"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    width, height = map(int, result.stdout.strip().split(','))
    
    # 2. 读取Framebuffer
    fb_path = '/dev/fb0'
    fb_size = height * width * 4
    with open(fb_path, 'rb') as fb:
        with mmap.mmap(fb.fileno(), fb_size, mmap.MAP_SHARED, PROT_READ) as mm:
            fb_image = np.frombuffer(mm.read(fb_size), dtype=np.uint8)
            fb_image = fb_image.reshape((height, width, 4))
    
    # 3. 保存图片
    os.makedirs(save_dir, exist_ok=True)
    timestamp = datetime.datetime.now().strftime('%M%S')
    
    # 24位BMP (不带Alpha)
    bmp_path = os.path.join(save_dir, f'fb_24bit_{timestamp}.bmp')
    cv2.imwrite(bmp_path, fb_image[:, :, :3])
    
    # 32位PNG (带Alpha)
    png_path = os.path.join(save_dir, f'fb_32bit_{timestamp}.png')
    cv2.imwrite(png_path, fb_image)
    
    return bmp_path, png_path
```

### 3.8 USB 自动挂载与图片切换

**挂载点**：`/mnt/usbsd` (单USB) 或 `/mnt/usbsd1`, `/mnt/usbsd2` (多USB)

```python
def mount_usb_devices():
    """自动挂载USB设备"""
    import subprocess
    import os
    
    BASE_MOUNT_POINT = "/mnt/usbsd"
    devices = []
    
    # 扫描USB设备
    for device in os.listdir("/dev"):
        if device.startswith("sd") and device[-1].isdigit():
            devices.append(device)
    
    # 挂载设备
    for index, device in enumerate(devices):
        mount_point = BASE_MOUNT_POINT + (str(index + 1) if index > 0 else "")
        device_path = f"/dev/{device}"
        
        # 检查是否已挂载
        result = subprocess.run(['mount'], capture_output=True, text=True)
        if device_path not in result.stdout:
            os.makedirs(mount_point, exist_ok=True)
            subprocess.run(['mount', device_path, mount_point], check=True)
    
    return devices
```

**USB图片目录约定**：
- USB根目录下创建 `bmp_online` 文件夹
- 将测试图片放入该文件夹
- 程序自动扫描并切换显示

### 3.9 Web 文件上传服务

在8K平台搭建Web服务器，支持通过浏览器上传文件。

**部署步骤**：
```bash
# 1. 上传文件
adb push server.py /web_server/
adb push index.html /web_server/

# 2. 上传systemd服务
adb push file-upload-server.service /etc/systemd/system/

# 3. 启用服务
systemctl daemon-reload
systemctl start file-upload-server
systemctl enable file-upload-server
```

**服务配置** (file-upload-server.service)：
```ini
[Unit]
Description=8K File Upload Server
After=local-fs.target

[Service]
ExecStart=/usr/bin/python3 /web_server/server.py
WorkingDirectory=/web_server
Restart=always
User=root

[Install]
WantedBy=multi-user.target
```

**访问地址**：`http://<8K平台IP>:8080`

### 3.10 开机自启显示脚本

**autorun.py** - 开机显示预设图案：
```python
#!/usr/bin/env python3
import os
import subprocess
import cv2
import numpy as np
import mmap

# 获取分辨率
cmd = "cat /sys/class/graphics/fb0/virtual_size"
result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
width, height = map(int, result.stdout.strip().split(','))

# 创建Logo画面
font = cv2.FONT_HERSHEY_SIMPLEX
font_scale = 5
font_thickness = 5
text = 'Visionox'

# 计算文字位置（居中）
text_size = cv2.getTextSize(text, font, font_scale, font_thickness)[0]
text_x = (width - text_size[0]) // 2
text_y = (height + text_size[1]) // 2

# 创建灰底白字图像
image = np.full((height, width, 3), (128, 128, 128), dtype=np.uint8)  # 灰色背景
cv2.putText(image, text, (text_x, text_y), font, font_scale, (255, 255, 255), font_thickness)
cv2.rectangle(image, (0, 0), (width-1, height-1), (255, 255, 255), 1)  # 白色边框

# 转换为BGRA并写入
fb_image = np.zeros((height, width, 4), dtype=np.uint8)
fb_image[:, :, :3] = image
fb_image[:, :, 3] = 0

fb_path = '/dev/fb0'
fb_size = height * width * 4
with open(fb_path, 'r+b') as fb:
    mm = mmap.mmap(fb.fileno(), fb_size, mmap.MAP_SHARED, mmap.PROT_WRITE)
    mm.write(fb_image.tobytes())
    mm.close()
```

**systemd服务** (chenfeng-service.service)：
```ini
[Unit]
Description=8K Display Autorun Service
After=local-fs.target

[Service]
ExecStart=/usr/bin/python3 /vismm/fbshow/autorun.py
WorkingDirectory=/vismm/fbshow
Restart=always
User=root

[Install]
WantedBy=multi-user.target
```

---

## 四、OLED 配置下载流程

### 4.1 vis-timing.bin 固件结构

固件文件用于配置 OLED 初始化参数和 Timing 规格：

| 偏移 | 大小 | 内容 |
|------|------|------|
| 0 | 4 | 魔数 0xA5A55A5A |
| 4-19 | 16 | Panel Vendor |
| 20-35 | 16 | Panel Name |
| 36-43 | 8 | Version |
| 48-95 | 48 | Timing 参数区 |
| 144+ | N | Init Sequence |

**Timing 参数**：
```
PCLK(kHz), HACT, HFP, HBP, HSYNC, VACT, VFP, VBP, VSYNC,
Display Flags, MIPI Mode/Video Type, Lanes, Format, Phy Mode, DSC配置
```

### 4.2 下载完整流程

```
1. 生成 vis-timing.bin（包含 OLED 配置）
      ↓
2. adb push vis-timing.bin → /vismm/vis-timing.bin
      ↓
3. 执行 /vismm/tools/repack_initrd.sh
      ↓
4. 重启设备 → sync → reboot
```

### 4.3 initrd 重打包流程（repack_initrd.sh）

```bash
# 首次运行
dumpimage -T ramdisk -p 0 -o old_initrd.gz /boot/initrd-5.10
zcat old_initrd.gz | cpio -idmv  # 解压到 initramfs
# 复制固件
cp /vismm/vis-timing.bin /boot/uimage_repack/initramfs/lib/firmware/vis-timing.bin
find . | cpio -o -H newc | gzip > new_initrd.gz
mkimage -A arm -O linux -T ramdisk -C gzip -d new_initrd.gz /boot/initrd-5.10.new
mv /boot/initrd-5.10.new /boot/initrd-5.10
sync && reboot

# 后续运行（跳过备份和解包）
cp /vismm/vis-timing.bin /boot/uimage_repack/initramfs/lib/firmware/
find . | cpio -o -H newc | gzip > new_initrd.gz
mkimage ... /boot/initrd-5.10.new && mv ... && sync && reboot
```

---

## 五、电源轨道监控

### 5.1 INA226 电源监控芯片

**总线**：I2C Bus 4
**GPIO 控制**：GPIO3B5 (Pin 109) - 控制量程切换

| 电源轨 | I2C 地址 | 分流电阻 | 说明 |
|--------|----------|----------|------|
| VCI | 0x41 | 0.2Ω | 电源输入 |
| VDDIO | 0x45 | 0.2Ω | 数字 IO |
| DVDD | 0x48 | 0.2Ω | 数字内核 |
| ELVDD | 0x40 | 0.025Ω | OLED 正电源 |
| ELVSS | 0x46 | - | OLED 负电源 |
| AVDD | 0x44 | 0.2Ω | 模拟电源 |
| VGH | 0x4C | 0.2Ω | 栅极高电压 |
| VGL | 0x4A | - | 栅极低电压 (INA282) |

### 5.2 读取方法

```python
import smbus2

BUS = 4

def read_bus_voltage(addr):
    with smbus2.SMBus(BUS) as bus:
        raw = bus.read_word_data(addr, 0x02)  # Bus Voltage Register
        return raw * 1.25e-3  # 1.25 mV/LSB

def read_shunt_voltage(addr):
    with smbus2.SMBus(BUS) as bus:
        raw = bus.read_word_data(addr, 0x01)  # Shunt Voltage Register
        if raw & 0x8000:
            raw -= 0x10000  # 有符号转换
        return raw * 2.5e-6  # 2.5 µV/LSB
```

### 5.3 GPIO3B5 量程控制

```python
def gpio3b5_set(value):  # value = 0 或 1
    pin = 109
    with open('/sys/class/gpio/export', 'w') as f:
        f.write(str(pin))
    with open(f'/sys/class/gpio/gpio{pin}/direction', 'w') as f:
        f.write('out')
    with open(f'/sys/class/gpio/gpio{pin}/value', 'w') as f:
        f.write(str(value))

# GPIO3B5=0 → 0.2Ω 量程（高电流）
# GPIO3B5=1 → 1.2Ω 量程（低电流/高精度）
```

---

## 六、关键远端路径汇总

### 6.1 系统工具

| 路径 | 说明 |
|------|------|
| `/usr/local/bin/vismpwr` | MIPI 命令下发工具 |
| `/usr/local/bin/repack_initrd.sh` | initrd 重打包脚本 |
| `/vismm/tools/repack_initrd.sh` | 同上（部署位置） |

### 6.2 显示相关

| 路径 | 说明 |
|------|------|
| `/dev/fb0` | Framebuffer 设备 |
| `/vismm/fbshow/fbShowBmp` | BMP 显示工具 |
| `/vismm/fbshow/fbShowPattern` | 图案显示工具 |
| `/vismm/fbshow/fbShowMovie` | 视频播放工具 |
| `/vismm/fbshow/bmp_online/` | 在线 BMP 图片目录 |
| `/vismm/fbshow/movie_online/` | 在线视频目录 |
| `/vismm/fbshow/logicPictureShow.py` | 逻辑图案脚本 |
| `/vismm/fbshow/big8k_runtime/render_patterns.py` | 运行时图案脚本 |
| `/vismm/fbshow/videoPlay.py` | 视频播放脚本 |
| `/vismm/fbshow/autorun.py` | 开机自启脚本 |

### 6.3 固件和配置

| 路径 | 说明 |
|------|------|
| `/vismm/vis-timing.bin` | OLED 固件文件 |
| `/boot/initrd-5.10` | initrd 镜像 |
| `/boot/initrd-5.10.bak` | initrd 备份 |
| `/boot/firmware_init` | 重打包标记文件 |
| `/boot/uimage_repack/` | 重打包工作目录 |

### 6.4 电源和 I2C

| 路径 | 说明 |
|------|------|
| `/dev/i2c-4` | I2C 总线 4 |
| `/sys/class/gpio/gpio109/` | GPIO3B5 控制 |
| `/sys/class/thermal/thermal_zone0/temp` | CPU 温度 |

---

## 七、Python 脚本部署目录结构

```
/vismm/
├── vis-timing.bin              # OLED 固件
├── autorun.py                  # 开机自启脚本
├── tools/
│   └── repack_initrd.sh        # initrd 重打包
├── disableService.sh           # 禁用非必要服务脚本
└── fbshow/
    ├── autorun.py              # 自启脚本副本
    ├── autorunUSB.py           # USB图片切换脚本
    ├── fbShowBmp               # BMP 显示工具
    ├── fbShowPattern           # 图案工具（二进制）
    ├── fbShowMovie             # 视频工具（二进制）
    ├── bmp_online/             # 在线 BMP 图片
    ├── movie_online/           # 在线视频
    ├── save/                   # 截图保存目录
    ├── big8k_runtime/
    │   └── render_patterns.py  # 运行时图案
    ├── logicPictureShow.py      # 逻辑图案（40种）
    ├── videoPlay.py            # 视频播放（支持控制信号）
    ├── adaptive_stream_receiver.py  # 屏幕流接收
    └── Mouse_crossLine.py      # 鼠标十字线显示

/web_server/                    # Web服务目录（可选）
├── server.py                   # Flask上传服务器
└── index.html                  # 上传页面
```

## 八、关键设备节点汇总

### 8.1 显示相关设备

| 节点路径 | 说明 |
|----------|------|
| `/dev/fb0` | Framebuffer 主设备 |
| `/sys/class/graphics/fb0/virtual_size` | 虚拟分辨率 (3036,1952) |
| `/sys/class/graphics/fb0/physical_size` | 物理尺寸 (600,376 mm) |
| `/sys/class/graphics/fb0/bits_per_pixel` | 每像素位数 (32) |
| `/sys/class/graphics/fb0/resolution` | 可见分辨率 |
| `/sys/class/graphics/fb0/modes` | 支持的视频模式 |

### 8.2 输入设备

| 节点路径 | 说明 |
|----------|------|
| `/proc/chenfeng_adckey/chenfeng_adckey` | 物理按键值读取 |
| `/dev/input/by-path/*-event-mouse` | USB鼠标事件设备 |
| `/dev/input/by-id/*` | 输入设备ID |

### 8.3 控制信号文件

| 文件路径 | 说明 |
|----------|------|
| `/dev/shm/pause_signal` | 视频暂停信号 |
| `/dev/shm/stop_signal` | 视频停止信号 |
| `/dev/shm/is_running` | 视频运行状态标志 |

### 8.4 USB 挂载

| 挂载点 | 说明 |
|--------|------|
| `/mnt/usbsd` | 单USB设备挂载点 |
| `/mnt/usbsd1` | 多USB设备挂载点1 |
| `/mnt/usbsd2` | 多USB设备挂载点2 |

---

## 八、部署命令详解

### 8.1 Install Tools（部署工具）

推送依赖包、Python 库、cpio 工具和 repack_initrd.sh：

```
resources/deploy/dist-packages/  → /usr/lib/python3/dist-packages
resources/deploy/python-libs/   → /vismm/Python_lib (pip install)
cpio_*.deb                       → /tmp/cpio/ (dpkg -i)
repack_initrd.sh                 → /vismm/tools/
rk3588-i2c4-m2-overlay.dtbo     → /boot/dtb/overlay/
```

### 8.2 Install App（部署应用）

推送所有显示相关工具和脚本：

```
vismpwr                 → /usr/local/bin/vismpwr
disableService.sh       → /vismm/disableService.sh
fbShowBmp/Pattern/Movie → /vismm/fbshow/
所有 .py 文件           → /vismm/fbshow/
autorun.py + service    → /vismm/fbshow/ + /etc/systemd/system/
```

### 8.3 开机自启配置

```bash
# 设置开机自启脚本
systemctl enable big8k-autorun.service
systemctl start big8k-autorun.service

# 切换启动目标
systemctl set-default multi-user.target   # 无图形界面
systemctl set-default graphical.target    # 图形界面
```

---

## 九、常用 ADB Shell 命令参考

```bash
# ========== Framebuffer 探测 ==========
adb shell "cat /sys/class/graphics/fb0/virtual_size"      # 获取分辨率
adb shell "cat /sys/class/graphics/fb0/bits_per_pixel"  # 获取位深
adb shell "cat /sys/class/graphics/fb0/modes"            # 获取支持的模式

# ========== MIPI 命令 ==========
adb shell "vismpwr -r 01 0A"                  # 读取 Power Mode
adb shell "vismpwr 05 00 01 01"               # 软件复位
adb shell "vismpwr 05 00 01 11"               # Sleep Out
adb shell "vismpwr 05 00 01 29"               # Display On
adb shell "vismpwr 39 00 03 F0 5A 5A"        # 写入寄存器

# ========== 显示图案 ==========
adb shell "python3 /vismm/fbshow/big8k_runtime/render_patterns.py pure_red"
adb shell "python3 /vismm/fbshow/logicPictureShow.py 16"  # 图案16
adb shell "/vismm/fbshow/fbShowBmp /vismm/fbshow/bmp_online/test.bmp"

# ========== 视频播放控制 ==========
adb shell "/usr/bin/python3 /vismm/fbshow/videoPlay.py /vismm/fbshow/movie_online/video.mp4 2 0 &"
adb shell "echo > /dev/shm/pause_signal"      # 暂停/继续
adb shell "echo > /dev/shm/stop_signal"       # 停止
adb shell "cat /dev/shm/is_running"            # 检查状态

# ========== 截图 ==========
adb shell "python3 /vismm/fbshow/framebuffer_screenshot.py"
adb shell "ls -la /vismm/fbshow/save/"        # 查看截图

# ========== USB 设备 ==========
adb shell "ls -la /dev/sd*"                   # 列出USB设备
adb shell "fdisk -l"                         # 查看所有磁盘
adb shell "mount | grep sd"                   # 查看挂载状态
adb shell "ls /mnt/usbsd/bmp_online/"         # 查看USB图片

# ========== 按键测试 ==========
adb shell "cat /proc/chenfeng_adckey/chenfeng_adckey"  # 读取按键值
# 按下按键后输出: 03(V+) / 04(V-) / 02(exit)

# ========== 输入设备 ==========
adb shell "ls -la /dev/input/by-path/"        # 列出输入设备
adb shell "evtest /dev/input/by-path/*-event-mouse"  # 测试鼠标事件

# ========== 设备探测 ==========
adb shell "getprop ro.product.model"          # 产品型号
adb shell "getprop ro.board.platform"        # 平台 (rk3588)
adb shell "dmesg | grep mipi"                 # MIPI状态
adb shell "dmesg | grep dsi"                  # DSI状态

# ========== 系统状态 ==========
adb shell "cat /proc/stat | awk '/cpu / {print (\$2+\$4)*100/(\$2+\$4+\$5)}'"  # CPU使用率
adb shell "cat /proc/meminfo | awk '/MemTotal|MemAvailable/{print}'"
adb shell "awk '{print \$1/1000}' /sys/class/thermal/thermal_zone0/temp"  # CPU温度

# ========== 进程管理 ==========
adb shell "ps aux | grep python"              # Python进程
adb shell "killall -9 python3"               # 强制终止所有Python
adb shell "killall -9 videoPlay"             # 停止视频播放

# ========== 网络 ==========
adb shell "ifconfig"                          # 网络配置
adb shell "ifconfig eth0 | grep inet"        # IP地址
adb shell "ping -c 3 8.8.8.8"                # 网络测试

# ========== 服务管理 ==========
adb shell "systemctl status big8k-autorun"  # 服务状态
adb shell "systemctl restart big8k-autorun"  # 重启服务
adb shell "systemctl disable bluetooth snapd fwupd"  # 禁用服务

# ========== 文件操作 ==========
adb shell "ls -la /vismm/"
adb shell "mkdir -p /vismm/fbshow/test"
adb shell "rm -rf /vismm/fbshow/test/*"

# ========== Web服务 ==========
adb shell "systemctl status file-upload-server"
adb shell "curl http://localhost:8080/"      # 测试Web服务
```

---

## 十、Tauri 命令 API 映射

| 前端函数 | 后端 Rust 函数 | 说明 |
|----------|----------------|------|
| `adb_devices()` | `adb_devices` | 获取设备列表 |
| `adb_shell(cmd)` | `adb_shell` | 执行 shell 命令 |
| `mipi_send_commands(cmds[])` | `mipi_send_commands` | 批量发送 MIPI 命令 |
| `mipi_read_power_mode()` | `mipi_read_power_mode` | 读取电源模式 |
| `mipi_software_reset()` | `mipi_software_reset` | 软件复位 |
| `mipi_sleep_in()` | `mipi_sleep_in` | 进入睡眠 |
| `mipi_sleep_out()` | `mipi_sleep_out` | 退出睡眠 |
| `display_solid_color(color)` | `display_solid_color` | 显示纯色 |
| `display_gradient(type)` | `display_gradient` | 显示渐变 |
| `display_color_bar()` | `display_color_bar` | 显示彩条 |
| `display_checkerboard()` | `display_checkerboard` | 显示棋盘格 |
| `run_runtime_pattern(name)` | `run_runtime_pattern` | 运行时图案 |
| `run_logic_pattern(id)` | `run_logic_pattern` | 逻辑图案 |
| `read_power_rails()` | `read_power_rails` | 读取电源轨道 |
| `display_image(path)` | `display_image` | 显示图片 |
| `play_video(path, zoom, fps)` | `play_video` | 播放视频 |
| `send_video_control(action)` | `send_video_control` | 视频控制 |
| `download_oled_config(request)` | `download_oled_config_and_reboot` | 下载 OLED 配置 |
| `deploy_install_tools()` | `deploy_install_tools` | 部署工具 |
| `deploy_install_app()` | `deploy_install_app` | 部署应用 |
