# Big8K Tauri UI

Big8K Tauri UI 是 8K OLED 点屏平台的新一代上位机，基于 **Tauri + React + TypeScript + Rust**。

它的目标不是另起炉灶重写一套工具，而是把旧版 **C# WinForms 上位机**里真正高频、关键、容易继续维护的链路，逐步迁到一个更轻、更清晰、更容易扩展的桌面应用里。

- 旧版 C# 工程：`E:\Resource\8Big8K\8K_software\PC-SW`
- 新版 Tauri 工程：`E:\ai2026\Big8K-Tauri-UI`

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
- 部署辅助操作

设计原则：
- 这里是“动手”的地方，不再承担首页状态总览职责
- 本机网络信息**点击时才查询**，不在启动时自动预取，避免拖慢 exe 启动

### `FramebufferTab`

**职责：framebuffer 画面与媒体调试**

主要放：
- 纯色 / 渐变 / 测试图
- 本地 BMP 上屏
- 远端 BMP 列表读取与显示
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

---

## 3. 前端结构约定

前端现在采用：
- `tabs/` 负责页面壳和布局编排
- `features/` 负责具体业务模块、类型、动作、局部组件、存储逻辑

当前已经较明确的模块包括：

```text
src/
├─ components/        # 跨页面通用组件
├─ features/
│  ├─ connection/     # 连接相关类型/辅助逻辑
│  ├─ mipi/           # MIPI/OLED 相关局部组件与逻辑
│  ├─ code-convert/   # 代码转换
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

Rust 后端原来大量逻辑堆在 `src-tauri/src/lib.rs` 里，已经开始做第一轮拆分。

### 当前状态

```text
src-tauri/src/
├─ lib.rs        # Tauri 命令注册、主流程、暂存的核心逻辑
├─ host_env.rs   # 宿主机侧环境/网卡信息读取
└─ main.rs
```

### 已明确的模块职责

#### `lib.rs`

当前仍是主入口，负责：
- Tauri 命令注册与导出
- 连接状态管理
- ADB / SSH 主流程
- 当前尚未拆出的显示运行逻辑
- 当前尚未拆出的 OLED 配置链路

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

### 后续计划中的拆分方向

#### `oled_config.rs`

计划承接：
- 旧 `.bin` 点屏配置解析
- OLED `.json` 配置解析
- `vis-timing.bin` 生成
- OLED 配置 json 导出
- `PCLK` 单位换算相关逻辑

#### `display_runtime.rs`

计划承接：
- 本地 BMP push + show
- 远端 BMP show
- framebuffer 运行时显示链路
- 后续视频 / 图片显示相关运行逻辑

原则：
- 按职责拆，不按“文件长度”硬拆
- 先拆最容易继续膨胀的块
- 每拆一步都先 build/check 验证

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

远端显示命令：

```bash
./vismm/fbshow/fbShowBmp /vismm/fbshow/bmp_online/{fileName}
```

### 6.4 Python 运行脚本路径

工程内关键脚本示例：
- `python/fb_image_display.py`

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

1. `ConnectionPanel` / 连接主流程
2. `HomeTab` / 当前设备状态展示
3. `FramebufferTab` / BMP 与视频链路
4. `MipiTab` / OLED 配置、Timing、快捷命令
5. `src-tauri/src/lib.rs`
6. `src-tauri/src/host_env.rs`
7. 旧 C# 工程对照实现

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
2. 拆 `oled_config`
3. 拆 `display_runtime`
4. 继续把页面内重复逻辑往 `features/` 收

---

如果你是现在要直接开始干活的人，先记住四句话：

- **HomeTab 看状态，DeployTab 做动作**
- **UI 里的 PCLK 是 kHz，文件里的 PCLK 是 Hz**
- **本地 BMP 每次都重新 push，再 fbShowBmp**
- **别再用 PowerShell 批量替换源码**
