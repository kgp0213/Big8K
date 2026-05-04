# MIPI 调试规则速查

更新时间：2026-05-04

本文件是 `code-format-concepts.md` 的现场速查版。

## 1. 左右编辑器

- 左侧：格式化代码区，用于 `vismpwr` 检查、OLED config 生成和下载。
- 右侧：原始代码 / 标准代码草稿区，用于清洗、标准化和人工编辑。

## 2. 左侧严格错误

- `DT` 不在 `05 / 29 / 39 / 0A` 内。
- `LEN` 与 payload 数量不一致。
- `DT=05` 且 `LEN != 01`。
- `DT=0A` 且 `LEN < 01`。
- 出现显式 `DELAY` / `DELAYMS` 文本。

## 3. 左侧 warning

- `DT=29` 且 `LEN=01`。
- `DT=39` 且 `LEN=01`。

这两类不直接拦截，但必须提醒人工确认。

## 4. 右侧 warning 条件

右侧只有在一行完整满足 `DT DELAY LEN DATA...` 条件时，才提示“疑似格式化代码样式输入”。

不要只凭开头字段或字段数量报警。

## 5. OLED 下载前检查

1. 先检查左侧格式化代码。
2. warning 放行。
3. error 中止。
4. `DSC Enable = true` 时必须存在 `DT=0A`。

## 6. 最近配置列表

保存最近配置时必须先读 `localStorage`，再和内存状态合并去重，最后按 `lastUsedAt` 排序截断。不要只基于 React state 保存，否则重启后的第一次保存可能覆盖历史列表。

## 7. JSON 导出

导出 OLED JSON 用于 review、共享和版本比较。建议直接保存 `TimingBinRequest` 对应结构。`vis-timing.bin` 是实际二进制产物，不需要在 JSON 导出时额外复制一份。

