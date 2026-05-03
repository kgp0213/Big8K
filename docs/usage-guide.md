# Big8K-Tauri-UI 使用文档

> 8K OLED 点屏上位机 — 新一代 PC 端控制软件
> 项目路径：`E:\ai2026\Big8K-Tauri-UI`

---

## 1. 项目概述

Big8K-Tauri-UI 是基于 **Tauri v2** 构建的桌面应用，用于通过 **ADB** 或 **SSH** 连接 RK3588 开发板，实现对 8K OLED 屏幕的调试、配置和显示控制。正在逐步替代原有的 C# WinForms 上位机方案。

**技术栈：**
- 前端：React 18 + TypeScript + Tailwind CSS v3 + Vite v5
- 后端：Rust (edition 2021) + Tauri v2
- 辅助：Python 屏幕调试脚本 + OpenClaw Agent Skill
- 设备通信：ADB / SSH

---

## 2. 环境准备

### 2.1 开发环境要求

| 工具 | 用途 |
|------|------|
| Node.js 18+ | 前端开发与构建 |
| Rust (rustc + cargo) | Rust 后端编译 |
| Tauri CLI (v2) | Tauri 构建 |
| ADB 工具链 | 设备连接与通信 |

### 2.2 快速启动

```bash
# 安装依赖
npm install

# 开发模式（Vite dev server + Tauri 窗口）
npm run tauri dev

# 仅构建前端
npm run build

# Rust 语法检查
cd src-tauri && cargo check

# 构建 Debug 版本
cd src-tauri && cargo build

# 构建 Release 版本（含 NSIS 安装包）
.\build-release.ps1

# 带 SSH 功能构建
cd src-tauri && cargo build --features ssh
```

### 2.3 浏览器预览模式

当不在 Tauri 环境运行时（`isTauri()` 检测为 false），应用进入浏览器预览模式：
- 显示演示数据（模拟设备状态）
- ADB/SSH 指令不会真正下发
- 可用于界面布局和交互验证

---

## 3. 界面总览

应用共 7 个 Tab 页面，通过顶部标签页切换：

| Tab | 图标 | 功能 |
|-----|------|------|
| **总览** (Home) | 🏠 | 设备状态总览（CPU/内存/温度、屏幕信息、MIPI 状态） |
| **点屏配置** (MIPI) | 🖥️ | OLED/MIPI 点屏配置与调试（默认起始页） |
| **显示画面** (FB) | 🖼️ | Framebuffer 显示、图片上屏、视频播放 |
| **电源读取** (Power) | ⚡ | 通过 I2C 读取多路电源轨电压/电流/功耗 |
| **配置部署** (Deploy) | 🌐 | 安装/推送/重启、网络配置、I2C 修复 |
| **命令调试** (Debug) | 💻 | 预设命令、多命令批处理 |
| **代码转换** (CodeConvert) | 🔄 | MIPI 命令格式转换（驱动代码/标准格式/格式化代码） |

---

## 4. 功能详解

### 4.1 设备连接（ConnectionPanel）

位于右侧面板，支持两种连接方式：

**ADB 连接（默认）：**
1. 点击「探测设备」自动搜索可用 ADB 设备
2. 从列表中选择目标设备
3. 点击「连接」建立会话

**SSH 连接：**
1. 输入 IP 地址、端口（默认 22）、用户名/密码
2. 点击「SSH 连接」

> **注意**：SSH 功能需要在构建时启用 `ssh` feature

### 4.2 MIPI/OLED 点屏配置（MipiTab）

核心调试页面，提供完整的 OLED 配置能力：

- **Timing 配置**：水平/垂直时序参数（HBP、HFP、VBP、VFP 等），PCLK 频率（UI 单位为 **kHz**）
- **Init Code 配置**：OLED 初始化命令序列
- **Quick Commands**：快速命令（关屏、开屏、Software Reset 等）
- **配置导入**：支持 `.bin`（旧格式）和 `.json`（新格式）双格式
- **配置导出**：生成 `vis-timing.bin`、导出 OLED 配置 JSON
- **下载并重启**：将配置写入板端并重启

> **PCLK 单位约定**：UI 界面使用 **kHz**，文件（bin/json）使用 **Hz**。FPS 计算：`fps = (pclk_khz * 1000) / htotal / vtotal`

### 4.3 Framebuffer 显示（FramebufferTab）

屏幕画面调试与媒体管理：

**图案显示：**
- 纯色（Solid Color）：选择任意颜色
- 渐变（Gradient）
- 彩条（Color Bar）
- 棋盘格（Checkerboard）
- 测试图/逻辑图案

**图片显示：**
- 本地 BMP 图片上屏（自动 push 到板端）
- 远端 BMP 图片列表浏览
- Base64 图片显示

**视频播放：**
- 视频播放控制（播放/暂停/停止）
- 播放状态查询

> **远端路径约定**：BMP 图片存放 `/vismm/fbshow/bmp_online/`，视频文件存放 `/vismm/fbshow/movie_online/`

### 4.4 电源轨读取（PowerRailsTab）

通过 I2C 读取 RK3588 开发板的多路电源轨：

- **支持芯片**：AD5272 等多路电源管理芯片
- **读取参数**：电压（V）、电流（A）、功耗（W）
- **操作方式**：点击「读取所有电源轨」一键读取

### 4.5 配置部署（DeployTab）

板端资源管理与网络配置：

**部署操作：**
- 推送运行工具（framebuffer 操作工具、Python 库）
- 安装/更新应用
- 配置开机自启动
- 设置静态 IP

**资源目录：** `resources/deploy/`
- `fb-operate/` — Framebuffer 操作二进制（fbShowBmp、vismpwr 等）
- `fb-RunApp/` — 自启动配置（autorun.py、systemd service）
- `dist-packages/` — 板端 Python 包（pyserial、dtbo overlay）
- `python-libs/` — Python wheel 包（Pillow、smbus2）
- `manifests/` — 部署清单（index.json、install-app.json、install-tools.json）

### 4.6 命令调试（DebugTab）

灵活的命令执行环境：

- **预设命令管理**：加载/保存常用命令列表
- **单命令执行**：输入命令并直接下发
- **多命令批处理**：一次性下发多条命令
- **命令类型**：ADB shell 命令、MIPI 命令（通过 vismpwr 下发）

### 4.7 代码转换（CodeConvertTab）

MIPI 初始化代码格式转换工具：

- **输入格式**：驱动代码格式、标准 MIPI 格式
- **输出格式**：格式化代码、JSON 配置片段
- **适用场景**：从驱动手册复制初始化序列，转换为上位机可用的配置格式

---

## 5. Python 脚本子系统

`python/` 目录包含板端运行的 Python 脚本：

### 5.1 屏幕显示脚本

| 脚本 | 功能 |
|------|------|
| `python/fb_demo.py` | Demo 图案综合展示 |
| `python/fb_image_display.py` | 图片显示 |
| `python/fb_text_black_white.py` | 黑白文字显示 |
| `python/fb_text_custom.py` | 自定义文字 |
| `python/fb_text_demo.py` | 文字 Demo |
| `python/fb_text_poster.py` | 海报文字 |

### 5.2 板端运行脚本

`python/board_fbshow/` 目录包含板端直接运行的脚本：

- `autorun.py` / `autorunUSB.py` — 自启动入口
- `framebuffer_screenshot.py` — FB 截图
- `videoPlay.py` — 视频播放
- `demo_colors.py` / `demo_multi_effects.py` — 颜色/Demo 效果
- `logicPictureShow.py` — 逻辑图案显示
- `Mouse_crossLine.py` — 鼠标十字线
- `adaptive_screen_streamer.py` / `adaptive_stream_receiver.py` — 自适应屏幕流
- `chenfeng_movie.py` — 电影模式播放

### 5.3 硬件控制脚本

- `python/5272.py` — AD5272 电源芯片 I2C 控制
- `python/gpio_3b5.py` — GPIO 3B5 控制
- `python/runtime_fbshow/render_patterns.py` — 运行时渲染图案

---

## 6. OpenClaw Agent Skill

`skill-big8k-screen/` 是一个 OpenClaw Agent Skill，允许 AI Agent 直接操作 8K 屏幕调试流程。

### 可用动作

| 动作 | 功能 |
|------|------|
| `big8k.list_devices` | 列出 ADB 设备 |
| `big8k.select_device` | 选择目标设备 |
| `big8k.device_probe` | 设备探测（详细信息） |
| `big8k.generate_timing_bin` | 生成 timing.bin |
| `big8k.export_oled_config_json` | 导出 OLED 配置 JSON |
| `big8k.download_oled_config_and_reboot` | 下载配置并重启板端 |
| `big8k.sync_runtime_patterns` | 同步运行时图案 |
| `big8k.display_runtime_pattern` | 显示运行时图案 |
| `big8k.display_logic_pattern` | 显示逻辑图案 |
| `big8k.display_local_image` | 显示本地图片 |
| `big8k.display_remote_image` | 显示远端图片 |
| `big8k.display_image_base64` | 通过 Base64 显示图片 |
| `big8k.play_video` | 播放视频 |
| `big8k.video_control` | 视频控制（暂停/停止） |
| `big8k.get_video_playback_status` | 获取播放状态 |
| `big8k.deploy_install_tools` | 部署安装工具 |
| `big8k.deploy_install_app` | 部署安装应用 |

**依赖：** Python 3.8+，ADB 需在系统 PATH 中

---

## 7. 目录结构与关键文件

```
Big8K-Tauri-UI/
├── src/                  # 前端源码
│   ├── main.tsx          # React 入口
│   ├── App.tsx           # 主应用组件（路由/布局）
│   ├── components/       # 通用组件（ConnectionPanel、StatusBar）
│   ├── tabs/             # 页面组件（7 个 Tab）
│   ├── features/         # 业务逻辑模块
│   └── utils/            # 工具函数
├── src-tauri/            # Rust 后端
│   ├── src/lib.rs        # 核心模块（50+ Tauri 命令）
│   ├── src/oled_config.rs      # OLED 配置解析
│   ├── src/display_runtime.rs  # 显示运行逻辑
│   ├── src/openclaw_*.rs       # OpenClaw 分层架构
│   └── src/host_env.rs         # 宿主机网络信息
├── python/               # Python 屏幕调试脚本
├── skill-big8k-screen/   # OpenClaw Agent Skill
├── resources/            # 部署资源（ADB、板端工具、Python 库）
└── docs/                 # 项目文档
```

---

## 8. 关键约定

### 单位约定

| 位置 | PCLK 单位 | 说明 |
|------|-----------|------|
| UI 界面 | **kHz** | 用户输入和展示 |
| bin/json 文件 | **Hz** | 存储格式 |
| FPS 计算 | `fps = (pclk_khz * 1000) / htotal / vtotal` | |

### 路径约定

| 用途 | 路径 |
|------|------|
| BMP 图片存放 | `/vismm/fbshow/bmp_online/` |
| 视频文件存放 | `/vismm/fbshow/movie_online/` |
| Python 脚本临时路径 | `/data/local/tmp/...` |
| 探测脚本临时目录 | `/dev/shm` |

### 安全操作

- **危险操作（关屏/开屏/Software Reset）** 需二次确认
- **MIPI 命令统一通过 vismpwr 下发**
- **本地 BMP 每次都重新 push**（不缓存，与旧 C# 行为对齐）
- **网卡只显示有线/无线 IPv4**，排除虚拟网卡

---

## 9. 常见问题

### 9.1 设备无法连接

1. 确认 ADB 已安装且在 PATH 中
2. 检查 USB 连接和数据线
3. 运行 `adb devices` 手动验证
4. 尝试点击「探测设备」重新扫描

### 9.2 构建失败

```bash
# 清理缓存后重试
cd src-tauri && cargo clean
cargo build

# 前端依赖问题
npm install --force
```

### 9.3 浏览器预览模式

如果只想看 UI 效果而不连接设备，直接在浏览器打开 `http://localhost:1421`（确保运行了 `npm run tauri dev` 或先启动 Vite dev server）。

### 9.4 SSH 连接

SSH 功能默认未启用，需在构建时添加 `--features ssh`。

---

> 文档版本：v1.0 | 更新日期：2026-05-02
