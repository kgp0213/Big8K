# Big8K Tauri UI

Big8K Tauri UI 是 8K OLED 点屏平台的新一代上位机界面，基于 **Tauri + React + TypeScript + Rust**。

这个工程的目标不是重新发明一套全新工具，而是逐步替代旧版 **C# WinForms 上位机**，把常用点屏、画面显示、连接管理等核心流程迁移到一个更容易维护、启动更轻、界面更现代的桌面应用里。

## 1. 项目背景

旧版上位机位于：

- `E:\Resource\8Big8K\8K_software\PC-SW`

旧版工程是一个典型的 Windows C# WinForms 工具，包含：

- 主界面与大量 Designer 页面
- ADB 相关控制逻辑
- SSH / 网络相关操作
- MIPI 点屏指令下发
- framebuffer 画面显示能力
- I2C / EEPROM / GPIO 等外围调试入口

新工程位于：

- `E:\ai2026\Big8K-Tauri-UI`

新工程目前采用：

- 前端：React + TypeScript + Vite + Tailwind CSS
- 桌面壳：Tauri 2
- 本地后端：Rust
- 设备通信：ADB / SSH

## 2. 当前工程定位

当前版本属于：

- **可开发**
- **可运行**
- **可连接板卡做基础调试**
- **部分功能已接通真实能力**
- **仍处于从旧版 PC-SW 迁移中的阶段**

重点不是一次性完全复刻旧版 C# 上位机，而是优先迁移最常用、最有价值的链路。

## 3. 已接入的核心能力

### 3.1 连接管理

- ADB 设备检测
- ADB 设备选择
- ADB over TCP 连接
- ADB 断开
- SSH 连接
- 最近成功 SSH 地址记忆
- 自动探测板卡基础能力：
  - `/dev/fb0`
  - `vismpwr`
  - `python3`
- ADB / SSH 连接成功后自动读取实际屏幕分辨率

### 3.2 显示画面

- 黑屏 / 红屏 / 绿屏 / 蓝屏 / 白屏
- 灰阶渐变 / 红渐变 / 绿渐变 / 蓝渐变
- 彩条
- 棋盘格
- 自定义文字上屏
- 图片上传并显示
- 清屏

说明：

- 当前快捷画面已经按设备实际 framebuffer 分辨率生成，不再固定写死某一个尺寸。
- 板卡返回 `virtual_size` 时，兼容以下格式：
  - `900,960`
  - `900x960`
  - `900×960`

### 3.3 MIPI 点屏控制

当前已接入的 Tauri 后端命令包括：

- `mipi_send_command`
- `mipi_send_commands`
- `mipi_software_reset`
- `mipi_read_power_mode`
- `mipi_sleep_in`
- `mipi_sleep_out`

### 3.4 其他后端命令

当前已接入：

- `adb_devices`
- `adb_select_device`
- `adb_connect`
- `adb_disconnect`
- `adb_shell`
- `adb_push`
- `adb_pull`
- `adb_probe_device`
- `ssh_connect`
- `ssh_exec`
- `display_solid_color`
- `display_gradient`
- `display_color_bar`
- `display_checkerboard`
- `display_text`
- `display_image`
- `clear_screen`
- `run_demo_screen`
- `run_text_demo`
- `run_poster_demo`

## 4. 与旧版 PC-SW 的关系

旧版 C# 上位机是功能母体，新版 Tauri UI 是迁移中的新桌面壳。

可以把两者理解为：

- **PC-SW**：旧主系统，功能大而全，但代码结构偏传统 WinForms
- **Big8K-Tauri-UI**：新 UI 外壳，优先把高频功能做成更清晰的交互和更容易维护的代码

### 当前已明显迁移/对应的方向

- 连接管理（ADB / SSH）
- 屏幕显示 / framebuffer 调试
- MIPI 指令下发
- 调试型页面骨架

### 仍然在迁移中的方向

- I2C / EEPROM
- GPIO
- 网络配置
- 脚本管理
- 更完整的调试命令流程
- 旧版工程中的更多业务细节和边缘流程

## 5. 仓库整理说明

本仓库只保留**主工程源码、必要配置、运行所需脚本**。

以下内容不再纳入版本库主线：

- 本地截图脚本
- 邮件发送脚本
- 临时调试 probe
- 过程记录型日志文件
- Tauri 自动生成的 schema / 辅助描述文件

这类文件统一建议放在开发机本地 `examples/` 目录中，便于自用，但不影响别人拿到源码后直接编译。

## 6. 目录结构

```text
Big8K-Tauri-UI/
├─ src/
│  ├─ App.tsx
│  ├─ main.tsx
│  ├─ styles.css
│  ├─ components/
│  │  ├─ ConnectionPanel.tsx
│  │  └─ StatusBar.tsx
│  └─ tabs/
│     ├─ HomeTab.tsx
│     ├─ MipiTab.tsx
│     ├─ FramebufferTab.tsx
│     ├─ I2CTab.tsx
│     ├─ GpioTab.tsx
│     ├─ ScriptTab.tsx
│     ├─ NetworkTab.tsx
│     └─ DebugTab.tsx
├─ src-tauri/
│  ├─ Cargo.toml
│  ├─ tauri.conf.json
│  └─ src/
│     ├─ main.rs
│     └─ lib.rs
├─ fb_demo.py
├─ fb_text_demo.py
├─ fb_text_poster.py
├─ fb_text_custom.py
├─ fb_image_display.py
├─ package.json
└─ README.md
```

## 6. 开发环境要求

建议在 **Windows 10/11** 下开发和运行。

至少需要以下环境：

### 6.1 Node.js

推荐：

- Node.js 20+

当前工程实测环境里使用的是 Node 22，也可正常工作。

### 6.2 Rust

需要安装：

- Rust toolchain
- Cargo

可用以下命令确认：

```bash
rustc --version
cargo --version
```

### 6.3 Tauri 2 CLI

项目本地依赖里已经包含：

- `@tauri-apps/cli`

通常不需要全局单独安装。

### 6.4 Windows 构建依赖

如果你要在 Windows 上真正编译 Tauri 桌面程序，建议系统具备：

- Visual Studio 2022 Build Tools 或 Visual Studio 2022
- Desktop development with C++ 相关组件
- WebView2 Runtime（一般较新的 Windows 已自带）

### 6.5 板卡通信依赖

本项目依赖以下外部工具/环境：

- `adb` 需要已安装并加入 `PATH`
- 目标板卡需要支持：
  - ADB
  - 或 SSH
- 若使用 framebuffer 显示相关功能，板端通常需要：
  - `/dev/fb0`
  - `python3`
- 若使用 MIPI 相关指令，下位机侧需要存在：
  - `vismpwr`

### 6.6 关于仓库中的默认 SSH 账号口令

当前源码里保留了一组用于快速联调的默认 SSH 用户名/密码，用于让开发人员在内网测试板卡时减少重复输入。

请明确把它理解为：

- **示例默认值**
- **仅限内网测试环境**
- **不适合作为公开环境、生产环境或长期固定凭据**

如果你要把本项目用于更正式的环境，建议至少做下面几件事：

1. 不再使用默认口令
2. 改成你自己的板卡账号/密码
3. 更进一步可改为：
   - 本地配置文件读取
   - 环境变量注入
   - 首次运行时输入
   - UI 中手动录入但不入库

如果这个仓库未来长期公开，推荐后续把默认 SSH 口令从前端源码中移除，改成外部配置。

## 7. 安装依赖

在项目根目录执行：

```bash
npm install
```

## 8. 开发模式运行

推荐开发时直接使用 Tauri dev：

```bash
npm run tauri dev
```

这会同时做两件事：

1. 启动前端开发服务器（Vite）
2. 启动 Tauri 桌面程序

注意：

- `http://localhost:1421/` 这个地址只适合看前端页面
- **真正的 ADB / SSH / Tauri invoke 功能，必须在 Tauri 桌面窗口里测试**
- 如果你在浏览器里直接点需要 Tauri 后端的按钮，会看到类似：

```text
Not in Tauri environment
```

这是正常现象，因为浏览器环境没有 Tauri runtime。

## 9. 构建方式

### 9.1 仅构建前端静态资源

```bash
npm run build
```

构建产物输出到：

- `dist/`

### 9.2 仅生成 exe（不打安装包）

如果你只是想得到 Windows 可执行文件，可以在 `src-tauri` 目录执行：

```bash
cargo build --release --bin Big8K
```

产物路径通常为：

```text
src-tauri/target/release/Big8K.exe
```

### 9.3 Tauri 正常打包

```bash
npm run tauri build
```

这会先跑前端 build，再走 Tauri 的 bundle 流程。

## 10. 运行流程建议

建议实际调试时按这个顺序：

1. 启动 Tauri dev
2. 在右侧连接面板选择 ADB 或 SSH
3. 确认已读取到：
   - 设备型号
   - 屏幕分辨率
   - 位深
4. 再进入：
   - `点屏配置`
   - `显示画面`
5. 做具体测试

这样可以避免在未连接或环境不满足时直接点功能按钮。

## 11. 已知说明

### 11.1 实际分辨率读取

当前连接成功后，会读取：

- `/sys/class/graphics/fb0/virtual_size`
- `/sys/class/graphics/fb0/bits_per_pixel`

并把结果用于快捷测试画面的生成。

### 11.2 Demo 脚本

当前仓库根目录下的这些 Python 脚本：

- `fb_demo.py`
- `fb_text_demo.py`
- `fb_text_poster.py`
- `fb_text_custom.py`
- `fb_image_display.py`

用于 framebuffer 相关显示。

其中部分脚本仍然保留较强的演示属性，后续还可以继续做更彻底的动态分辨率适配与功能梳理。

### 11.3 页面成熟度

当前较成熟的模块主要是：

- `ConnectionPanel`
- `HomeTab`
- `MipiTab`
- `FramebufferTab`

以下页面仍偏占位或半成品：

- `DebugTab`
- `NetworkTab`
- `ScriptTab`
- `GpioTab`
- `I2CTab`

## 12. 最小可用编译步骤（给新拿到源码的人）

如果你只是要“拿到源码后先编出来并跑起来”，最短步骤如下：

```bash
npm install
npm run tauri dev
```

如果你只是要生成 exe：

```bash
npm install
cd src-tauri
cargo build --release --bin Big8K
```

## 13. 后续建议

如果后续继续完善这个仓库，建议优先做：

1. 把 `显示画面` 里的 Demo 脚本全部统一成按真实分辨率生成
2. 继续把旧版 PC-SW 的关键流程做迁移映射
3. 给 `DebugTab / NetworkTab / ScriptTab` 接入真实后端逻辑
4. 梳理旧版工程中的板端工具、脚本和资源哪些需要纳入新仓库

---

如果你是第一次接手这个项目，建议先从 **连接面板 + 显示画面 + MIPI 指令** 这三块开始读代码，这三块最接近当前可用主流程。
