# AD5272 / INA226 多路调压说明

更新时间：2026-05-04  
脚本：`docs/ad5272_multi_rail.py`

`ad5272_multi_rail.py` 是 PC 侧 Python 调试脚本，通过 `adb shell` 调用板端 `i2ctransfer` / `i2cdetect`，控制 AD5272 数字电位器，并读取 INA226 监测值。

## 1. 使用场景

脚本用于：

- 设置 `VCI`、`VDDIO`、`DVDD` 三路可调电压。
- 读取 VCI / VDDIO / DVDD / ELVDD / ELVSS / AVDD / VGL / VGLI。
- 将当前 RDAC 保存到 AD5272 50-TP。
- 输出原始寄存器回读，便于现场核对。

高风险提醒：50-TP 写入次数有限，不应频繁执行保存动作。

## 2. 前提条件

PC 侧：

- Python 3。
- ADB 可用。
- `adb shell` 能访问目标设备。

板端：

- `i2ctransfer` 可用。
- `i2cdetect` 可用。
- 有 I2C bus 访问权限。

默认 bus：

```text
I2C bus = 4
```

## 3. AD5272 地址

| 电源轨 | AD5272 地址 |
|---|---:|
| VCI | `0x2F` |
| VDDIO | `0x2C` |
| DVDD | `0x2E` |

## 4. INA226 / 监测地址

| 监测项 | 地址 | 备注 |
|---|---:|---|
| VCI | `0x41` | `rsense=0.2` |
| VDDIO | `0x45` | `rsense=0.2` |
| DVDD | `0x48` | `rsense=0.2` |
| ELVDD | `0x40` | `rsense=0.025` |
| ELVSS | `0x46` | 负压显示 |
| AVDD | `0x44` | `rsense=0.2` |
| VGL | `0x4A` | 负压显示 |
| VGLI | `0x4F` | 用 VDDIO 中点参考公式推算 |

## 5. 命令行

查看帮助：

```bash
python docs/ad5272_multi_rail.py -h
```

扫描 I2C：

```bash
python docs/ad5272_multi_rail.py --detect
```

设置示例值：

```bash
python docs/ad5272_multi_rail.py --demo
```

单独设置：

```bash
python docs/ad5272_multi_rail.py --vci 3.35
python docs/ad5272_multi_rail.py --vddio 1.85
python docs/ad5272_multi_rail.py --dvdd 1.10
```

读取全部监测：

```bash
python docs/ad5272_multi_rail.py --read-all
```

保存到 50-TP：

```bash
python docs/ad5272_multi_rail.py --save-vci
python docs/ad5272_multi_rail.py --save-vddio
python docs/ad5272_multi_rail.py --save-dvdd
```

## 6. AD5272 写入流程

普通 RDAC 更新：

```text
0x1C 0x02 -> 允许 RDAC / wiper 更新
10-bit RDAC 写命令
```

50-TP 保存：

```text
0x1C 0x03 -> 打开 RDAC update + 50-TP program enable
0x0C 0x00 -> 保存当前 RDAC
等待 tMEMORY_PROGRAM
0x1C 0x02 -> 回到普通可写状态
```

脚本中等待时间：

```text
T_MEMORY_PROGRAM_S = 0.40
```

## 7. 电压换算

脚本不是写死 code，而是按每一路配置动态计算：

- `vref`
- `vmin`
- `vmax`
- `r1`
- `r2`
- `r3`
- `r_ab`

如果原理图或 BOM 更新，优先修改 `RailConfig`，不要在命令行层硬改 code。

## 8. INA226 单位

Bus voltage：

```text
register 0x02
1.25 mV / LSB
返回单位：V
```

Shunt voltage：

```text
register 0x01
2.5 uV / LSB
先算 A，再转 mA
```

当前函数 `ina226_read_current_ma()` 返回单位是 `mA`。

`2.5e-6` 与 `2.5e-3` 的区别只是是否把 `x1000` 合并进公式。当前脚本使用 `2.5e-6` 表达原始物理单位，再显式转成 mA，可读性更好。

## 9. 特殊项

ELVSS / VGL：

- 寄存器按正幅值读取。
- 显示层转成负号。

VGLI：

```text
1000 * (vi - vddio / 2) / 50 / 0.2
```

脚本会同时输出公式和 `vddio_reference_v`，方便后续核对硬件模型。

## 10. 后续改进

- 增加 `--json` 输出。
- 增加 `--read <rail>`。
- 写入前后自动误差比对。
- rail 参数移到配置文件。
- 对 50-TP 保存增加 `--force-save` 二次确认。

