# CA-VP410 通信协议与接入说明

> 约定：从本文件开始，后续提到 **410**、**CA410** 时，默认都指 **CA-VP410**（CA-410 系列探头）。
> 在日常对话中，用户通常会把 **CA-VP410** 简称为 **410**。
> 如需特指数据处理器或其他探头型号，会明确写出 **CA-DP40 / CA-VP410A / CA-VP427A** 等完整名称。
>
> 本文档已合并并校对以下资料：
> - `E:\ai2026\Big8K-Tauri-UI\docs\ca410-brightness-meter-protocol.md`
> - `E:\ai2026\Big8K-Tauri-UI\docs\ca410_protocol.md`
> - `E:\ai2026\Big8K-Tauri-UI\docs\ca-sdk2_en-US.pdf`
>
> 目标：保留对接 Big8K-Tauri-UI 最有用、且与 CA-SDK2 官方手册一致的标准内容，避免口径冲突。

---

## 1. 设备范围与命名约定

### 1.1 本文档默认对象

本文档默认的“410 / CA410”是：

- **CA-VP410**：CA-410 系列探头

如果文中出现以下对象，会单独写全名：

- **CA-DP40**：CA-410 数据处理器
- **CA-VP410A**：CA-VP410 的变体
- **CA-VP427A / CA-VP427C**：其他兼容探头变体

### 1.2 为什么要这样约定

在实际项目里，大家常把：

- CA-VP410
- CA-410
- CA410
- 410
- VP410

混着叫。为了避免后续 AI 或文档把“探头”和“数据处理器”搞混，本文件统一规定：

> **没有额外说明时，410 / CA410 = CA-VP410 探头。**

### 1.3 对话中的简称约定

后续在用户日常对话里：

- **410** = **CA-VP410**
- **ca410** = **CA-VP410**
- **CA410** = **CA-VP410**

除非用户明确提到：

- **CA-DP40**
- **数据处理器**
- **410A / 427A / 427C**

否则默认都按 **CA-VP410 探头** 理解。

---

## 2. 连接方式：哪些是标准支持的

这一部分以 `ca-sdk2_en-US.pdf` 为准。

### 2.1 官方支持的主机连接方式

CA-SDK2 手册明确列出，CA-410 体系支持以下主机侧连接方式：

| 连接方式 | 主机 ↔ 设备 | 说明 |
|---|---|---|
| USB | ✅ | 最常用；Windows 下通常表现为虚拟串口 / COM 口 |
| RS-232C | ✅ | 老式串口连接 |
| Ethernet | ✅（数据处理器） | 仅数据处理器支持 |
| Bluetooth | ✅（数据处理器） | 仅数据处理器支持 |

### 2.2 和 CA-VP410 直接相关的项目约定

对 **CA-VP410 探头** 来说，当前项目统一按下面这条规则执行：

> **只采用 USB 连接。**

也就是说，在 Big8K 项目当前文档和代码语境里：

- 我们不把 RS-232C 当作当前接入主路径
- 我们不把 Ethernet / Bluetooth 当作 CA-VP410 的当前项目接入路径
- 我们统一采用 **USB 连接后枚举出的串口通道** 进行通信

### 2.3 Windows 下的表现形式

在 Windows 下，CA-VP410 通过 USB 接到电脑后，通常表现为：

- **虚拟串口 / COM 口**

例如：

- `COM14`
- `COM201`

所以项目当前最标准的说法是：

> **CA-VP410 通过 USB 连接，在 Windows 下通常表现为虚拟串口 / COM 口。**

### 2.4 接到 8K平台时的通信方式

如果把 **CA-VP410** 通过 USB 接到 **8K平台**，那么在 8K平台 侧它同样会以串口设备的形式出现。

也就是说：

> **如果把 410（即 CA-VP410）接到 8K平台，那么 8K平台 下也可以通过串口方式与其通信。**

当前项目里最常用的是“CA-VP410 接 PC”，但从协议本质上说：

- 接电脑 → 电脑侧串口通信
- 接 8K平台 → 8K平台 侧串口通信

本质是一致的，都是**串口协议通信**。

### 2.5 关于“只能串口”这件事的标准化说明

从当前 Big8K 项目角度，应统一理解为：

> **CA-VP410 在本项目里只按 USB 串口设备来使用。**  
> 在 Windows 下通常是 COM 口；如果接到 8K平台，则在 8K平台 下同样按串口设备通信。

而从 CA-SDK2 官方体系看，CA-410 家族整体还存在 RS-232C、Ethernet、Bluetooth 等连接方式；其中 Ethernet / Bluetooth 是数据处理器侧能力，不应直接套到 CA-VP410 当前项目接入方式上。

---

## 3. 当前项目推荐的接入方式

### 3.1 推荐路径（PC 侧）

当前 Big8K 项目里，推荐且已验证通过的路径是：

```text
Windows PC → USB → CA-VP410 → 虚拟 COM 口 → 串口命令通信
```

### 3.2 推荐路径（8K平台 侧）

如果设备直接接到 8K平台，则推荐路径可表示为：

```text
8K平台 → USB → CA-VP410 → 串口设备 → 串口命令通信
```

### 3.3 为什么推荐这条路径

因为它：

- 轻量
- 不依赖额外 DLL 调用链
- 易于被 Python / PowerShell / Rust 直接接入
- 已在项目中做过实测和亮度曲线扫描验证

### 3.4 对 Big8K 现状最实用的判断

如果你的目标是：

- 自动检测当前 410 端口
- 读一次亮度
- 连续扫灰阶
- 接进 Tauri / Python / 自动化脚本

那优先选：

> **USB 虚拟串口 + 直接串口协议**

而不是先走 SDK DLL 封装。

---

## 4. 串口参数（关键）

这部分已经被项目实测和现有脚本验证过，也与 `ca-sdk2_en-US.pdf` 中 probe 支持高波特率的描述一致。

| 参数 | 值 | 备注 |
|---|---|---|
| 波特率 | **921600** | CA-VP410 探头支持；SDK 手册也列为 probe 有效值 |
| 校验位 | **Even** | 偶校验 |
| 数据位 | **7** | 不是 8 位 |
| 停止位 | **1.5** | 关键易错点 |
| 握手 | None | 当前项目按无握手使用 |
| 超时 | 0.5s 左右 | 可按脚本调整 |
| 命令结束符 | `\r` | ASCII + 回车 |

### 4.1 最容易出错的点

最容易错的是这三个：

1. 把数据位写成 8
2. 把校验写成 None
3. 把停止位写成 1 或 2，而不是 **1.5**

### 4.2 关于停止位的特别说明

现有项目里这件事踩过坑，最终已确认：

> **正确的是 1.5 stop bits，不是 2 stop bits。**

在 pyserial 中应写为：

```python
serial.STOPBITS_ONE_POINT_FIVE
```

### 4.3 CA-SDK2 对波特率的标准说明

`ca-sdk2_en-US.pdf` 明确写到：

- **CA-410 probe** 支持波特率到 **921600**
- **CA-410 data processor** 最高到 **230400**

这与项目中“CA-VP410 直连时用 921600”是相互一致的。

---

## 5. 当前项目验证通过的初始化序列

按当前项目实测，CA-VP410 初始化命令顺序如下：

```text
SCS,0
SCS,4,60.00
FSC,1
MMS,0
MDS,0
FMS,0
MCH,0
LUS,1
ZRC
```

### 5.1 各命令含义

| 顺序 | 命令 | 含义 |
|---|---|---|
| 1 | `SCS,0` | 同步源设置 |
| 2 | `SCS,4,60.00` | INT 模式下同步频率 60Hz |
| 3 | `FSC,1` | 测量速度 FAST |
| 4 | `MMS,0` | 控制模式 |
| 5 | `MDS,0` | 显示模式 LV,x,y |
| 6 | `FMS,0` | 闪烁方式 |
| 7 | `MCH,0` | 通道 CH0 |
| 8 | `LUS,1` | 亮度单位 cd/m² |
| 9 | `ZRC` | 零校准 |

### 5.2 返回值判断

初始化命令通常期望返回：

```text
OK00
```

### 5.3 零校准说明

`ZRC` 必须在适当的遮光条件下执行。项目里按“等待 `OK00` 返回”为准，实际等待时间可能在几秒到十几秒之间。

---

## 6. 测量命令与返回格式

### 6.1 测量命令

标准测量命令：

```text
MES,1
```

### 6.2 项目中当前确认的返回格式

当前项目按以下格式解析：

```text
OK00,P1,0,Cx,Cy,Lv,...
```

也就是：

- `parts[3]` → `x`
- `parts[4]` → `y`
- `parts[5]` → `Lv`

### 6.3 解析示例

例如：

```text
OK00,P1,0,0.3362781,0.3559744,12.563168,-0.01,-99999999
```

解析结果：

- `x = 0.3362781`
- `y = 0.3559744`
- `Lv = 12.563168 cd/m²`

### 6.4 项目里这套解析已经被哪些事情验证过

这套解析不只是“文档推测”，而是已经被项目实测验证过：

- 自动检测 COM 口后读取一次亮度
- framebuffer 灰阶 60~128 连续扫描
- 亮度曲线单调递增，结果与画面变化一致

因此对当前 Big8K 使用场景来说，这套字段解释是可直接使用的。

---

## 7. Python 直接串口通信示例

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

init_cmds = [
    'SCS,0\r',
    'SCS,4,60.00\r',
    'FSC,1\r',
    'MMS,0\r',
    'MDS,0\r',
    'FMS,0\r',
    'MCH,0\r',
    'LUS,1\r',
]

for cmd in init_cmds:
    ser.write(cmd.encode())
    time.sleep(0.2)
    _ = ser.readline()

ser.write('ZRC\r'.encode())
for _ in range(10):
    time.sleep(1)
    if ser.in_waiting > 0:
        resp = ser.readline().decode('utf-8', errors='replace').strip()
        if 'OK00' in resp:
            break

if ser.in_waiting > 0:
    ser.read(ser.in_waiting)

ser.write('MES,1\r'.encode())
time.sleep(0.1)
raw = ser.readline().decode('utf-8', errors='replace').strip()
arr = raw.split(',')

lv = float(arr[5])
cx = float(arr[3])
cy = float(arr[4])

print(lv, cx, cy)
ser.close()
```

---

## 8. PowerShell / 自动检测脚本约定

当前项目工作区已有脚本：

```text
C:\Users\hufz\.qclaw\workspace\detect_ca410_com_and_measure.ps1
```

它已经实现：

1. 自动枚举当前所有 COM 口
2. 自动检测哪个 COM 口能响应 410 握手命令
3. 自动完成初始化与一次亮度读取
4. 输出 JSON

因此对 Big8K 日常使用者来说，推荐使用方式是：

```powershell
.\detect_ca410_com_and_measure.ps1
```

而不是每次手工找 COM 口。

---

## 9. 测量速度模式（与 SDK 对齐）

这一部分来自 `ca-sdk2_en-US.pdf`，用于把项目里 `FSC` 命令和官方 SDK 语义对齐。

| 模式 | 命令 | SDK值 | 说明 |
|---|---|---:|---|
| SLOW | `FSC,0` | 0 | 更慢、更稳 |
| FAST | `FSC,1` | 1 | 更快，当前项目常用 |
| LTD.AUTO | `FSC,2` | 2 | 自动模式限制版 |
| AUTO | `FSC,3` | 3 | 自动在速度与稳定性之间折中 |
| ORG.AUTO | `FSC,4` | 4 | 仅部分新型号支持 |

### 9.1 对项目的建议

- **单点快速测量**：`FAST`
- **连续灰阶曲线扫描**：可优先 `FAST`，低灰不稳时再考虑 `AUTO`
- **精度优先**：`SLOW` 或 `AUTO`

---

## 10. 同步模式（与 SDK 对齐）

| 模式 | 命令 | SDK值 | 说明 |
|---|---|---:|---|
| NTSC | `SCS,0` | 0 | 标准同步模式之一 |
| PAL | `SCS,1` | 1 | 标准同步模式之一 |
| EXTERNAL | `SCS,2` | 2 | 外部同步 |
| UNIVERSAL | `SCS,3` | 3 | 通用模式 |
| INTERNAL | `SCS,4,<freq>` | 4 | 指定频率，例如 60.00 |
| MANUAL | `SCS,5,<ms>` | 5 | 手动指定积分时间 |

### 10.1 对项目的建议

对于已知刷新率的 Big8K 屏幕测量，优先用：

```text
SCS,4,60.00
```

也就是 **INTERNAL + 指定频率**。

这是当前项目里最稳定、最符合实际使用的配置。

### 10.2 与 SDK 的一个重要一致点

SDK 文档明确写到：

> 当同步模式设为 EXTERNAL 时，触发测量场景下会按 UNIVERSAL 执行。

这意味着：

- EXTERNAL 不适合在当前 Big8K 项目里当作默认首选模式
- 对我们现有“PC 直接发命令 + 屏幕固定刷新率”的场景，INTERNAL 更合适

---

## 11. AutoConnect / SDK 路径和直接串口路径的关系

### 11.1 SDK 能做什么

`ca-sdk2_en-US.pdf` 里，SDK 的 `AutoConnect()` 可以：

- 当系统里只有一个可用 CA-410 设备时自动配置连接
- 创建 `Ca` / `Probe` 对象
- 后续通过 SDK API 调用测量

### 11.2 当前项目为什么仍推荐直接串口

因为当前项目需求更偏：

- 快速落地
- 易调试
- 易和 PowerShell / Python / Tauri 集成
- 已有稳定实测路径

因此当前项目里更推荐：

> **直接串口协议作为主路径；SDK 作为标准定义和高级能力参考。**

### 11.3 什么情况下考虑 SDK DLL

如果后面需要这些能力，可以再转向 SDK：

- 多设备统一管理
- 更复杂的 Probe / Ca 对象管理
- 频率检测原生 API
- 更高层的对象化接口

---

## 12. 频率与波特率的标准核对结论

结合 `ca-sdk2_en-US.pdf` 和当前项目实测，可确认：

### 12.1 波特率

- **CA-VP410 探头支持到 921600**
- 当前项目实测使用 921600 正常
- 这一点和 SDK 手册一致

### 12.2 连接识别

SDK 文档中的 `AutoConnect()`、`get_PortID()`、`GetConnectionAddress()` 表明：

- Windows 下 USB / RS-232C 都可能以 `COMx` 形式出现
- 从项目使用角度，应把“USB 虚拟串口”理解为当前落地通信通道

### 12.3 型号支持

SDK 文档中出现并支持：

- `CA-VP410`
- `CA-VP410A`
- `CA-VP427A`
- `CA-VP427C`
- `CA-DP40`

因此本项目把“410”约定为 `CA-VP410` 是合理的，但文档中仍需保留“变体型号可能存在差异”的提醒。

---

## 13. 已知注意事项

1. **COM 口编号会变**  
   插拔后 COM 口可能变化，因此建议总是先自动检测。

2. **不要把停止位写错**  
   当前正确值是 `1.5`，不是 `2`。

3. **低亮度下建议更保守**  
   低亮度时波动可能更大，可考虑 AUTO / SLOW 或多次平均。

4. **测量前清缓冲区**  
   避免上一条返回残留影响当前解析。

5. **零校准要正确执行**  
   否则低亮测量可能不稳定。

6. **项目里提到 410 时默认就是 CA-VP410**  
   除非文档里明确写了 CA-DP40 或其他变体型号。

7. **当前项目语境里只采用 USB 连接**  
   Windows 下通常表现为虚拟串口 / COM 口；接到 8K平台 后，同样按串口设备通信。

---

## 14. 对 Big8K-Tauri-UI 的直接建议

### 14.1 主路径建议

Big8K-Tauri-UI 如果继续接入 410，优先推荐：

```text
自动检测 COM 口 → 串口初始化 → MES,1 读取 → 解析 x/y/Lv
```

### 14.2 与显示控制联动的推荐流程

```text
8K平台 显示指定画面 → 等待稳定 → 读取 CA-VP410 → 记录结果
```

### 14.3 做灰阶曲线时的建议

```text
framebuffer 写灰阶 → 每级等待稳定 → 读取 Lv/x/y → 导出 CSV / Excel → 做 gamma 分析
```

### 14.4 文档口径建议

后续项目文档里如果出现：

- 410
- ca410
- CA410

默认都应解释为：

> **CA-VP410 探头**

并且当前项目里统一按：

> **USB 连接 + 串口协议通信**

来理解。Windows 下通常是 COM 口；如果设备接到 8K平台，则在 8K平台 下同样按串口通信。

---

## 15. 本文档的最终结论

一句话总结：

> 在 Big8K 项目里，后续提到的 410 / CA410 默认都指 CA-VP410；用户日常对话里也会把它简称为 410。当前项目统一只采用 **USB 连接**，在 Windows 下通常表现为 **虚拟串口 / COM 口**；如果把 410 接到 8K平台，那么在 8K平台 下同样可以通过串口与其通信。其关键通信参数为 **921600 / Even / 7bit / 1.5 stop / `\r`**，测量主命令为 `MES,1`，返回中 **parts[3]=x, parts[4]=y, parts[5]=Lv**。这些结论已经和 `ca-sdk2_en-US.pdf` 的关键标准信息做过交叉核对，可以作为当前项目统一口径。

---

## 16. 资料来源

- `E:\ai2026\Big8K-Tauri-UI\docs\ca410-brightness-meter-protocol.md`
- `E:\ai2026\Big8K-Tauri-UI\docs\ca410_protocol.md`
- `E:\ai2026\Big8K-Tauri-UI\docs\ca-sdk2_en-US.pdf`
- `E:\Resource\8Big8K\8K_software\python-c453\DW_C35\CA4xx.py`
- `C:\Users\hufz\.qclaw\workspace\detect_ca410_com_and_measure.ps1`
