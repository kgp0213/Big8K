# PC-SW 迁移笔记（更新于 2026-03-30）

---

## 资源目录重组（2026-03-30）

### 新的目录结构

```
resources/
├── README.md                         # 统一维护指南
├── deploy/
│   ├── manifests/                    # 部署清单（JSON）
│   │   ├── index.json                # 清单索引
│   │   ├── install-tools.json        # Install tools 清单
│   │   └── install-app.json          # Install App 清单
│   │
│   ├── dist-packages/                # Python 包和系统工具
│   │   ├── cpio_xxx.deb
│   │   ├── repack_initrd.sh
│   │   └── serial/                   # pyserial 库
│   │
│   ├── python-libs/                  # Python whl 文件
│   │   ├── Pillow-9.5.0-xxx.whl
│   │   └── smbus2-0.5.0-xxx.whl
│   │
│   ├── fb-operate/                   # 刷图应用脚本和工具
│   │   ├── *.py                      # Python 脚本
│   │   ├── *.sh                      # Shell 脚本
│   │   └── fbShowBmp 等二进制        # 可执行文件
│   │
│   └── fb-RunApp/                    # 运行时应用
│       └── default/
│
└── 01-network-manager-all.yaml       # 网络配置模板
```

### 清单驱动部署

每个部署按钮对应一个清单文件：

| 按钮 | 清单文件 | 主要内容 |
|------|---------|----------|
| Install tools | `install-tools.json` | Python 库、系统工具 |
| Install App | `install-app.json` | 刷图脚本、二进制工具 |

### 如何新增内容

**新增 Python 库：**
```bash
# 1. 放到 python-libs/ 目录
cp new_lib.whl resources/deploy/python-libs/

# 2. 更新清单文件
# 编辑 install-tools.json，在 whl_files 数组中添加文件名
```

**新增脚本：**
```bash
# 1. 放到 fb-operate/ 目录
cp new_script.py resources/deploy/fb-operate/

# 2. 清单会自动包含（无需修改）
```

**新增二进制工具：**
```bash
# 1. 放到 fb-operate/ 目录（必须是 arm64 架构）
cp new_binary resources/deploy/fb-operate/

# 2. 清单会自动包含（无需修改）
```

**新增 deb 包：**
```bash
# 1. 放到 dist-packages/ 目录
cp new_package_arm64.deb resources/deploy/dist-packages/

# 2. 更新清单文件，新增一个 dpkg_install 步骤
```

详细说明见：`resources/README.md`

---

## 配置部署页功能映射补充

### 已迁入当前 Tauri 工程的旧版资源
已从 `E:\Resource\8Big8K\8K_software\PC-SW` 迁入以下目录/文件到 `E:\ai2026\Big8K-Tauri-UI`：

- `dist-packages/`
- `Python_lib/`
- `fb_operate/`
- `fb_RunApp/default/`
- `Resources/01-network-manager-all.yaml`
- `Resources/02-network-manager-all.yaml`
- `Resources/03-network-manager-all.yaml`

---

## Install tools 功能详解（btn_Pythonlib_download_Click）

### 功能概述
Install tools 负责在 8K 平台上部署 Python 运行环境和必要的工具库。

### 执行步骤

#### 步骤 1: 上传 dist-packages 目录
```csharp
string str = System.Environment.CurrentDirectory + "\\" + "dist-packages\\.";
_commonControl.ADB_PythonApp_Setup(str);
```
- 将 `dist-packages` 目录整体上传到设备
- 包含：
  - `cpio_2.13+dfsg-2ubuntu0.4_arm64.deb`
  - `repack_initrd.sh`
  - `serial/` (pyserial 库)

#### 步骤 2: 安装 Python whl 文件
```csharp
string whlPath = System.Environment.CurrentDirectory + "\\Python_lib";
string res = InstallWhlFilesFromDirectory(whlPath, "/vismm/Python_lib");
```

InstallWhlFilesFromDirectory 详细逻辑：
1. 创建远程目录并设置权限：
   ```bash
   adb shell "mkdir -p /vismm/Python_lib && chmod 777 /vismm/Python_lib"
   ```
2. 遍历本地 `Python_lib/` 目录下所有 `.whl` 文件：
   - 上传：`adb push {whlFile} /vismm/Python_lib/`
   - 安装：`adb shell "cd /vismm/Python_lib && pip install --no-index --find-links=. {fileName}"`
3. 验证安装：
   ```bash
   adb shell "python3 -c \"from PIL import Image; print(Image.__version__)\""
   ```

包含的 whl 文件：
- `Pillow-9.5.0-cp38-cp38-manylinux_2_17_aarch64.manylinux2014_aarch64.whl` (图像处理)
- `smbus2-0.5.0-py2.py3-none-any.whl` (I2C 通信)

#### 步骤 3: 安装 cpio deb 包
```csharp
string debFilePath = System.Environment.CurrentDirectory + @"/dist-packages/cpio_2.13+dfsg-2ubuntu0.4_arm64.deb";
string deviceTempDir = @"/tmp/cpio/cpio_2.13+dfsg-2ubuntu0.4_arm64.deb";
```

执行命令：
```bash
adb push dist-packages/cpio_2.13+dfsg-2ubuntu0.4_arm64.deb /tmp/cpio/
adb shell dpkg -i /tmp/cpio/cpio_2.13+dfsg-2ubuntu0.4_arm64.deb
adb shell dpkg -l | grep cpio   # 验证安装
```

### Tauri 后端实现要点

需要在 Rust 后端实现以下能力：
1. `adb_push_dir` - 推送整个目录
2. `adb_push_file` - 推送单个文件
3. `adb_shell_exec` - 执行 shell 命令
4. `pip_install_local` - 本地安装 whl 文件

---

## Install App 功能详解（btn_APP_download_Click）

### 功能概述
Install App 负责部署刷图应用脚本和相关工具到设备。

### 执行步骤

```csharp
string str = System.Environment.CurrentDirectory + "\\" + "fb_operate";
_commonControl.ADB_ShowApp_Setup(str);
```

### 包含的文件

**Python 脚本：**
- `adaptive_screen_streamer.py` - 自适应屏幕流传输
- `adaptive_stream_receiver.py` - 自适应流接收器
- `autorunUSB.py` - USB 自动运行脚本
- `chenfeng_movie.py` - 视频播放脚本
- `framebuffer_screenshot.py` - 帧缓冲截图
- `logicPictureShow.py` - 逻辑图显示
- `Mouse_crossLine.py` - 鼠标十字线
- `videoPlay.py` - 视频播放

**Shell 脚本：**
- `disableService.sh` - 禁用服务脚本
- `repack_initrd.sh` - 重新打包 initrd

**二进制工具：**
- `fbShowBmp` - 显示 BMP 图片
- `fbShowMovie` - 显示视频
- `fbShowPattern` - 显示测试图案
- `vismpwr` - 电源控制工具
- `xdotool` - X11 自动化工具

### 远程路径
文件会被推送到设备的 `/vismm/fbshow/` 目录。

---

## 配置部署页：已完成真机验证的功能

以下功能已在当前 8K 平台环境上做过命令级等价验证：

1. **设置 8K 平台 IP：192.168.1.100**
   - `netplan apply` 成功
   - 已确认配置文件内容切换为 `192.168.1.100/24`

2. **设置 8K 平台 IP：192.168.137.100**
   - `netplan apply` 成功
   - 已恢复当前板子配置到 `192.168.137.100/24`

3. **开启SSH登录**
   - 已确认 `sshd` 存在
   - 已写入：
     - `PermitRootLogin yes`
     - `PasswordAuthentication yes`
   - 已完成 root 密码设置与 ssh 服务重启

4. **graphical 图形界面**
   - `systemctl set-default graphical.target` 验证通过

5. **CMD line: multi-user**
   - `systemctl set-default multi-user.target` 验证通过
   - 当前设备已恢复回 `multi-user.target`

### 当前板端已确认存在的关键环境
- `/vismm`
- `/vismm/fbshow`
- `/usr/bin/python3`
- `/usr/bin/systemctl`
- `/etc/netplan/01-network-manager-all.yaml`
- `/etc/systemd/system/chenfeng-service.service`
- `/vismm/autorun.py`

### Install tools 的补充要求
用户新增要求：点击 **Install tools** 时，必须先检查并在缺失时创建以下关键目录：

- `/vismm/`
- `/vismm/fbshow/`
- `/vismm/fbshow/default`
- `/vismm/fbshow/bmp_online/`

这意味着 Tauri 版的 `Install tools` 不只是工具部署，还要承担一部分环境初始化职责。

### 尚未完成最终真机验证的项
- `Install tools`
- `Install App`
- `Set default pattern L128`

这些项还需继续对齐资源落位、上板路径与执行入口后，再做可信验证。
