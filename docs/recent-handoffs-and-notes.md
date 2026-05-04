# 近期交接索引

更新时间：2026-05-04

这个文件不再重复保存长篇过程笔记，只作为“去哪里找上下文”的索引。

## 1. 当前优先入口

继续做项目整体维护：

1. `../README.md`
2. `../AGENTS.md`
3. `docs/README.md`
4. `usage-guide.md`
5. `source-review-2026-05-04.md`

继续做部署页：

1. `pcsw-migration-notes-2026-03-28.md`
2. `deployment-page-notes-2026-03-31.md`
3. `resources/README.md`

继续做 MIPI / 代码转换：

1. `code-format-concepts.md`
2. `mipi-debug-notes.md`
3. `adb-shell-8k-platform-guide.md`

继续做发布：

1. `release-code-review-2026-05-03.md`
2. `release-packaging-recommendations-2026-05-03.md`
3. `cleanup-candidates-2026-05-04.md`

## 2. 工作区外部 memory

旧会话交接资料位于：

- `C:\Users\hufz\.qclaw\workspace\memory\handoff-2026-03-27-big8k-tauri-ui.md`
- `C:\Users\hufz\.qclaw\workspace\memory\2026-03-27.md`

它们适合回看早期 MIPI、DebugTab、timing bin、配置部署迁移过程；当前项目事实以仓库内文档和源码为准。

## 3. 当前维护原则

- 先对齐旧 C# 的真实行为，再优化 UI。
- 资源路径统一认 `resources/deploy/...`。
- DEMO 独立动作不要和文件工作区状态耦合。
- 浏览器预览看结构，Tauri exe 看最终效果。
- 涉及重启、initrd、删除、kill、SSH、50-TP 的动作必须写清风险。

