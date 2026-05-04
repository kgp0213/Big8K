# Big8K Tauri UI

Big8K Tauri UI 是 8K OLED 点屏平台的新一代上位机，基于 **Tauri + React + TypeScript + Rust**。

它的目标不是另起炉灶重写一套工具，而是把旧版 **C# WinForms 上位机**里真正高频、关键、容易继续维护的链路，逐步迁到一个更轻、更清晰、更容易扩展的桌面应用里。

- 旧版 C# 工程：`E:\Resource\8Big8K\8K_software\PC-SW`
- 新版 Tauri 工程：`E:\ai2026\Big8K-Tauri-UI`

---

## 0. 当前快照与演进脉络（2026-05-04）

这份 README 原来偏“交接备忘录”，其中一部分“计划拆分”已经落地。后续接手时，先看本节，再看下面的历史约定。

### 项目的前世今生

这个项目的前身是旧版 **C# WinForms 上位机**，承担 8K OLED 点屏现场调试里的高频工作：连板、下发配置、MIPI 快捷命令、framebuffer 刷图、部署脚本、读电源和查看设备状态。旧工具能用，也沉淀了真实现场行为，但逻辑分散、界面和流程越来越重，后续维护和扩展成本开始变高。

当前 Tauri 版本的定位不是“推翻重写”，而是把旧 C# 里已经验证过的主链路迁过来：先保证 ADB / framebuffer / MIPI / OLED 配置这些关键路径能跑，再逐步拆清页面职责和 Rust 后端模块。也就是说，新工程的核心价值不是炫技，而是让旧链路继续可靠，同时让后续维护更可控。

到当前阶段，项目已经从“能跑的迁移原型”进入“可维护的调试工作台”：前端按 Tab 和 feature 收口，后端从 `lib.rs` 逐步拆出 ADB、部署、MIPI、framebuffer、OLED 配置、显示动作和远端运行时适配。README 的任务也随之变化：不只是记录踩坑，还要成为后续接手和 Agent 继续迭代时的工程地图。

### 当前技术栈

- Tauri 2
- React 18
- TypeScript
- Rust 2021
- Vite 5
- Tailwind CSS

### 当前主要入口

左侧 Tab 顺序当前为：

```text
点屏配置 -> 命令调试 -> 显示画面 -> 电源读取 -> 配置部署 -> 总览
```

当前 Tauri 环境默认打开 `点屏配置`，浏览器预览模式默认打开 `总览`。浏览器预览模式会注入演示数据，不会真正执行 ADB / SSH / Tauri 指令。

### 当前已落地能力

- ADB 设备刷新、选择、TCP 连接、断开、shell、push、pull。
- 连接后自动探测设备型号、分辨率、fb0、vismpwr、python3、MIPI mode / lanes 等信息。
- SSH 连接和命令执行仍是可选 feature。
- OLED 配置支持单入口打开 `.bin` / `.json`。
- `oled_config.rs` 已承接配置解析、`vis-timing.bin` 生成、JSON 导出、下载并重启。
- `display_runtime.rs` 已承接本地/远端图片显示、运行时测试图、视频播放状态和控制。
- `display_actions.rs` / `remote_runtime.rs` / `action_result.rs` 已作为显示和配置链路的动作层、传输适配层和统一结果类型。
- `FramebufferTab` 已包含本地 BMP、远端 BMP、运行时测试图、远端文件工作区、脚本运行、视频控制。
- `DeployTab` 已包含本机网络读取、静态 IP、Install tools、Install App、默认画面、multi-user、graphical 等动作。
- `resources/deploy/` 已采用清单和资源目录维护部署内容，细节见 `resources/README.md`。

### 当前已知缺口

- `src/features/deploy/types.ts` 里已有 `开启SSH登录` 前端动作，命令名是 `deploy_enable_ssh`，但当前 Rust `generate_handler` 未注册对应后端命令。使用前需要补后端实现，或先从前端动作列表移除。
- `lib.rs` 当前主要保留类型定义、模块装配和 Tauri 命令注册；业务命令已经明显外移。
- `FramebufferTab.tsx` 仍偏大，文件工作区和视频动作还可以继续下沉到 `features/framebuffer/`。

### 本次源码复核结论

2026-05-04 再次对照源码复核后，当前 README 以这些事实为准：

- 后端已经拆出 `deploy_commands.rs`、`framebuffer_commands.rs`、`mipi_commands.rs`，不再只是 `lib.rs` 暂存逻辑。
- 原先文档里的 `openclaw_actions.rs` / `openclaw_adapter.rs` 命名已经过时，当前源码对应为 `display_actions.rs` / `remote_runtime.rs` / `action_result.rs`。
- `CodeConvertTab` 不在左侧主 Tab 中，而是挂在 `DebugTab` 的子视图里。
- 前端仍保留 `deploy_enable_ssh` 动作入口，但后端没有对应 Tauri 命令注册，这是当前最明确的接线缺口。
- `npm run build` 已通过。
- `cargo check` 已通过。

### 当前最重要约定

- UI 里的 `PCLK` 是 **kHz**，`vis-timing.bin` / OLED JSON 文件里的 `PCLK` 是 **Hz**。
- 本地 BMP 每次双击都重新上传到 `/vismm/fbshow/bmp_online/`，再执行 `fbShowBmp`。
- Windows 本机网络信息点击时才查询，不在启动时预取。
- 不要用 PowerShell 批量替换源码，避免中文编码污染。

---

## 1. 当前定位

当前仓库属于：

- **能编译**
- **能运行**
- **能连板**
- **能做基础点屏 / framebuffer / MIPI 调试**
- **仍在持续对齐旧版 PC-SW 行为**

原则上：

- 先迁移高频主流程
- 先对齐旧 C# 的真实行为
- 先收口重复逻辑和易错逻辑
- 不为了“看起来更整洁”去打断已验证正常的链路

---

## 2. 主要页面职责

前端现在已经明确按“页面职责”在收口，避免一个页面既做状态展示又做执行操作。

### `HomeTab`

**职责：设备状态总览**

主要放：
- 设备连接摘要
- CPU / 内存 / 温度等设备状态
- 屏幕信息卡片
- 最近日志

设计原则：
- 这里看状态，不堆执行入口
- 让人一打开就知道设备现在活没活、屏幕现在是什么状态

### `DeployTab`

**职责：部署动作执行**

主要放：
- 安装 / 推送 / 重启类动作
- 本机网络信息查询
- 板端静态 IP 设置
- 部署辅助操作
- 运行模式切换

设计原则：
- 这里是“动手”的地方，不再承担首页状态总览职责
- 本机网络信息**点击时才查询**，不在启动时自动预取，避免拖慢 exe 启动

当前动作：
- `Install tools`
- `Install App`
- `Set default pattern L128`
- `CMD line: multi-user`
- `graphical 图形界面`
- 静态 IP：`192.168.1.100` / `192.168.137.100`

当前注意：
- 前端已有 `开启SSH登录` 动作入口，命令名是 `deploy_enable_ssh`
- 后端当前尚未注册 `deploy_enable_ssh`，使用前需要补 Rust 命令或先移除该入口

### `FramebufferTab`

**职责：framebuffer 画面与媒体调试**

主要放：
- 纯色 / 渐变 / 测试图
- 本地 BMP 上屏
- 远端 BMP 列表读取与显示
- 远端脚本 / 图片 / 视频文件工作区
- 视频播放控制

当前约定：
- 本地 BMP 双击上屏，必须严格按旧 C# 行为：
  1. 先 push 到板端
  2. 再执行 `fbShowBmp`
- **每次双击都重新 push**，不走缓存复用

### `MipiTab`

**职责：OLED / MIPI 点屏配置与命令调试**

主要放：
- Timing 参数
- 初始化代码
- 快捷命令
- OLED 配置导入 / 导出
- `vis-timing.bin` 生成与下载

当前约定：
- UI 中 `PCLK` 一律按 **kHz** 展示与编辑
- 落到 bin / json 文件时，再换算回 **Hz**

### `PowerRailsTab`

**职责：电源轨读数与电源状态观察**

### `DebugTab`

**职责：调试辅助区 / 待迁移能力承接区**

用于承接：
- 旧版工具里还没完成迁移，但又确实需要保留的调试入口
- 阶段性实验功能
- 命令预设和多命令调试
- 代码转换子视图（`CodeConvertTab` 当前挂在 `DebugTab` 内，不是左侧独立主 Tab）

---

## 3. 前端结构约定

前端现在采用：
- `tabs/` 负责页面壳和布局编排
- `features/` 负责具体业务模块、类型、动作、局部组件、存储逻辑

当前已经较明确的模块包括：

```text
src/
├─ App.tsx
├─ components/        # 跨页面通用组件：连接面板、状态栏等
├─ features/
│  ├─ app/            # Tab 定义和应用级类型
│  ├─ code-convert/   # 代码转换
│  ├─ connection/     # 连接相关类型/辅助逻辑
│  ├─ debug/          # 调试命令、预设、文本状态
│  ├─ deploy/         # 部署页动作、类型、状态模型
│  ├─ framebuffer/    # framebuffer 局部面板、文件工作区、视频控制
│  ├─ mipi/           # MIPI/OLED 相关局部组件与逻辑
│  └─ ...
├─ tabs/              # 页面级入口
└─ utils/             # Tauri invoke、格式化等通用工具
```

整理原则：
- 页面文件别继续无限变胖
- 重复逻辑优先收进 `features/`
- 不做“为了拆而拆”的空壳模块

---

## 4. 后端模块职责

Rust 后端原来大量逻辑堆在 `src-tauri/src/lib.rs` 里，现在已经完成多轮拆分。`lib.rs` 当前主要负责模块装配、共享类型定义和 Tauri 命令注册。

### 当前状态

```text
src-tauri/src/
├─ action_result.rs       # 统一业务动作结果和错误结构
├─ adb.rs                 # ADB 底层封装、设备解析、shell/push、静态 IP 内部逻辑
├─ adb_commands.rs        # ADB Tauri 命令
├─ deploy_commands.rs     # 部署、远端文件工作区、开机脚本、运行模式切换
├─ display_actions.rs     # 显示/OLED 配置相关业务动作层
├─ display_runtime.rs     # 图片显示、运行时图案、视频控制 Tauri 命令
├─ framebuffer_commands.rs  # 设备探测、旧 framebuffer 测试图、电源读取
├─ host_env.rs            # 宿主机侧环境/网卡信息读取
├─ lib.rs                 # 类型定义、模块装配、Tauri 命令注册
├─ mipi_commands.rs       # MIPI 快捷命令和批量命令
├─ network_commands.rs    # 静态 IP 命令
├─ oled_config.rs         # OLED 配置导入/导出、timing bin、下载重启命令
├─ preset_commands.rs     # 命令预设读写
├─ remote_runtime.rs      # ADB shell/push/python/video 远端运行时适配层
├─ resources.rs           # 项目资源路径解析
├─ shell_utils.rs         # shell 参数转义
├─ ssh_commands.rs        # 可选 SSH 命令
├─ state.rs               # ConnectionState
└─ main.rs
```

### 已明确的模块职责

#### `lib.rs`

当前仍是主入口，负责：
- Tauri 命令注册与导出
- 共享请求 / 响应类型定义
- 模块声明和命令引入
- `ConnectionState` 注入

业务逻辑不要继续往 `lib.rs` 里堆。新命令优先放到对应职责模块，再在 `lib.rs` 注册。

#### `host_env.rs`

负责：
- 本机网络信息读取
- Windows / Unix 分支差异处理
- 本机环境探测这一类“宿主机侧能力”

之所以不用 `network.rs`，是因为这块职责不只是网络，后面还可能继续挂：
- 本机路径探测
- 本机环境能力检查
- 宿主机侧系统信息读取

`host_env` 比 `network` 更贴真实职责。

### 已经落地的拆分

#### `oled_config.rs`

已经承接：
- 旧 `.bin` 点屏配置解析
- OLED `.json` 配置解析
- `vis-timing.bin` 生成
- OLED 配置 json 导出
- `PCLK` 单位换算相关逻辑
- OLED 配置下载到 `/vismm/vis-timing.bin`
- 执行 `repack_initrd.sh && sync` 并触发重启

#### `display_runtime.rs`

已经承接：
- 本地 BMP push + show
- 远端 BMP show
- framebuffer 运行时显示链路
- 运行时测试图同步与显示
- 视频播放、状态查询和控制
- base64 图片临时写入后上屏

#### `display_actions.rs` / `remote_runtime.rs` / `action_result.rs`

已经开始承接显示和配置链路的分层：
- `display_actions.rs` 放业务动作，例如生成 timing bin、显示图片、同步运行时脚本、视频控制
- `remote_runtime.rs` 放传输适配，例如 ADB shell、push、运行工程 Python、启动视频脚本
- `action_result.rs` 放统一的动作结果和错误结构

#### `deploy_commands.rs`

已经承接：
- `Install tools`
- `Install App`
- 默认图片 / 默认视频部署
- multi-user / graphical 运行模式切换
- 远端文件列表、上传、运行脚本、设置 autorun、删除、停止脚本
- `i2c4-m2` overlay 保守修复

#### `mipi_commands.rs`

已经承接：
- 单条 `vismpwr` 命令下发
- 多条初始化代码批量下发
- Software Reset
- 读取 power mode
- sleep in / sleep out

#### `framebuffer_commands.rs`

已经承接：
- ADB 设备探测
- 旧 framebuffer 测试图命令
- 逻辑图和文字显示
- 电源轨读取
- 本地图片目录和预览辅助命令

原则：
- 按职责拆，不按“文件长度”硬拆
- 先拆最容易继续膨胀的块
- 每拆一步都先 build/check 验证

### 当前 Tauri 命令注册分组

当前 `lib.rs` 里注册的命令可以按职责理解为：

```text
ADB:
adb_devices, adb_select_device, adb_connect, adb_disconnect,
adb_shell, adb_push, adb_pull, adb_probe_device

宿主机 / 网络:
get_local_network_info, set_static_ip

SSH:
ssh_connect, ssh_exec

framebuffer / 显示:
display_solid_color, display_gradient, display_color_bar, display_checkerboard,
sync_runtime_patterns, run_runtime_pattern, read_power_rails,
pick_image_directory, create_image_preview, list_images_in_directory,
run_demo_screen, run_logic_pattern, display_text,
display_image_from_base64, display_remote_image, display_image,
setup_loop_images, play_video, get_video_playback_status, send_video_control

MIPI / OLED:
mipi_send_command, mipi_send_commands, mipi_software_reset,
mipi_read_power_mode, mipi_sleep_in, mipi_sleep_out, clear_screen,
pick_lcd_config_file, parse_legacy_lcd_bin, generate_timing_bin,
export_oled_config_json, download_oled_config_and_reboot

预设:
load_cmdx_list, save_cmdx_list, load_command_presets, save_command_presets

部署 / 远端文件:
deploy_install_tools, deploy_install_app, deploy_set_default_pattern,
deploy_set_default_movie, deploy_set_multi_user, deploy_set_graphical,
list_remote_files, upload_file_base64, run_remote_script,
stop_remote_script, set_script_autorun, delete_remote_file
```

注意：`deploy_enable_ssh` 目前只存在于前端动作列表，未在这里注册。

---

## 5. 关键单位约定

这块很重要，后续不要再混。

### `PCLK`

**统一约定：**

- UI 中：`kHz`
- bin / json 文件中：`Hz`

也就是：
- 用户在界面里看到和编辑的是 `125240`
- 真正写进文件里的是 `125240000`

### 为什么这样定

因为：
- UI 里用 Hz 数字太大，不利于编辑
- 旧 bin / 导出文件实际保存的是 Hz
- FPS 计算逻辑已经按 UI 的 kHz 在跑：
  - `fps = (timing.pclk * 1000) / htotal / vtotal`

### 当前已经对齐好的三条链路

#### 1. 旧 `.bin` 导入
- `Hz -> kHz`

#### 2. 生成 `vis-timing.bin`
- `kHz -> Hz`

#### 3. 导出 OLED 配置 json
- `kHz -> Hz`

这三条现在必须保持同步，不能只修一半。

---

## 6. 关键路径约定

### 6.1 工程与产物

- 项目根目录：`E:\ai2026\Big8K-Tauri-UI`
- Rust 后端：`E:\ai2026\Big8K-Tauri-UI\src-tauri`
- Debug exe：`E:\ai2026\Big8K-Tauri-UI\src-tauri\target\debug\Big8K.exe`

### 6.2 C# 参考工程

- `E:\Resource\8Big8K\8K_software\PC-SW`

凡是 Tauri 版本行为拿不准的地方，优先对照旧 C# 真实逻辑，不靠猜。

### 6.3 framebuffer / BMP 相关路径

本地 BMP 上屏当前对齐的关键远端目录：

- `/vismm/fbshow/bmp_online/`
- 非 BMP 临时图片目录：`/data/local/tmp/big8k_images/`
- 视频在线目录：`/vismm/fbshow/movie_online/`
- 运行时测试图目录：`/vismm/fbshow/big8k_runtime/`
- OLED timing 文件：`/vismm/vis-timing.bin`

远端显示命令：

```bash
./vismm/fbshow/fbShowBmp /vismm/fbshow/bmp_online/{fileName}
```

### 6.4 Python 运行脚本路径

工程内关键脚本示例：
- `python/fb_image_display.py`
- `python/runtime_fbshow/render_patterns.py`
- `python/board_fbshow/videoPlay.py`

运行时临时下发路径示例：
- `/data/local/tmp/fb_image_display.py`

---

## 7. 这两天踩过并已经定下来的调试细节

这部分专门写给后续接手的人，省得再踩一遍。

### 7.1 不要用 PowerShell 批量替换源码

已经验证过会引发：
- 中文字符编码污染
- 文件内容损坏
- 回滚成本变高

当前约定：
- **只用精确小步 edit**
- 一次只改一小块
- 每改完立刻 build/check

### 7.2 Windows 本机网络信息不要自动预取

原因：
- 会拖慢 exe 启动
- 用户并不是每次启动都需要看本机 IP

当前实现：
- 点击时才执行
- Windows 走：

```bash
cmd /C chcp 65001>nul & ipconfig
```

### 7.3 Windows 网络信息不要再走 PowerShell 编码链

已踩坑：
- 之前乱码
- 解析不稳

当前做法：
- 后端直接解析 `ipconfig`
- 返回结构化 `LocalNetworkInfo`

### 7.4 网卡展示规则已经定死

只显示：
- 有线 / 无线网卡
- IPv4

排除：
- VMware
- vEthernet
- WSL
- Docker / veth / virbr
- 蓝牙
- 其他虚拟网卡

### 7.5 本地 BMP 上屏必须严格对齐 C#

不要偷懒做缓存命中。

当前要求：
- 先 push
- 再 `fbShowBmp`
- **每次双击都重新 push**

因为这才符合旧上位机的直觉和现场调试预期。

### 7.6 “打开 OLED 配置”保持单入口双格式

不要拆成两个按钮。

当前要求：
- 一个入口
- 自动兼容：
  - `.bin`
  - `.json`

### 7.7 MIPI 快捷命令区已经做了防误触

当前危险操作：
- `关屏`
- `开屏`
- `Software Reset`

已经落实：
- 单独分区
- 点击二次确认

但按当前 UI 决策：
- 去掉“高风险操作”标题
- 去掉一堆解释文案
- 只保留分区样式 + 确认弹窗

### 7.8 默认验证动作

除非另行说明，代码调整后默认执行：

1. `cargo build`
2. 重新拉起 exe

### 7.9 install tools 里的 i2c4-m2 保守修复

针对部分 `RK3588 boot.img` 版本缺少：

- `/boot/dtb/overlay/rk3588-i2c4-m2-overlay.dtbo`

当前 `Install tools` 已额外带上一条保守修复链，只处理 `i2c4-m2`，**不改显示相关 overlay**。

执行逻辑如下：

1. 先检查 `/dev/i2c-4` 是否存在
2. 如果已经存在：
   - 直接跳过 `i2c4-m2` 修复
3. 如果不存在：
   - 检查 `/boot/dtb/overlay/rk3588-i2c4-m2-overlay.dtbo` 是否存在
   - 若缺失，则从资源区补推过去
4. 再检查 `/boot/uEnv/uEnv.txt` 是否已启用：
   - `dtoverlay  =/dtb/overlay/rk3588-i2c4-m2-overlay.dtbo`
5. 若未启用：
   - 仅对 `uEnv.txt` 做最小修改
   - 保留原文件换行风格
   - 不改显示相关 `dtoverlay`
6. 修复完成后：
   - 仅提示用户**手动重启**，不自动重启

补充说明：
- 当前板端验证表明，boot 流程从 `/boot/uEnv/uEnv.txt` 读取 overlay 配置，因此本修复只处理 `uEnv.txt`
- 资源文件当前放在：`resources/deploy/dist-packages/rk3588-i2c4-m2-overlay.dtbo`

这是当前项目约定，不再每次重复确认。

---

## 8. 开发环境与常用命令

### 安装前端依赖

```bash
npm install
```

### 仅构建前端

```bash
npm run build
```

### Rust 检查

```bash
cd src-tauri
cargo check
```

### 构建 debug exe

```bash
cd src-tauri
cargo build
```

### 开发模式运行

```bash
npm run tauri dev
```

### 仅生成 release exe

```bash
cd src-tauri
cargo build --release --bin Big8K
```

---

## 9. SSH feature 说明

Rust 后端的 SSH 能力目前是 **可选 feature**。

### 默认构建
- 不包含 SSH
- 更适合只做 ADB / framebuffer / MIPI 调试

### 启用 SSH

```bash
cd src-tauri
cargo run --features ssh --bin Big8K
```

或：

```bash
npm run tauri dev -- --features ssh
```

如果只是验证是否能成功编译带 SSH 的桌面程序，可直接执行：

```bash
cd src-tauri
cargo build --features ssh
```

已验证说明：
- `ssh2 / libssh2` 依赖链可以正常进入编译
- 在 Windows 上如果 `Big8K.exe` 正在运行，`cargo build --features ssh` 可能会因无法覆盖目标文件而失败：`拒绝访问。 (os error 5)`
- 处理方式：先结束正在运行的 `Big8K.exe`，再重新执行 `cargo build --features ssh`

如果未启用 SSH feature：
- 程序能正常启动
- ADB 相关能力不受影响
- 调 SSH 命令时会提示当前构建未启用 SSH

---

## 10. 接手建议

如果你是第一次接手这个项目，推荐按下面顺序读：

1. `src/components/ConnectionPanel.tsx` / 连接主流程
2. `src/features/connection/` / ADB、SSH、日志和连接类型
3. `src/tabs/MipiTab.tsx` + `src/features/mipi/` / OLED 配置、Timing、快捷命令
4. `src/tabs/FramebufferTab.tsx` + `src/features/framebuffer/` / BMP、测试图、远端文件和视频链路
5. `src/features/deploy/` / 部署动作和网络配置
6. `src-tauri/src/lib.rs` / 类型定义和命令注册
7. `src-tauri/src/adb.rs` + `src-tauri/src/adb_commands.rs`
8. `src-tauri/src/oled_config.rs` + `src-tauri/src/display_actions.rs`
9. `src-tauri/src/display_runtime.rs` + `src-tauri/src/remote_runtime.rs`
10. `src-tauri/src/deploy_commands.rs`
11. `src-tauri/src/mipi_commands.rs`
12. `src-tauri/src/framebuffer_commands.rs`
13. 旧 C# 工程对照实现

别一上来就全局大重构，先抓住：
- 页面职责
- 后端职责
- 单位约定
- 路径约定
- 与旧 C# 的行为一致性

---

## 11. 后续 README / Skill 方向

后面可以继续往两条线补：

### 11.1 README 继续增强

可以再补：
- 各页面和旧 C# 页面的一一映射
- 常用调试操作手册
- 常见报错排查清单
- 板端依赖清单
- 视频链路和 BMP 链路的详细时序说明

### 11.2 生成 8K 点屏相关 skill

这块很值得做，后续可以基于这份 README 和现有代码/约定，整理出一个专门的 skill，例如：

- `big8k-panel-debug`
- `oled-panel-bringup`
- `8k-display-debug`

skill 里可以固化：
- 页面职责
- 后端模块职责
- `PCLK` 单位约定
- 远端路径约定
- BMP / MIPI / OLED 配置链路
- 与旧 C# 对齐原则
- 常见误操作防护规则

这样后面无论是新同事接手，还是让 Agent 继续迭代，都不需要每次重新口头交代一遍。

---

## 12. 当前结论

这个工程现在**不是不能维护**，但已经出现“再继续堆就会变屎山”的前兆。

所以当前整理策略是：
- 不搞大爆炸重构
- 先拆最容易继续膨胀的块
- 先写清约定
- 先把高频坑点固化进 README
- 让后续每次改动都更可控

如果后面继续整理，优先级建议仍然是：

1. `host_env` 继续稳住
2. 补齐或移除 `deploy_enable_ssh`
3. 继续瘦身 `FramebufferTab.tsx`
4. 把部署链路进一步按清单/动作边界收口
5. 继续把页面内重复逻辑往 `features/` 收

---

如果你是现在要直接开始干活的人，先记住五句话：

- **MipiTab 是当前主入口，HomeTab 看状态，DeployTab 做动作**
- **UI 里的 PCLK 是 kHz，文件里的 PCLK 是 Hz**
- **本地 BMP 每次都重新 push，再 fbShowBmp**
- **`deploy_enable_ssh` 现在是前端入口有、后端命令无**

---

## 12. 2026-05-04 文档与审查索引

本次按 `AGENTS.md` 固化了项目级工作习惯：先想清楚、保持简单、做外科手术式修改、以验证闭环为准。该指南吸收了 `kgp0213/andrej-karpathy-skills` 中关于 LLM 编码常见误区的实践约束，并结合本项目硬件调试场景补充了 Big8K 专属规则。

新增/整理的交接入口：

- `AGENTS.md`：后续 Agent / Codex 工作指南。
- `docs/README.md`：docs 目录索引。
- `docs/source-review-2026-05-04.md`：源码审查发现清单。
- `docs/cleanup-candidates-2026-05-04.md`：垃圾文件清理和保留候选记录。
- `docs/release-code-review-2026-05-03.md`：release 产物审查记录。
- `docs/release-packaging-recommendations-2026-05-03.md`：release 打包建议。

当前源码审查没有直接改运行逻辑，重点先记录风险：`deploy_enable_ssh` 前后端断线、远程脚本参数拼接、远程删除/kill 操作过宽、硬编码 SSH 密码、Tauri CSP / shell 权限偏宽、OLED 配置下载会触发高影响板端操作、loop image 参数未真正贯通等。后续修复应按风险高低拆成独立小任务处理。
- **别再用 PowerShell 批量替换源码**
