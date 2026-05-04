# Big8K Tauri UI 使用指南

更新时间：2026-05-04  
适用项目：`E:\ai2026\Big8K-Tauri-UI`

Big8K Tauri UI 是旧 C# WinForms 点屏上位机的 Tauri 迁移版本。它的目标不是重写一套炫技工具，而是把已在现场验证过的 ADB、MIPI、Framebuffer、OLED 配置、部署和电源读取链路迁移到一个更容易维护的桌面应用里。

## 1. 当前技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18、TypeScript、Vite 5、Tailwind CSS |
| 桌面壳 | Tauri 2 |
| 后端 | Rust 2021 |
| 设备通信 | ADB 为主，SSH 为可选能力 |
| 板端辅助 | Python 脚本、Framebuffer 二进制工具、vismpwr |

## 2. 启动与验证

```powershell
npm install
npm run tauri dev
npm run build
cd src-tauri
cargo check
```

发布构建使用：

```powershell
.\build-release.ps1
```

SSH 相关能力需要 Rust feature：

```powershell
cd src-tauri
cargo build --features ssh
```

## 3. 浏览器预览与 Tauri 真机模式

浏览器预览模式只适合看 UI 结构和交互，不会真正下发 ADB / SSH / Tauri 命令。真机调试以 Tauri 窗口为准。

如果浏览器和 exe 看到的页面不一致，优先怀疑 exe 没吃到最新前端构建，而不是先怀疑 CSS。必要时重新执行 `npm run build` 或重新拉起 `tauri dev`。

## 4. 当前页面顺序

当前源码中的左侧 Tab 顺序为：

```text
点屏配置 -> 命令调试 -> 显示画面 -> 电源读取 -> 配置部署 -> 总览
```

当前 Tauri 环境默认打开 `点屏配置`。浏览器预览模式默认可使用演示数据，不应被当成真实设备状态。

## 5. 连接面板

右侧连接面板负责 ADB / SSH 会话。

ADB 主流程：

1. 点击探测设备。
2. 从设备列表选择目标设备。
3. 建立连接。
4. 连接后可探测型号、Framebuffer、vismpwr、python3、MIPI mode / lanes 等信息。

SSH 当前仍是可选路径。源码中存在默认密码配置，已经在 `source-review-2026-05-04.md` 记录为风险，后续应改为用户输入或本地配置。

## 6. 点屏配置

`MipiTab` 负责 OLED / MIPI 配置与命令调试。

主要能力：

- Timing 参数编辑。
- 初始化代码编辑。
- 快捷命令：Software Reset、Sleep In、Sleep Out、Read Power Mode 等。
- `.bin` / `.json` 配置导入。
- `vis-timing.bin` 生成。
- OLED JSON 导出。
- 下载 OLED 配置并重启板端。

关键单位约定：

| 位置 | PCLK 单位 |
|---|---|
| UI 输入和显示 | kHz |
| `vis-timing.bin` / OLED JSON | Hz |
| FPS 计算 | `pclk_hz / htotal / vtotal` |

高影响操作：OLED 配置下载会写入板端配置、重打包 initrd 并重启，应只在确认参数后执行。

## 7. 命令调试与代码转换

`DebugTab` 负责命令调试，并挂载代码转换相关子视图。

左侧格式化代码区用于 `vismpwr` 检查和 OLED config 生成，格式为：

```text
DT DELAY LEN DATA...
```

右侧草稿区用于接收原始代码、`REGWxx`、`delay` 等上层写法，再转换为标准代码或格式化代码。完整规则见 `code-format-concepts.md` 和 `mipi-debug-notes.md`。

## 8. 显示画面

`FramebufferTab` 负责画面与媒体调试。

主要能力：

- 纯色、渐变、彩条、棋盘格、逻辑图案。
- 本地 BMP 上屏。
- 远端 BMP 列表读取和显示。
- 远端脚本运行。
- 视频播放、暂停、停止和状态读取。
- 远端文件工作区。

旧 C# 行为基线：本地 BMP 每次双击都重新 push 到 `/vismm/fbshow/bmp_online/`，再调用 `fbShowBmp`，不做缓存复用。

常用远端路径：

| 用途 | 路径 |
|---|---|
| BMP | `/vismm/fbshow/bmp_online/` |
| 视频 | `/vismm/fbshow/movie_online/` |
| 运行时图案 | `/vismm/fbshow/big8k_runtime/render_patterns.py` |
| 逻辑图案 | `/vismm/fbshow/logicPictureShow.py` |

## 9. 电源读取

`PowerRailsTab` 读取板端电源轨。现有文档和脚本围绕 AD5272、INA226、I2C bus 4、GPIO3B5 等链路整理。详细地址和公式见 `ad5272_multi_rail_readme.md`。

## 10. 配置部署

`DeployTab` 负责部署和系统模式切换。

当前动作：

- `deploy_install_tools`
- `deploy_install_app`
- `deploy_set_default_pattern`
- `deploy_set_multi_user`
- `deploy_set_graphical`
- `deploy_enable_ssh`

注意：`deploy_enable_ssh` 当前只存在于前端动作列表，Rust 后端没有注册同名 Tauri command。点击前需要先补后端实现，或临时移除/禁用该入口。

静态 IP 预设：

| IP | Gateway |
|---|---|
| `192.168.1.100` | `192.168.1.1` |
| `192.168.137.100` | `192.168.137.1` |

部署资源目录统一以 `resources/deploy/` 为准，细节见 `resources/README.md`。

## 11. Agent Skill

`skill-big8k-screen/` 是本项目的 Agent Skill 目录，提供 ADB 设备选择、OLED 配置生成与下载、运行时图案同步、图片显示、视频控制、部署等动作。它是自动化入口，不替代主 UI。

## 12. 常见问题

设备连不上：

- 先运行 `adb devices -l`。
- 确认 USB 线和板端授权状态。
- 多设备时必须选择明确的 `device_id`。

构建失败：

- 先跑 `npm run build` 确认前端类型和 Vite 构建。
- 再到 `src-tauri` 跑 `cargo check`。
- 不要把 `target/release` 当成干净发布目录。

画面按钮无效：

- 先确认 `Install tools` 和 `Install App` 已执行。
- 检查 `/vismm/fbshow/` 是否存在目标脚本和二进制。
- 检查 `python3`、`vismpwr`、`fbShowBmp` 是否可执行。

## 13. 安全提醒

这些操作需要额外谨慎：

- OLED 配置下载并重启。
- initrd 重打包。
- 远端 `rm`。
- 远端 `killall python3`。
- 50-TP 写入。
- SSH root 密码配置。

