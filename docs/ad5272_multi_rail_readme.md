# AD5272 多路调压脚本说明

本文档整理 `ad5272_multi_rail.py` 的用途、已知映射、关键实现逻辑、使用方式，以及关于 INA226 电流单位的说明。

---

## 1. 文件位置

- 脚本副本：`E:\ai2026\Big8K-Tauri-UI\docs\ad5272_multi_rail.py`
- 当前说明：`E:\ai2026\Big8K-Tauri-UI\docs\ad5272_multi_rail_readme.md`

---

## 2. 脚本用途

`ad5272_multi_rail.py` 是一个运行在 **PC 侧** 的 Python 脚本，通过：

- `adb shell`
- 目标板上的 `i2ctransfer`
- 目标板上的 `i2cdetect`

去控制目标设备上的 AD5272 数字电位器，并配合 INA226 读取各路电压/电流。

目前脚本主要支持：

1. 设置三路可调电压：
   - `VCI`
   - `VDDIO`
   - `DVDD`
2. 将当前 RDAC 值写入 AD5272 的 50-TP
3. 读取多路电源监测值
4. 输出较完整的原始寄存器回读信息，便于调试

---

## 3. 已整理的地址映射

### 3.1 AD5272 与调压路由

- `VCI   -> AD5272 @ 0x2F`
- `VDDIO -> AD5272 @ 0x2C`
- `DVDD  -> AD5272 @ 0x2E`

### 3.2 INA226 / 监测地址

- `VCI   -> INA226 @ 0x41`
- `VDDIO -> INA226 @ 0x45`
- `DVDD  -> INA226 @ 0x48`
- `ELVDD -> INA226 @ 0x40`
- `ELVSS -> INA226 @ 0x46`
- `AVDD  -> INA226 @ 0x44`
- `VGL   -> INA226 @ 0x4A`
- `VGLI  -> 0x4F`（脚本按用户给定公式推算电流）

默认 I2C bus 为：

- `BUS = 4`

---

## 4. 脚本的核心设计

### 4.1 AD5272 普通写 RDAC

脚本中普通更新 RDAC 的流程为：

1. 发送控制命令 `0x1C 0x02`
   - 作用：允许 RDAC / wiper 更新
2. 再发送 10-bit RDAC 写命令

对应实现：

```python
def write_rdac(bus_no: int, dev_addr: int, code: int) -> tuple[int, int]:
    code = max(0, min(STEPS - 1, int(code)))
    cmd = 0x04 | ((code >> 8) & 0x03)
    data = code & 0xFF

    write_control(bus_no, dev_addr, 0x02)
    adb_shell(f"i2ctransfer -f -y -a {bus_no} w2@0x{dev_addr:02x} 0x{cmd:02x} 0x{data:02x}")
    time.sleep(0.25)
    return cmd, data
```

---

### 4.2 AD5272 保存到 50-TP

脚本采用的 50-TP 存储流程：

1. `0x1C 0x03`
   - 打开 RDAC update + 50-TP program enable
2. `0x0C 0x00`
   - 将当前 RDAC 保存到 50-TP
3. 延时等待编程完成
4. `0x1C 0x02`
   - 回到普通可写状态

对应实现：

```python
def save_to_50tp(bus_no: int, dev_addr: int) -> None:
    write_control(bus_no, dev_addr, 0x03)
    adb_shell(f"i2ctransfer -f -y -a {bus_no} w2@0x{dev_addr:02x} 0x0c 0x00")
    time.sleep(T_MEMORY_PROGRAM_S)
    write_control(bus_no, dev_addr, 0x02)
```

其中：

- `T_MEMORY_PROGRAM_S = 0.40`

这部分设计目标是让流程更接近 datasheet 推荐时序，并在保存后自动退回普通工作状态。

---

### 4.3 AD5272 控制寄存器回读

脚本包含读取控制寄存器并解码的实现，用于确认保存后状态：

- `prepare_read_control_register()`
- `nop_read_16()`
- `read_control_register()`
- `decode_control_register()`

解码出的关键 bit 包括：

- `C0_50TP_PROGRAM_ENABLE`
- `C1_RDAC_WRITE_ENABLE`
- `C2_RPERF_DISABLE`
- `C3_50TP_PROGRAM_SUCCESS`

这个设计适合调试“50-TP 是否写成功”。

---

## 5. 电压目标值如何换算成 RDAC code

三路调压都复用了同一套计算逻辑：

```python
def calc_code(vout: float, cfg: RailConfig) -> int:
    if not (cfg.vmin <= vout <= cfg.vmax):
        raise ValueError(...)

    rp_tgt = cfg.r1 / ((vout / cfg.vref) - 1) - cfg.r3
    ...
    r_pot_tgt = 1.0 / den
    code = round(r_pot_tgt / cfg.r_ab * (STEPS - 1))
    return max(0, min(STEPS - 1, code))
```

也就是说，脚本不是“硬编码某几个 code”，而是根据各 rail 的：

- `vref`
- `r1`
- `r2`
- `r3`
- `r_ab`
- 允许输出范围 `vmin ~ vmax`

动态算出 AD5272 的目标码值。

这是比较干净的做法，后续如果硬件阻值确认后有变化，只需更新配置参数即可。

---

## 6. INA226 读取逻辑说明

### 6.1 电压读取

脚本使用 INA226 的 bus voltage register（寄存器 `0x02`）：

```python
def ina226_read_voltage(bus_no: int, addr: int) -> tuple[float, int, str]:
    raw, raw_text = read_reg(bus_no, addr, 0x02)
    return raw * 1.25e-3, raw, raw_text
```

这里单位是：

- `1.25 mV / LSB`
- 返回值单位：`V`

所以这一段语义是清晰的。

---

### 6.2 电流读取

脚本当前实现为：

```python
def ina226_read_current_ma(bus_no: int, addr: int, rsense: float = 0.2) -> tuple[float, int, int, str]:
    raw, raw_text = read_reg(bus_no, addr, 0x01)
    signed = raw - 0x10000 if raw & 0x8000 else raw
    current_a = (signed * 2.5e-6) / rsense
    return current_a * 1000.0, raw, signed, raw_text
```

这里的含义是：

1. `0x01` 为 shunt voltage register
2. LSB 按 `2.5 µV/LSB` 处理
3. 先算出电流单位 `A`
4. 最终返回 `mA`

也就是：

- 中间变量 `current_a` 的单位是 `A`
- 函数返回值单位是 `mA`

这是一个**单位自洽**的实现。

---

## 7. 关于“2.5e-3 / 2.5e-6”的澄清

前面讨论里，容易混淆的核心点是：

- 若函数返回单位是 `A`，则常数应直接写成 `2.5e-6`
- 若函数想直接返回 `mA`，则也可以把 `×1000` 合并进公式，写成 `2.5e-3`

例如这两种写法本质等价：

### 写法 A：先算 A，再转 mA

```python
current_a = (signed * 2.5e-6) / rsense
current_ma = current_a * 1000
```

### 写法 B：直接得到 mA

```python
current_ma = (signed * 2.5e-3) / rsense
```

二者在数值上等价。

因此，问题不在于“`2.5e-3` 一定错”，而在于：

- 变量名是否还叫 `vshunt`
- 注释是否仍写成“`2.5 µV/LSB`，单位 V”
- 最终函数返回值到底标注为 `A` 还是 `mA`

如果注释、变量名、返回单位三者没统一，就会非常容易误判。

### 当前脚本采用的是更清晰的版本

当前整理后的脚本，选择的是：

- 使用 `2.5e-6` 表达 **2.5 µV/LSB**
- 中间量先按 `A` 计算
- 返回值明确转成 `mA`

好处是：

1. 更贴近 datasheet 原始单位
2. 读代码时不容易误会
3. 打印输出和函数命名 `ina226_read_current_ma()` 一致

---

## 8. 特殊监测项说明

### 8.1 负压显示

脚本对 `ELVSS`、`VGL` 做了负压显示处理：

```python
shown_v = -v if cfg.negative_voltage else v
```

因此：

- 寄存器本身按正电压幅值读取
- 显示层再转成负号

这适合用户从“电源轨语义”角度去看数据。

---

### 8.2 VGLI 的电流推算

`VGLI` 不是直接按 `rsense` 算电流，而是按用户指定公式：

```python
vgli_ma = 1000.0 * (vi - vddio_pos / 2.0) / 50.0 / 0.2
```

脚本中同时保留了：

- `formula`
- `vddio_reference_v`

这有利于后续核对公式是否符合实际硬件链路。

---

## 9. 命令行用法

### 9.1 查看帮助

```bash
python ad5272_multi_rail.py -h
```

### 9.2 扫描 I2C

```bash
python ad5272_multi_rail.py --detect
```

### 9.3 设置三路示例值

```bash
python ad5272_multi_rail.py --demo
```

默认示例值为：

- `VCI=3.35`
- `VDDIO=1.85`
- `DVDD=1.10`

---

### 9.4 单独设置某一路

```bash
python ad5272_multi_rail.py --vci 3.35
python ad5272_multi_rail.py --vddio 1.85
python ad5272_multi_rail.py --dvdd 1.10
```

也可以一次设置多路：

```bash
python ad5272_multi_rail.py --vci 3.35 --vddio 1.85 --dvdd 1.10
```

---

### 9.5 保存当前 RDAC 到 50-TP

```bash
python ad5272_multi_rail.py --save-vci
python ad5272_multi_rail.py --save-vddio
python ad5272_multi_rail.py --save-dvdd
```

---

### 9.6 读取全部监测项

```bash
python ad5272_multi_rail.py --read-all
```

---

## 10. 输出格式说明

设置电压后的典型输出格式类似：

```text
VCI: target=3.350 V, code=xxx (0xXXX)
  Vraw=... -> 0x.... -> 3.3xxxxx V
  Iraw=... -> 0x.... signed=... -> xx.xxxxxx mA
```

说明：

- `target`：目标电压
- `code`：计算得到的 AD5272 RDAC code
- `Vraw`：从 INA226 读到的原始电压寄存器结果
- `Iraw`：从 INA226 读到的原始电流寄存器结果
- 电流单位当前统一输出为：`mA`

---

## 11. 依赖条件

脚本运行前提：

### PC 侧

- 已安装 `python3`
- 已安装 `adb`
- `adb shell` 可正常访问目标设备

### 目标设备侧

- 存在 `i2ctransfer`
- 存在 `i2cdetect`
- 具备 I2C 总线访问权限

---

## 12. 已知边界与注意事项

1. `save_to_50tp` 会消耗 AD5272 的 50-TP 次数
   - 不建议频繁执行
2. 电压换算依赖 `RailConfig` 中的阻值参数准确性
   - 若原理图/BOM 与当前值不一致，需要同步更新
3. `ELVSS / VGL` 当前是“显示为负值”，并非读取 signed voltage register
4. `VGLI` 电流为经验公式计算结果
   - 如果后续确认 INA282 或前级电阻网络模型不同，应更新公式
5. 脚本默认总线号为 `4`
   - 若平台 I2C bus 变化，需要通过 `--bus` 指定

---

## 13. 建议的后续改进

如果后续要把它进一步工程化，建议加这几项：

1. 增加 `--json` 输出
   - 方便 UI 或 Tauri 后端直接解析
2. 增加 `--read <rail>`
   - 支持只读单路监测
3. 增加“写入前后自动比对”
   - 判断目标值和回读值误差
4. 将 rail 参数抽到独立配置文件
   - 便于不同板型复用
5. 对 `save_to_50tp` 增加二次确认参数
   - 例如 `--force-save`

---

## 14. 简短结论

这份 `ad5272_multi_rail.py` 的核心价值在于：

- 把三路 AD5272 调压统一到一个脚本里
- 把 INA226 回读也一起串起来
- 保留了较完整的原始寄存器输出，便于现场调试
- 对 AD5272 的普通写入和 50-TP 保存做了相对清晰的封装

其中关于 INA226 电流换算，当前脚本版本采用的是：

- 先按 `2.5 µV/LSB` 算出 `A`
- 再转换为 `mA`

这一版在单位语义上是清晰的，后续维护时不容易再引发“到底返回 A 还是 mA”的歧义。
