# Big8K 文档总入口

本目录已经在 2026-05-04 重新阅读并重写。重写原则是：项目叙述归项目叙述，操作流程归操作流程，硬件协议归硬件协议，审查记录归审查记录，原始资料保持原样引用。

## 阅读与重写范围

已完整阅读并纳入本次整理的文本资料：

- `usage-guide.md`
- `pcsw-migration-notes-2026-03-28.md`
- `deployment-page-notes-2026-03-31.md`
- `recent-handoffs-and-notes.md`
- `code-format-concepts.md`
- `mipi-debug-notes.md`
- `ui-improvement-plan.md`
- `code-review-2026-04-30.md`
- `source-review-2026-05-04.md`
- `cleanup-candidates-2026-05-04.md`
- `release-code-review-2026-05-03.md`
- `release-packaging-recommendations-2026-05-03.md`
- `adb-shell-8k-platform-guide.md`
- `ca410_protocol.md`
- `ca410-brightness-meter-protocol.md`
- `ad5272_multi_rail_readme.md`
- `pcsw-feature-scan.csv`
- `ad5272_multi_rail.py`

保留为原始参考、不直接重写正文的资料：

- `ca-sdk2_en-US.pdf`：Konica Minolta CA-SDK2 官方手册，468 页，本地厂商资料。
- `pcsw-feature-scan.csv`：旧 C# PC-SW 扫描结果，1115 条原始命中。
- `ad5272_multi_rail.py`：可执行参考脚本，说明文档另见 `ad5272_multi_rail_readme.md`。

## 推荐阅读顺序

新接手项目时按这个顺序读：

1. `../README.md`：项目前世今生、当前架构、已知缺口。
2. `../AGENTS.md`：后续 Agent / Codex 的项目级工作准则。
3. `usage-guide.md`：当前应用怎么启动、怎么操作、哪些功能已接线。
4. `pcsw-migration-notes-2026-03-28.md`：旧 C# PC-SW 到 Tauri 的迁移边界。
5. `adb-shell-8k-platform-guide.md`：板端 ADB、Framebuffer、OLED、部署路径速查。
6. `source-review-2026-05-04.md`：当前源码风险清单。

## 文档分组

### 项目与使用

- `usage-guide.md`：面向开发者和现场使用者的当前操作指南。
- `recent-handoffs-and-notes.md`：交接入口与历史笔记的去重索引。
- `ui-improvement-plan.md`：UI 后续整理计划，按阶段执行。

### 迁移与部署

- `pcsw-migration-notes-2026-03-28.md`：旧 C# 行为基线、资源目录、部署动作。
- `deployment-page-notes-2026-03-31.md`：配置部署页与 DEMO 区的边界。
- `adb-shell-8k-platform-guide.md`：ADB / Framebuffer / OLED / 电源 / 远端路径参考。
- `pcsw-feature-scan.csv`：旧 C# 功能扫描原始数据。

### MIPI 与代码转换

- `code-format-concepts.md`：左右编辑器、标准代码、格式化代码的统一语义。
- `mipi-debug-notes.md`：MIPI 调试规则和 OLED 下载前置检查。

### 硬件协议

- `ca410_protocol.md`：CA-VP410 当前统一接入口径。
- `ca410-brightness-meter-protocol.md`：CA410 简版速查，主文档指向 `ca410_protocol.md`。
- `ca-sdk2_en-US.pdf`：CA-SDK2 官方手册。
- `ad5272_multi_rail_readme.md`：AD5272 / INA226 多路调压说明。
- `ad5272_multi_rail.py`：AD5272 调压脚本参考实现。

### 审查与发布

- `source-review-2026-05-04.md`：源码风险审查。
- `code-review-2026-04-30.md`：早期代码质量审查，已改写为专业语气。
- `release-code-review-2026-05-03.md`：release 产物审查。
- `release-packaging-recommendations-2026-05-03.md`：发布打包建议。
- `cleanup-candidates-2026-05-04.md`：目录清理记录和保留候选。

## 维护规则

- 新增文档必须更新本索引。
- 日期型审查文档保留日期，不覆盖历史事实。
- 重复内容优先合并到主文档，简版文档只保留入口和速查。
- 厂商 PDF、CSV、可执行脚本属于原始资料，不为了“整齐”改写其内容。
- 文档中涉及板端重启、initrd、`rm`、`killall`、50-TP 写入等高影响操作时，必须明确标注风险。

