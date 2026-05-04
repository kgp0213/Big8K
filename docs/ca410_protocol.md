# CA-VP410 接入说明

更新时间：2026-05-04  
原始参考：`ca-sdk2_en-US.pdf`

本文是 Big8K 项目对 CA-VP410 的统一口径。后续文档里提到 `410`、`CA410`、`ca410`，默认都指 **Konica Minolta CA-VP410 探头**，不是 CA-DP40 数据处理器。

## 1. 命名约定

| 写法 | 本项目含义 |
|---|---|
| `410` | CA-VP410 |
| `CA410` | CA-VP410 |
| `ca410` | CA-VP410 |
| `CA-DP40` | 数据处理器，必须写全名 |
| `CA-VP410A` / `CA-VP427A` / `CA-VP427C` | 其他变体，必须写全名 |

如果没有额外说明，项目里所有 “410” 都按 CA-VP410 探头处理。

## 2. 当前连接方式

当前 Big8K 项目只采用：

```text
USB -> 虚拟串口 / COM 口 -> 串口协议
```

Windows 侧典型表现：

```text
COM14
COM201
```

如果 CA-VP410 接到 8K 平台，它在板端也应按串口设备理解。协议本质不变，只是串口所在主机从 Windows PC 变成 8K 平台。

## 3. 官方能力和项目取舍

CA-SDK2 官方体系中，CA-410 家族涉及 USB、RS-232C、Ethernet、Bluetooth 等连接能力。但本项目当前不把 Ethernet / Bluetooth 当作 CA-VP410 的主路径。

项目推荐直接串口协议，而不是先接 SDK DLL，原因是：

- 轻量。
- 易调试。
- 易接入 Python / PowerShell / Rust。
- 已通过项目脚本和灰阶扫描验证。

SDK 仍作为标准定义和高级能力参考。

## 4. 串口参数

| 参数 | 值 |
|---|---|
| 波特率 | `921600` |
| 校验位 | Even |
| 数据位 | 7 |
| 停止位 | 1.5 |
| 握手 | None |
| 超时 | 约 0.5s |
| 命令结束符 | `\r` |

最容易错的是把参数写成 8N1。当前正确组合是：

```text
921600 / Even / 7bit / 1.5 stop / CR
```

`ca-sdk2_en-US.pdf` 中的关键信息：CA-410 probe 支持到 921600，CA-410 data processor 最高到 230400。因此本项目对 CA-VP410 使用 921600 与官方手册口径一致。

## 5. 初始化序列

当前项目验证过的初始化命令：

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

含义：

| 命令 | 含义 |
|---|---|
| `SCS,0` | 同步源设置 |
| `SCS,4,60.00` | INTERNAL，同步频率 60Hz |
| `FSC,1` | FAST 测量速度 |
| `MMS,0` | 控制模式 |
| `MDS,0` | 显示 LV,x,y |
| `FMS,0` | 闪烁方式 |
| `MCH,0` | CH0 |
| `LUS,1` | 亮度单位 cd/m² |
| `ZRC` | 零校准 |

每条命令期望返回 `OK00`。`ZRC` 需要合适遮光条件，耗时可能为几秒到十几秒。

## 6. 测量命令

发送：

```text
MES,1
```

项目当前按以下返回解析：

```text
OK00,P1,0,Cx,Cy,Lv,...
```

字段：

| 字段 | 含义 |
|---|---|
| `parts[3]` | x |
| `parts[4]` | y |
| `parts[5]` | Lv，单位 cd/m² |

示例：

```text
OK00,P1,0,0.3362781,0.3559744,12.563168,-0.01,-99999999
```

解析：

```text
x = 0.3362781
y = 0.3559744
Lv = 12.563168 cd/m²
```

## 7. Python 串口最小示例

```python
import serial
import time

ser = serial.Serial(
    port="COM14",
    baudrate=921600,
    parity=serial.PARITY_EVEN,
    bytesize=serial.SEVENBITS,
    stopbits=serial.STOPBITS_ONE_POINT_FIVE,
    timeout=0.5,
)

for cmd in ["SCS,0\r", "SCS,4,60.00\r", "FSC,1\r", "MMS,0\r", "MDS,0\r", "FMS,0\r", "MCH,0\r", "LUS,1\r"]:
    ser.write(cmd.encode())
    time.sleep(0.2)
    print(ser.readline().decode(errors="replace").strip())

ser.write("MES,1\r".encode())
time.sleep(0.1)
parts = ser.readline().decode(errors="replace").strip().split(",")
print(float(parts[5]), float(parts[3]), float(parts[4]))
ser.close()
```

零校准示例中可以加入 `ZRC\r`，但应确保探头遮光。

## 8. 测量速度

| 模式 | 命令 | 建议 |
|---|---|---|
| SLOW | `FSC,0` | 精度优先 |
| FAST | `FSC,1` | 当前默认 |
| LTD.AUTO | `FSC,2` | 特定场景 |
| AUTO | `FSC,3` | 低亮不稳时考虑 |
| ORG.AUTO | `FSC,4` | 部分新型号 |

灰阶曲线扫描建议先用 FAST；低亮波动大时再切 AUTO / SLOW 或做多次平均。

## 9. 同步模式

| 模式 | 命令 |
|---|---|
| NTSC | `SCS,0` |
| PAL | `SCS,1` |
| EXTERNAL | `SCS,2` |
| UNIVERSAL | `SCS,3` |
| INTERNAL | `SCS,4,<freq>` |
| MANUAL | `SCS,5,<ms>` |

当前 Big8K 推荐：

```text
SCS,4,60.00
```

## 10. Big8K 集成建议

PC 侧流程：

```text
自动检测 COM 口 -> 串口初始化 -> MES,1 -> 解析 x/y/Lv
```

与显示联动：

```text
8K 平台显示指定灰阶/图案 -> 等待稳定 -> CA-VP410 测量 -> 记录 CSV
```

后续接入 Tauri 时建议：

- 自动枚举 COM。
- 显示当前串口参数。
- 初始化命令和测量命令可查看日志。
- 支持低亮多次平均。
- 灰阶扫描结果可导出 CSV。

## 11. 注意事项

- COM 口编号会变化，建议自动检测。
- 停止位必须是 1.5。
- 测量前清空串口缓冲。
- 零校准需要遮光。
- 低亮测量可能需要更慢模式或多次平均。
- SDK 路径只作为后续高级能力备选。

