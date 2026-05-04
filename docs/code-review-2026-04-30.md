# 代码质量审查记录

日期：2026-04-30  
重写日期：2026-05-04  
范围：前端 TypeScript / React、Rust Tauri 后端、Python 板端脚本、项目架构

本文保留早期审查发现，但移除情绪化表达，并按后续修复价值重新组织。

## 1. 总体判断

项目处于“快速迁移后正在模块化”的状态。功能链路已经覆盖现场主流程，但仍有明显的维护和安全债务。

主要风险集中在：

- 远程命令执行边界。
- 前端大组件。
- Python 脚本双副本。
- 旧 C# 行为迁移与新资源目录之间的同步。
- 发布安全配置。

## 2. 前端发现

优点：

- `features/` 目录已经按业务域拆分。
- `useDeployTabModel` 展示了 UI 与业务逻辑分离的方向。
- TypeScript 类型覆盖较好。
- 深色模式覆盖面较广。

主要问题：

- `FramebufferTab` 仍偏大，状态和处理函数过多。
- `ConnectionPanel` 职责仍过宽。
- SSH 默认密码曾被写在前端状态里，应移出源码。
- 一些类型和常量重复定义，例如日志类型、图案结果、图片配置。
- 远端路径、端口、轮询间隔等魔法值散布。
- 浏览器预览模式的 mock 返回需要更明确的类型边界。

建议：

- 继续把 Framebuffer 子面板下沉到 `features/framebuffer/`。
- 把连接逻辑下沉到 `features/connection/`。
- 抽共享路径常量和结果类型。
- 增加 React Error Boundary。

## 3. Rust 后端发现

已有进展：

- 业务命令已经从早期 `lib.rs` God Module 状态拆出多个模块。
- 当前模块包括 ADB、部署、Framebuffer、MIPI、OLED 配置、显示运行时、远端运行时等。

仍需关注：

- `run_remote_script` 的 `script_args` 仍需结构化和逐项 shell quoting。
- `delete_remote_file` 应限制到允许的远端工作目录。
- `stop_remote_script` 不应粗暴 kill 所有 python3。
- `upload_file_base64` 使用固定临时名，存在并发冲突风险。
- 部署流程里仍有 `chmod 777`。
- `tauri.conf.json` 中 CSP 关闭，shell 插件能力需要收紧。

建议：

- 为远程脚本、文件删除、视频控制建立 allowlist。
- 统一结果类型和错误处理。
- 对高影响命令增加后端参数校验。
- 用临时文件唯一名替代固定文件名。

## 4. Python 脚本发现

优点：

- `docs/ad5272_multi_rail.py` 结构清晰，适合作为硬件调试参考。
- `skill-big8k-screen/` 中部分 Python 模块具备良好 API 封装。

主要问题：

- `python/board_fbshow/` 与 `resources/deploy/fb-operate/` 存在多份重复脚本。
- `render_patterns.py` 存在重复副本。
- 多处脚本使用 `shell=True` 或 `os.system()`。
- Framebuffer 写屏、字体加载、按键读取等逻辑重复。
- 分辨率、路径、端口等硬编码较多。

建议：

- 明确一个源目录，另一个目录由构建/同步脚本生成。
- 抽公共 Framebuffer 工具模块。
- 对用户输入路径和文件名做 quoting 或参数数组化。
- 对现场脚本先做最小风险修复，不做大而全重构。

## 5. 架构发现

- `resources/deploy` 是当前部署资源权威路径。
- `target/release` 不是正式交付目录。
- `bundle.resources`、ADB、脚本、模板、可写配置需要重新规划。
- `.gitignore` 对日志和缓存有效，但要小心不要忽略合法文档。

## 6. 优先路线

P0：

- 修复 `deploy_enable_ssh` 前后端断线，或禁用入口。
- 修复远程脚本参数拼接风险。
- 限制远程删除和 kill 操作。
- 移除硬编码 SSH 密码。

P1：

- 拆分 `FramebufferTab` 和 `ConnectionPanel`。
- 消除 Python 脚本双副本维护。
- 收紧 Tauri CSP 和 shell 插件能力。
- 清理 release 打包资源。

P2：

- 统一前后端结果类型。
- 统一路径、端口、超时常量。
- 增加 Error Boundary 和日志上限。

