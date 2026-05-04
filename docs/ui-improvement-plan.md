# UI 改进计划

更新时间：2026-05-04

本文重写自早期 UI 审查。它不描述已经过时的“理想页面顺序”，只记录当前代码可执行的 UI 改进路线。

## 1. 当前主要问题

- `ConnectionPanel` 仍承担过多职责：ADB、SSH、设备列表、TCP、日志和调试开关混在一起。
- `FramebufferTab` 仍偏大，文件工作区、远端脚本、视频控制和 DEMO 动作需要继续下沉。
- 全局样式、按钮、卡片、间距和日志展示还不够统一。
- 浏览器预览和 Tauri exe 的验证语义容易混淆。
- 部分操作缺少足够清晰的危险提示。

## 2. 布局方向

保留当前工程已有视觉基调，优先做结构性改良：

- 去掉依赖固定设计尺寸的缩放思路。
- 使用响应式 flex / grid 布局。
- 保持右侧连接面板，但允许紧凑态和展开态。
- 主内容区按页面职责拆子组件，不在 Tab 里堆全部逻辑。

## 3. 导航原则

当前源码 Tab 顺序为：

```text
点屏配置 -> 命令调试 -> 显示画面 -> 电源读取 -> 配置部署 -> 总览
```

后续如要调整顺序，需要同时更新：

- `src/features/app/tabs.ts`
- `README.md`
- `usage-guide.md`
- 任何截图或操作说明

不要只改文档不改源码。

## 4. 连接面板拆分

建议拆成：

- `ConnectionStatusCompact`：当前连接、设备 ID、最近一条日志。
- `AdbConnectionCard`：ADB 探测、选择、TCP 连接。
- `SshConnectionCard`：SSH 输入和连接。
- `LogPanel`：日志过滤、滚动、最大条数限制。

现有 `src/features/connection/` 已经有拆分方向，后续应继续向这里收口。

## 5. Framebuffer 页面拆分

优先拆分：

- 本地 BMP 面板。
- 远端 BMP 面板。
- 远端文件工作区。
- DEMO 动作面板。
- 视频播放控制面板。

目标不是追求文件数量，而是让每块 UI 只持有自己需要的状态。

## 6. 统一组件规范

建议约定：

| 类型 | 样式方向 |
|---|---|
| 大卡片/面板 | `rounded-xl` |
| 按钮/输入框 | `rounded-lg` |
| Badge | `rounded-full` |
| 面板内边距 | `p-4` |
| 紧凑列表 | `px-3 py-2` |

按钮变体先收敛为：

- primary
- secondary
- ghost
- danger
- warning

## 7. 日志和异步状态

- 日志最大条数应有限制，例如 200 条。
- 长时间操作要有 loading 状态。
- 错误信息应该显示具体命令或操作阶段。
- 高影响操作要有二次确认或醒目提示。

## 8. 实施路线

Phase 1：清理结构

- 继续拆 `ConnectionPanel`。
- 继续拆 `FramebufferTab`。
- 抽统一日志面板。

Phase 2：统一视觉

- 统一按钮、卡片、输入、badge。
- 统一 loading / error 展示。

Phase 3：强化危险操作体验

- OLED 下载重启。
- deploy 系统模式切换。
- 远程删除。
- 停止远程脚本。
- 50-TP 保存。

Phase 4：再考虑导航顺序和首页体验

- 调整 Tab 顺序前先确认现场工作流。
- 文档和代码必须同步。

