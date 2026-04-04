# CA-VP410 亮度计通信协议参考

> 这是面向**快速接入与日常查阅**的简版说明。
> 如需查看完整标准口径、项目统一约定、与 CA-SDK2 的系统性对照，请以 `ca410_protocol.md` 为主。
>
> 约定：从本文件开始，后续提到 **410**、**CA410** 时，默认都指 **CA-VP410**（CA-410 系列探头）。
> 在日常对话中，用户通常会把 **CA-VP410** 简称为 **410**。
>
> 本文档已经同步到与 `ca410_protocol.md` 相同的项目口径：
> - 默认对象是 **CA-VP410**
> - 当前项目只采用 **USB 连接**
> - 在 Windows 下通常表现为 **虚拟串口 / COM 口**
> - 如果把 410 接到 **8K平台**，那么在 8K平台 下同样可以通过串口与其通信

---

## 一、设备概述

当前项目里的 **410 / CA410**，默认都指：

- **Konica Minolta CA-VP410 探头**

如果文中需要特指其他对象，会明确写出：

- `CA-DP40`
- `CA-VP410A`
- `CA-VP427A`
- `CA-VP427C`

为了避免和数据处理器混淆，当前项目统一规定：

> **没有额外说明时，410 / CA410 = CA-VP410。**

---

## 二、当前项目采用的连接方式

### 2.1 项目统一约定

当前项目对 CA-VP410 的接入统一按下面方式理解：

> **只采用 USB 连接。**

也就是说，在当前项目语境里：

- 不把 RS-232C 当成当前主路径
- 不把 Ethernet / Bluetooth 当成当前探头直连路径
- 默认都按 **USB 串口设备** 使用

### 2.2 Windows 下的表现形式

当 CA-VP410 通过 USB 接到 Windows 电脑后，通常表现为：

- **虚拟串口 / COM 口**

例如：

- `COM14`
- `COM201`

所以最标准的项目说法是：

> **CA-VP410 通过 USB 连接，在 Windows 下通常表现为虚拟串口 / COM 口。**

### 2.3 接到 8K平台时的通信方式

如果把 **410（即 CA-VP410）** 接到 **8K平台**，那么在 8K平台 侧它同样会以串口设备形式出现。

也就是说：

> **如果把 410 接到 8K平台，那么 8K平台 下也可以通过串口方式与其通信。**

因此从协议本质上看：

- 接电脑 → 电脑侧串口通信
- 接 8K平台 → 8K平台 侧串口通信

本质是一致的，都是**串口协议通信**。

---

## 三、串口参数（关键）

| 参数 | 值 | 备注 |
|------|------|------|
| 波特率 | **921600** | CA-VP410 探头支持；项目已实测通过 |
| 校验位 | **偶校验 (Even)** | `serial.PARITY_EVEN` |
| 数据位 | **7** | `serial.SEVENBITS` |
| 停止位 | **1.5** | `serial.STOPBITS_ONE_POINT_FIVE` |
| 超时 | 0.5 秒 | 读超时 |
| 命令格式 | ASCII + `\r` | 如 `MES,1\r` |

> **常见错误**：使用 8N1（8数据位、无校验、1停止位）或低波特率会导致通信失败。
> 正确组合是：
>
> **921600 / Even / 7bit / 1.5 stop / `\r`**

### 3.1 标准核对说明

这一点已经与 `ca-sdk2_en-US.pdf` 的关键信息做过核对：

- **CA-410 probe** 支持到 **921600**
- **CA-410 data processor** 最高到 **230400**

因此当前项目对 CA-VP410 使用 `921600` 是符合标准的。

---

## 四、初始化命令序列

按顺序发送，每条命令后等待 `OK00` 响应：

| 顺序 | 命令 | 功能 |
|------|------|------|
| 1 | `SCS,0\r` | 同步源设置 |
| 2 | `SCS,4,60.00\r` | INT 模式下同步频率 60Hz |
| 3 | `FSC,1\r` | 测量速度 FAST |
| 4 | `MMS,0\r` | 控制模式 |
| 5 | `MDS,0\r` | 显示模式: LV,x,y |
| 6 | `FMS,0\r` | 闪烁方式 |
| 7 | `MCH,0\r` | 校准通道: CH00 |
| 8 | `LUS,1\r` | 亮度单位: cd/m² |
| 9 | `ZRC\r` | 零点校准 |

### 4.1 零点校准说明

- `ZRC` 前提：探头应处于合适的遮光条件
- 等待返回：`OK00`
- 实际等待时间：通常几秒到十几秒

---

## 五、测量命令

### 5.1 获取亮度/色度：`MES,1\r`

- **发送**：`MES,1\r`
- **响应格式**：`OK00,P1,0,Cx,Cy,Lv,...`
  - `Cx` (`parts[3]`)：x 色坐标
  - `Cy` (`parts[4]`)：y 色坐标
  - `Lv` (`parts[5]`)：亮度（cd/m²）

### 5.2 返回字段解释示例

例如：

```text
OK00,P1,0,0.3362781,0.3559744,12.563168,-0.01,-99999999
```

解析后：

- `x = 0.3362781`
- `y = 0.3559744`
- `Lv = 12.563168 cd/m²`

这套解析已经在项目中通过以下方式验证过：

- 自动检测 COM 口后读取一次亮度
- framebuffer 灰阶 60~128 连续扫描
- 亮度曲线单调递增，与画面变化一致

---

## 六、Python 通信代码

```python
import serial
import time

ser = serial.Serial(
    port='COM14',
    baudrate=921600,
    parity=serial.PARITY_EVEN,
    bytesize=serial.SEVENBITS,
    stopbits=serial.STOPBITS_ONE_POINT_FIVE,
    timeout=0.5,
)
time.sleep(0.3)

init_commands = [
    'SCS,0\r',
    'SCS,4,60.00\r',
    'FSC,1\r',
    'MMS,0\r',
    'MDS,0\r',
    'FMS,0\r',
    'MCH,0\r',
    'LUS,1\r',
]

for cmd in init_commands:
    ser.write(cmd.encode())
    time.sleep(0.2)
    _ = ser.readline()

# 零点校准
ser.write('ZRC\r'.encode())
for _ in range(10):
    time.sleep(1)
    if ser.in_waiting > 0:
        resp = ser.readline().decode('utf-8', errors='replace').strip()
        if 'OK00' in resp:
            break

# 清缓冲
if ser.in_waiting > 0:
    ser.read(ser.in_waiting)

# 测量
ser.write('MES,1\r'.encode())
time.sleep(0.1)
raw = ser.readline().decode('utf-8', errors='replace').strip()
parts = raw.split(',')

if len(parts) >= 6:
    cx = float(parts[3])
    cy = float(parts[4])
    lv = float(parts[5])
    print(f'亮度: {lv:.4f} cd/m²')
    print(f'色坐标: ({cx:.4f}, {cy:.4f})')

ser.close()
```

---

## 七、Tauri / Rust 后端集成建议

### 7.1 依赖

```toml
[dependencies]
serialport = "4.2"
```

### 7.2 Rust 串口通信示例

```rust
use serialport::SerialPort;
use std::time::Duration;

fn open_ca410(port_name: &str) -> Result<Box<dyn SerialPort>, String> {
    serialport::new(port_name, 921600)
        .parity(serialport::Parity::Even)
        .data_bits(serialport::DataBits::Seven)
        .stop_bits(serialport::StopBits::OnePointFive)
        .timeout(Duration::from_millis(500))
        .open()
        .map_err(|e| format!("打开串口失败: {}", e))
}
```

### 7.3 项目建议

对 Big8K-Tauri-UI 来说，当前更推荐：

```text
自动检测 COM 口 → 串口初始化 → MES,1 读取 → 解析 x/y/Lv
```

如果设备不是接在 Windows PC，而是接在 8K平台，则同理改成：

```text
8K平台 串口设备 → 初始化 → MES,1 读取 → 解析 x/y/Lv
```

---

## 八、测量速度模式（与 SDK 对齐）

| 模式 | 命令 | SDK值 | 说明 |
|---|---|---:|---|
| SLOW | `FSC,0` | 0 | 更慢、更稳 |
| FAST | `FSC,1` | 1 | 更快，当前项目常用 |
| LTD.AUTO | `FSC,2` | 2 | 自动模式限制版 |
| AUTO | `FSC,3` | 3 | 自动在速度与稳定性之间折中 |
| ORG.AUTO | `FSC,4` | 4 | 仅部分新型号支持 |

建议：

- 单点快速测量：`FAST`
- 连续灰阶曲线扫描：优先 `FAST`，低灰不稳时再考虑 `AUTO`
- 精度优先：`SLOW` 或 `AUTO`

---

## 九、同步模式（与 SDK 对齐）

| 模式 | 命令 | SDK值 | 说明 |
|---|---|---:|---|
| NTSC | `SCS,0` | 0 | 标准同步模式之一 |
| PAL | `SCS,1` | 1 | 标准同步模式之一 |
| EXTERNAL | `SCS,2` | 2 | 外部同步 |
| UNIVERSAL | `SCS,3` | 3 | 通用模式 |
| INTERNAL | `SCS,4,<freq>` | 4 | 指定频率，例如 60.00 |
| MANUAL | `SCS,5,<ms>` | 5 | 手动指定积分时间 |

当前 Big8K 项目建议：

```text
SCS,4,60.00
```

也就是 **INTERNAL + 指定频率**。

---

## 十、注意事项

1. **COM 口编号会变化**，插拔后可能不同，建议总是先自动检测
2. **不要把停止位写错**，当前正确值是 `1.5`
3. **低亮度下建议更保守**，可考虑 `AUTO / SLOW / 多次平均`
4. **测量前清缓冲区**，避免上一次响应残留
5. **零校准要正确执行**，否则低亮测量可能不稳定
6. **当前项目语境里只采用 USB 连接**
7. **Windows 下通常表现为虚拟串口 / COM 口**
8. **接到 8K平台 后，同样按串口设备通信**

---

## 十一、已知支持的相关型号（按文档口径区分）

- **默认对象**：CA-VP410
- 其他变体：CA-VP410A、CA-VP427A、CA-VP427C
- 数据处理器：CA-DP40

后续项目文档里如果出现：

- `410`
- `ca410`
- `CA410`

默认都应理解为：

> **CA-VP410**

---

## 十二、参考来源

- `E:\ai2026\Big8K-Tauri-UI\docs\ca410_protocol.md`
- `E:\ai2026\Big8K-Tauri-UI\docs\ca-sdk2_en-US.pdf`
- `E:\Resource\8Big8K\8K_software\python-c453\DW_C35\CA4xx.py`
