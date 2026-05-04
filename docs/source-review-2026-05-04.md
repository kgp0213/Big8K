# 源码审查记录

日期：2026-05-04  
范围：`src/`、`src-tauri/src/`、`resources/`、`skill-big8k-screen/`

本次审查目标是确认当前源码事实和风险，不直接改变运行逻辑。

## 1. 关键结论

当前工程已经从早期原型状态进入可维护化阶段：后端模块已经拆分，前端 feature 目录逐步成形，资源部署目录也已统一到 `resources/deploy/`。

仍然最需要优先处理的是命令边界和前后端接线一致性。

## 2. 高优先级问题

### `deploy_enable_ssh` 前后端断线

前端 `src/features/deploy/types.ts` 定义了 `deploy_enable_ssh`，但 `src-tauri/src/lib.rs` 没有注册同名 Tauri command，也没有找到对应实现。当前 UI 点击会失败。

建议：实现并注册后端命令，或先从前端动作列表禁用/移除。

### `run_remote_script` 参数拼接风险

`src-tauri/src/deploy_commands.rs` 的远程脚本执行会拼接 `script_args`。脚本路径有一定约束，但参数仍是 shell 文本。

建议：把参数建模为数组，对每个参数统一 quoting，并限制可运行脚本名。

### 远程删除和停止脚本过宽

`delete_remote_file` 允许删除调用方给出的远端路径；`stop_remote_script` 使用类似 `killall python3` 的宽泛停止策略。

建议：删除路径限制在允许工作区内；停止脚本改为按 PID、脚本名或状态文件管理。

## 3. 中优先级问题

- 前端存在硬编码 SSH 密码，应改为用户输入、本地配置或环境配置。
- `tauri.conf.json` 中 `csp: null`，shell 插件能力需要收紧。
- OLED 配置下载会触发 initrd 重打包和重启，需要 UI 确认、日志和后端校验。
- `setup_loop_images` 的请求里有 `image_path`，但后端当前行为更像固定资源部署，UI 语义容易误导。
- `bundle.targets = "all"` 会提高发布验证成本，建议明确 Windows 交付目标。

## 4. 低优先级问题

- `upload_file_base64` 使用固定临时文件名，存在并发覆盖风险。
- 部署链路中存在 `chmod 777`，现场方便但发布口径过宽。
- 个别 `unwrap()` 可在后续清理中改为显式错误。
- 未跟踪的 `two_pattern_*` 脚本需要确认是否属于正式部署资源。

## 5. 当前已确认事实

- 后端模块包括 `deploy_commands.rs`、`framebuffer_commands.rs`、`mipi_commands.rs`、`oled_config.rs`、`display_runtime.rs`、`display_actions.rs`、`remote_runtime.rs` 等。
- `lib.rs` 当前主要负责类型、模块装配和命令注册，仍保留较多类型定义。
- 当前左侧 Tab 顺序由 `src/features/app/tabs.ts` 定义。
- `resources/deploy/` 是部署资源权威目录。

## 6. 后续修复建议

按小任务拆分：

1. 修复或禁用 `deploy_enable_ssh`。
2. 给远程脚本执行加参数数组和 allowlist。
3. 给远程删除加路径 allowlist。
4. 替换 `killall python3`。
5. 移除硬编码 SSH 密码。
6. 收紧 Tauri CSP 和 shell 插件配置。
7. 审核 `two_pattern_*` 脚本是否纳入正式资源。

