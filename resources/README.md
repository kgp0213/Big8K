# 资源维护指南

本目录存放部署到 8K 平台的所有资源文件，采用清单驱动的方式管理部署内容。

---

## 📁 目录结构

```
resources/
├── deploy/
│   ├── manifests/                    # 部署清单（JSON）
│   │   ├── install-tools.json        # Install tools 部署清单
│   │   └── install-app.json          # Install App 部署清单
│   │
│   ├── dist-packages/                # Python 包和系统工具
│   │   ├── cpio_xxx.deb              # deb 包
│   │   ├── repack_initrd.sh          # 脚本
│   │   └── serial/                   # pyserial 库
│   │
│   ├── python-libs/                  # Python whl 文件
│   │   ├── Pillow-xxx.whl
│   │   └── smbus2-xxx.whl
│   │
│   ├── fb-operate/                   # 刷图应用脚本和工具
│   │   ├── *.py                      # Python 脚本
│   │   ├── *.sh                      # Shell 脚本
│   │   └── fbShowBmp 等二进制        # 可执行文件
│   │
│   └── fb-RunApp/                    # 运行时应用
│       └── default/
│
└── README.md                         # 本文件
```

---

## 🚀 快速开始

### 新增 Python whl 库

1. **下载 whl 文件**（必须是 aarch64/manylinux 版本）
   ```bash
   # 示例：下载 numpy
   pip download numpy --platform manylinux2014_aarch64 --python-version 38 --only-binary=:all:
   ```

2. **放到对应目录**
   ```
   resources/deploy/python-libs/numpy-xxx.whl
   ```

3. **更新清单文件** `manifests/install-tools.json`
   ```json
   {
     "name": "install_python_libs",
     "whl_files": [
       "Pillow-9.5.0-xxx.whl",
       "smbus2-0.5.0-xxx.whl",
       "numpy-xxx.whl"    // 新增
     ]
   }
   ```

### 新增 Python 脚本

1. **编写脚本**
   ```python
   # my_script.py
   import os
   print("Hello from 8K platform")
   ```

2. **放到对应目录**
   ```
   resources/deploy/fb-operate/my_script.py
   ```

3. **清单会自动包含**（无需修改清单）

### 新增二进制工具

1. **准备二进制文件**（必须是 arm64 架构）
   ```bash
   # 确认架构
   file my_binary
   # 输出应包含：ELF 64-bit LSB executable, ARM aarch64
   ```

2. **放到对应目录**
   ```
   resources/deploy/fb-operate/my_binary
   ```

3. **确认可执行权限**（部署时会自动设置）

### 新增 deb 包

1. **下载 deb 包**（必须是 arm64 架构）
   ```bash
   apt-get download package:arm64
   ```

2. **放到对应目录**
   ```
   resources/deploy/dist-packages/package_xxx_arm64.deb
   ```

3. **更新清单文件**
   ```json
   {
     "name": "install_new_package",
     "description": "安装新软件包",
     "local_file": "resources/deploy/dist-packages/package_xxx_arm64.deb",
     "remote_path": "/tmp/package/",
     "action": "dpkg_install"
   }
   ```

---

## 📋 部署清单格式

### action 类型

| action | 说明 | 参数 |
|--------|------|------|
| `push_dir` | 推送整个目录 | `local_path`, `remote_path`, `set_executable` |
| `pip_install_whl` | 安装 Python whl | `local_path`, `remote_path`, `whl_files` |
| `dpkg_install` | 安装 deb 包 | `local_file`, `remote_path` |
| `shell_exec` | 执行 shell 命令 | `command` |

### 完整示例

```json
{
  "version": "1.0.0",
  "description": "部署清单说明",
  "steps": [
    {
      "name": "step_name",
      "description": "步骤描述",
      "action": "push_dir",
      "local_path": "resources/deploy/xxx",
      "remote_path": "/vismm/xxx",
      "set_executable": true
    }
  ],
  "verify_commands": [
    {
      "description": "验证说明",
      "command": "ls /vismm/xxx",
      "expected_output_contains": "expected"
    }
  ]
}
```

---

## 🔧 部署按钮对应关系

| 按钮 | 清单文件 | 主要内容 |
|------|---------|----------|
| Install tools | `install-tools.json` | Python 库、系统工具（cpio等） |
| Install App | `install-app.json` | 刷图脚本、二进制工具 |

---

## 📦 打包发布

### 自动包含

`tauri.conf.json` 已配置：
```json
{
  "bundle": {
    "resources": ["../resources/**"]
  }
}
```

打包时会自动包含所有 `resources/` 目录下的文件。

### 手动打包测试

```bash
npm run tauri build
```

生成的 exe 包含所有资源文件。

---

## 🔍 验证部署

部署后可通过以下方式验证：

```bash
# SSH 或 ADB 连接设备后

# 检查 Python 库
python3 -c "from PIL import Image; print(Image.__version__)"

# 检查脚本
ls -la /vismm/fbshow/*.py

# 检查二进制
/vismm/fbshow/fbShowBmp --help
```

---

## ⚠️ 注意事项

1. **架构兼容性**
   - 所有二进制和 whl 文件必须是 **aarch64/arm64** 架构
   - 验证命令：`file your_file`

2. **Python 版本**
   - 目标平台 Python 版本：**3.8+**
   - whl 文件应选择 `cp38` 或更高版本

3. **文件大小**
   - 单个文件建议 < 50MB
   - 超大文件考虑外部下载

4. **权限**
   - 脚本和二进制文件会自动设置可执行权限
   - 目录权限设为 777

5. **Git 管理**
   - 清单文件（`.json`）必须提交
   - 大型二进制文件考虑 `.gitignore`

---

## 📝 维护流程

1. **新增/更新资源**
   - 放到对应目录
   - 更新清单文件（如需要）

2. **本地测试**
   ```bash
   npm run tauri dev
   # 点击部署按钮测试
   ```

3. **提交代码**
   ```bash
   git add resources/
   git commit -m "feat: add new python library xxx"
   ```

4. **版本发布**
   ```bash
   npm run tauri build
   ```

---

## 📞 问题排查

### 部署失败

1. 检查 ADB 连接：`adb devices`
2. 检查设备空间：`adb shell df -h`
3. 检查文件权限：`adb shell ls -la /vismm/`

### Python 库导入失败

```bash
# 检查 Python 路径
adb shell which python3

# 检查库路径
adb shell python3 -c "import sys; print(sys.path)"

# 手动测试导入
adb shell python3 -c "from PIL import Image"
```

### 二进制无法执行

```bash
# 检查架构
adb shell file /vismm/fbshow/your_binary

# 检查权限
adb shell chmod +x /vismm/fbshow/your_binary
```