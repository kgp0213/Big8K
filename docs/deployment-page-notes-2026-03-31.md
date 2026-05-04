# 配置部署页与 DEMO 区边界

更新时间：2026-05-04

本文重写自 2026-03-31 的页面整理记录，保留当前仍有效的结论：部署动作、DEMO 动作和文件工作区状态必须拆开。

## 1. 页面职责

`DeployTab` 负责：

- Install tools。
- Install App。
- 默认显示内容部署。
- 静态 IP 设置。
- multi-user / graphical 启动目标切换。
- 本机网络信息读取。

`FramebufferTab` 负责：

- 图案和图片上屏。
- 远端 BMP / 视频工作区。
- 远端脚本运行。
- 视频播放控制。

不要把部署动作塞进文件工作区状态里，也不要让 DEMO 按钮依赖当前选中的远端文件。

## 2. 当前部署动作分组

基础环境：

- `deploy_install_tools`
- `deploy_install_app`

默认显示与模式：

- `deploy_set_default_pattern`
- `deploy_set_multi_user`
- `deploy_enable_ssh`

系统 UI：

- `deploy_set_graphical`

注意：`deploy_enable_ssh` 目前是前端动作，后端未注册。文档和 UI 都不能把它描述成已接通能力。

## 3. DEMO 区应保持独立

这几个动作应视为独立部署动作：

- Set default pattern L128。
- 循环播放图片。
- 视频播放默认 bundle。

它们不应该依赖：

- `selectedFileName`
- `remotePath`
- `videoZoomMode`
- `showFramerate`
- 播放/暂停/停止控制区状态

## 4. 已踩坑结论

浏览器和 exe 不一致时：

- 浏览器可用于看结构。
- exe 才代表最终 Tauri 观感。
- 如果两边不一致，优先重新构建或重启 Tauri，而不是先改 CSS。

资源路径迁移后：

- 不再认旧工程根目录下的 `fb_operate` / `fb_RunApp`。
- 当前统一认 `resources/deploy/...`。

`default_movie/autorun.py`：

- 曾经出现新旧文件同名但内容不同。
- 处理这类资源时要做哈希或文本比对。

## 5. C# 行为基线

旧 C# 中 `btn_graphical_target_Click` 的视频默认动作，是部署 `fb_RunApp/default_movie`，不是播放当前选中文件。

`ADB_AutorunApp_Setup(app_path)` 的核心行为见 `pcsw-migration-notes-2026-03-28.md`，后续 `default`、`default_bmp`、`default_movie` 应复用同一部署族。

## 6. 后续整理建议

- 把 autorun bundle 部署整理成统一后端函数。
- 让日志分为“调试明细”和“用户摘要”两层。
- 从 `FramebufferTab` 中继续下沉文件工作区、视频动作和 DEMO 动作。
- 在 `resources/README.md` 中明确 `default`、`default_bmp`、`default_movie` 的区别。

