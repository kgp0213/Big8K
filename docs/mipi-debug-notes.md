# MIPI 调试小技巧

整理这轮修复里沉淀下来的实用规则，避免下次再踩坑。

## 1. 左右文本框职责

- 左侧：**格式化代码区**
  - 面向 `vismpwr` 检查
  - 面向 OLED config 生成 / 下载
- 右侧：**原始代码 / 标准代码草稿区**
  - 面向清洗、标准化、人工编辑
  - 允许出现看起来像格式化代码的内容，但要人工判断

## 2. 左侧 `vismpwr检查` 的关键规则

左侧每行按 `DT DELAY LEN DATA...` 理解。

### 严格错误

- `DT` 不在 `05 / 29 / 39 / 0A` 之内
- `LEN` 与后续 payload 数量不一致
- `DT=05` 且 `LEN != 01`
- `DT=0A` 且 `LEN < 01`
- 出现显式 `DELAY / DELAYMS` 文本

### 警告但放行

- `DT=29` 且 `LEN=01`
- `DT=39` 且 `LEN=01`

这两种不直接拦截，提示人工确认即可。

## 3. 右侧 `可转换性检查` 的经验规则

右侧主要判断“能否转换为标准代码”，不是拿左侧标准硬卡。

### 什么时候只给 warning

只有当一行**严格符合左侧格式化代码条件**时，才提示：

- 疑似格式化代码样式输入
- 需要人工重点检查

注意：

- 不能只因为开头是 `05` / `29` / `39` / `0A` 就 warning
- 不能只因为字段数 >= 4 就 warning
- 必须同时满足完整 `DT DELAY LEN DATA...` 条件、`LEN` 数量匹配、DT 约束也成立

## 4. 左 -> 右 还原规则

左侧格式化代码回填到右侧时：

- `39 00 LEN DATA...` -> 裸数据 `DATA...`
- `05 00 LEN DATA...` -> `REGW05 DATA...`
- `29 00 LEN DATA...` -> `REGW29 DATA...`
- `0A 00 LEN DATA...` -> `REGW0A DATA...`
- 若 `DELAY != 00`，则拆成下一行 `DELAY N`

## 5. OLED 配置下载前置检查

点击 `OLED 配置下载` 前：

1. 先做左侧格式化代码检查
2. warning 不拦截下载
3. error 才中止下载
4. 若 `DSC Enable = true`，左侧初始化代码里必须存在至少一行 `DT=0A`

## 6. 最近配置列表丢失的原因

这次定位到一个典型问题：

- 保存最近配置时如果只基于 React state 合并
- 而不是每次先读 localStorage
- 重启后第一次保存就可能把旧列表覆盖掉，只剩当前项

正确做法：

- `saveRecentConfig()` 里先读取 `loadRecentConfigs()`
- 再和内存中的 `existing` 合并去重
- 最后按 `lastUsedAt` 排序并截断

## 7. 导出 OLED 配置的建议格式

除了二进制下载，导出 JSON 也很有用：

- 方便 review
- 方便发给别人看
- 方便做版本比较
- 方便后续再转成别的格式

当前导出内容建议直接保存 `TimingBinRequest` 对应 JSON。

另外，`vis-timing.bin` 会由 `generate_timing_bin` 默认落在程序目录：

- JSON 用来看结构和参数
- 程序目录下的 `vis-timing.bin` 用来做实际产物比对
- 因此导出 JSON 时无需再额外复制一份 sidecar bin，避免重复产物
