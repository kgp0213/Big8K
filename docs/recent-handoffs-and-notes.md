# Big8K-Tauri-UI 近期交接与说明索引

> 目的：把工作区 memory 里的 handoff 和项目 docs 里的近期说明收拢成一个入口，后续继续开发时不用到处翻。

---

## 1. 工作区 memory（会话交接）

### `C:\Users\hufz\.qclaw\workspace\memory\handoff-2026-03-27-big8k-tauri-ui.md`
适用场景：
- 恢复 2026-03-27 那一轮关于 Big8K-Tauri-UI 的上下文
- 包含 MIPI / DebugTab / timing bin / 配置部署早期迁移记录

重点内容：
- 主导航与命令调试页重构
- `codeFormatter.ts` 共享链路
- `generate_timing_bin` 的结构整理
- 旧 C# `GenerateBinFile` 的关键字段映射

### `C:\Users\hufz\.qclaw\workspace\memory\2026-03-27.md`
适用场景：
- 回看当天的原始过程笔记
- 查为什么当时做了某个 UI / 结构选择

重点内容：
- DataSwap / 启用DSC 调整
- timing bin 结构确认
- 浏览器预览与开发流程问题

---

## 2. 项目 docs（工程内说明）

### `docs/pcsw-migration-notes-2026-03-28.md`
适用场景：
- 继续推进“配置部署 / 开发工具箱”页迁移
- 查 2026-03-28 那轮对旧 C# 工具箱能力的拆分

重点内容：
- 开发工具箱页的迁移思路
- 静态 IP 设置对应旧 C# 的映射
- 后续文件/脚本/自启动功能优先级

### `docs/deployment-page-notes-2026-03-31.md`
适用场景：
- 继续整理“配置部署”页 / FramebufferTab DEMO 区
- 避免重复踩这两天已经踩过的坑

重点内容：
- 浏览器 / exe 不一致的根因
- `tauri dev` 容易被 SIGKILL
- 资源路径已迁移到 `resources/deploy/...`
- `default_movie/autorun.py` 曾放错版本
- “视频播放”按钮和视频工作区耦合问题
- C# `btn_graphical_target_Click` / `ADB_AutorunApp_Setup(...)` 基线

### `docs/code-format-concepts.md`
适用场景：
- 继续整理标准代码 / 格式化代码 / 发送链路

### `docs/mipi-debug-notes.md`
适用场景：
- 回看 MIPI / DebugTab 相关特殊规则与说明

---

## 3. 当前建议阅读顺序

如果继续做 **配置部署 / DEMO 区 / 部署动作对齐**：
1. `docs/deployment-page-notes-2026-03-31.md`
2. `docs/pcsw-migration-notes-2026-03-28.md`
3. `memory/handoff-2026-03-27-big8k-tauri-ui.md`

如果继续做 **MIPI / timing bin / codeFormatter**：
1. `memory/handoff-2026-03-27-big8k-tauri-ui.md`
2. `docs/code-format-concepts.md`
3. `docs/mipi-debug-notes.md`

---

## 4. 当前代码整理的原则

- 先对齐旧 C# 已验证可用的行为，再考虑优化
- 资源路径统一认 `resources/deploy/...`
- DEMO 独立动作不要和文件工作区状态耦合
- 浏览器预览看结构，exe 预览看最终效果
