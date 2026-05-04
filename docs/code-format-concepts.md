# MIPI 代码格式统一说明

更新时间：2026-05-04

本文定义 `Driver IC 初始化代码` 区域的左右编辑器、检查按钮、转换按钮和 `vismpwr` 下发格式。它是 UI 文案和实现命名的统一依据。

## 1. 四个概念

原始代码：用户直接粘贴的内容，可能有注释、空格、`0x`、`REGWxx`、`delay`、历史格式和多余分隔符。原始代码不能直接保证可下发。

清洗后代码：去掉注释和无意义符号、统一大小写和分隔符后的中间结果。清洗后仍不等于最终格式。

标准代码：右侧草稿区推荐保存的统一表达，允许 `REGW05`、`REGW29`、`REGW39`、`REGW0A`、裸十六进制数据和 `delay`。

格式化代码：左侧最终使用形态，必须符合 `vismpwr` 写命令格式，可用于检查、下发和 OLED config 生成。

## 2. 左侧：格式化代码区

左侧每行按以下格式理解：

```text
DT DELAY LEN DATA...
```

字段含义：

| 字段 | 含义 |
|---|---|
| `DT` | 数据类型，当前允许 `05 / 29 / 39 / 0A` |
| `DELAY` | 延时字节，十六进制 |
| `LEN` | payload 字节数 |
| `DATA...` | payload 内容 |

左侧 `vismpwr检查` 必须校验：

- 每个字段是 1 或 2 位十六进制字节。
- `LEN` 与 payload 数量完全一致。
- `DT=05` 时 `LEN=01`。
- `DT=0A` 时 `LEN>=01`。
- `DT=29` 或 `DT=39` 且 `LEN=01` 时只给 warning，不直接拦截。
- 左侧不能出现显式 `delay` / `delayms` 文本。

## 3. 右侧：原始代码 / 标准代码草稿区

右侧用于粘贴、清洗、人工编辑和标准化。

右侧可接受：

- `delay N`
- `delayms N`
- `REGW05 ...`
- `REGW29 ...`
- `REGW39 ...`
- `REGW0A ...`
- 裸十六进制数据行
- 已经符合左侧格式的 `05|29|39|0A 00 LEN ...`

右侧 `可转换性检查` 的目标不是判断“能不能直接下发”，而是判断“能否安全转换为标准代码”。

只有当某一行严格满足左侧 `DT DELAY LEN DATA...` 条件时，才提示“疑似格式化代码样式输入”。不能只因为开头是 `05`、`29`、`39`、`0A` 就报警。

## 4. 转换规则

右侧标准代码转左侧格式化代码：

| 右侧写法 | 左侧结果 |
|---|---|
| `REGW05 29` | `05 00 01 29` |
| `REGW29 AA BB` | `29 00 02 AA BB` |
| `REGW39 F0 5A 5A` | `39 00 03 F0 5A 5A` |
| `REGW0A 12 34` | `0A 00 02 12 34` |
| `F0 5A 5A` | `39 00 03 F0 5A 5A` |

`delay` 折叠进上一条命令的 `DELAY` 字段：

```text
REGW05 11
DELAY 78
```

转换为：

```text
05 4E 01 11
```

左侧格式化代码还原右侧标准代码：

| 左侧写法 | 右侧结果 |
|---|---|
| `39 00 LEN DATA...` | `DATA...` |
| `05 00 LEN DATA...` | `REGW05 DATA...` |
| `29 00 LEN DATA...` | `REGW29 DATA...` |
| `0A 00 LEN DATA...` | `REGW0A DATA...` |
| `DELAY != 00` | 在当前命令后追加 `DELAY N` |

## 5. `vismpwr` 真实能力

`vismpwr` 写模式使用：

```bash
vismpwr [-0|-1] DT DELAY LEN DATA...
```

设备选择参数：

- `-0`：`/dev/mipi_dsi0`
- `-1`：`/dev/mipi_dsi1`

读模式使用：

```bash
vismpwr -r [-0|-1] read_len read_reg
```

示例：

```bash
vismpwr -r 01 0A
```

`vismpwr` 本身不认识 `REGWxx`、`delay`、`delayms`，这些都是 UI 层上层语义。

## 6. OLED 下载前置规则

点击 OLED 配置下载或导出 JSON 前：

- 先执行左侧格式化代码检查。
- warning 不拦截。
- error 必须中止。
- 如果 `DSC Enable = true`，初始化代码里必须至少有一行 `DT=0A`。
- `vis-timing.bin` 仍按生成逻辑落在程序目录；JSON 用于 review 和版本比较。

## 7. UI 文案

| 控件 | 文案 | 语义 |
|---|---|---|
| 左侧检查 | `vismpwr检查` | 检查格式化代码能否用于下发/生成 |
| 右侧检查 | `可转换性检查` | 检查草稿能否转换 |
| 右侧原地转换 | `标准化转换` | 清洗并回填标准代码 |
| 顶部下发 | `代码下发` | 从右侧内容转换为 vismpwr 命令后下发 |

## 8. 实现命名建议

- `handleVismpwrCheckAction`
- `handleRightConvertibilityCheckAction`
- `handleNormalizeToStandardAction`
- `handleFormattedToStandardAction`
- `handleStandardToFormattedAction`
- `handleSendRightEditorAction`

