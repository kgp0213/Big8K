# PC-SW 迁移说明

更新时间：2026-05-04  
旧工程：`E:\Resource\8Big8K\8K_software\PC-SW`  
新工程：`E:\ai2026\Big8K-Tauri-UI`

本文重写自 2026-03-28 至 2026-03-30 的迁移笔记，保留仍然影响当前工程的事实和约定。

## 1. 迁移目标

旧 C# WinForms 工程承担了现场 8K OLED 点屏调试的主流程。Tauri 版不是推翻重写，而是迁移这些已验证链路：

- ADB 连接、TCP 连接、shell、push、pull。
- MIPI / OLED 初始化命令和 `vis-timing.bin` 生成。
- Framebuffer 图案、BMP、视频、逻辑图显示。
- 配置部署、静态 IP、systemd 自启、运行模式切换。
- 电源读取和 I2C 辅助链路。

迁移优先级始终是：先对齐旧 C# 的真实行为，再考虑 UI 和代码结构优化。

## 2. 当前资源目录

部署资源已统一迁移到：

```text
resources/deploy/
  manifests/
    index.json
    install-tools.json
    install-app.json
  dist-packages/
  python-libs/
  fb-operate/
  fb-RunApp/
```

不要再从旧根目录名 `fb_operate/`、`fb_RunApp/`、`Python_lib/` 推断资源路径。当前后端应通过资源解析函数读取 `resources/deploy/...`。

## 3. 旧资源到新目录的映射

| 旧 C# 资源 | 新 Tauri 资源 |
|---|---|
| `dist-packages/` | `resources/deploy/dist-packages/` |
| `Python_lib/` | `resources/deploy/python-libs/` |
| `fb_operate/` | `resources/deploy/fb-operate/` |
| `fb_RunApp/default/` | `resources/deploy/fb-RunApp/default/` |
| `fb_RunApp/default_bmp/` | `resources/deploy/fb-RunApp/default_bmp/` |
| `fb_RunApp/default_movie/` | `resources/deploy/fb-RunApp/default_movie/` |
| `Resources/*network-manager*.yaml` | `resources/*network-manager*.yaml` |

## 4. Install tools 行为

旧 C# 对应入口：`btn_Pythonlib_download_Click`。

当前 Tauri 版应承担两类职责：

1. 初始化板端关键目录。
2. 部署 Python 库、系统工具和 initrd 辅助文件。

至少需要确认这些远端目录存在：

```text
/vismm/
/vismm/fbshow/
/vismm/fbshow/default/
/vismm/fbshow/bmp_online/
```

主要资源：

- `resources/deploy/dist-packages/serial/` → 板端 Python dist-packages。
- `resources/deploy/python-libs/*.whl` → `/vismm/Python_lib/` 后本地 pip 安装。
- `cpio_2.13+dfsg-2ubuntu0.4_arm64.deb` → `/tmp/cpio/` 后 `dpkg -i`。
- `repack_initrd.sh` → `/vismm/tools/` 或部署约定位置。
- `rk3588-i2c4-m2-overlay.dtbo` → 板端 overlay 相关路径。

## 5. Install App 行为

旧 C# 对应入口：`btn_APP_download_Click`。

目标是把显示相关工具和脚本部署到 `/vismm/fbshow/`，典型内容包括：

- `fbShowBmp`
- `fbShowMovie`
- `fbShowPattern`
- `vismpwr`
- `xdotool`
- `disableService.sh`
- `repack_initrd.sh`
- `autorunUSB.py`
- `logicPictureShow.py`
- `framebuffer_screenshot.py`
- `videoPlay.py`
- `chenfeng_movie.py`
- `adaptive_screen_streamer.py`
- `adaptive_stream_receiver.py`
- `Mouse_crossLine.py`

未跟踪的 `two_pattern_pageflip_loop.py` 和 `two_pattern_smooth_loop.py` 目前先作为待确认部署脚本保留，后续需要决定是否纳入正式资源说明。

## 6. Autorun Bundle 行为基线

旧 C# 的 `ADB_AutorunApp_Setup(app_path)` 对 `default`、`default_bmp`、`default_movie` 采用同一类步骤：

1. 删除 `/vismm/autorun.py`。
2. push 当前 bundle 的 `autorun.py` 到 `/vismm/fbshow/autorun.py`。
3. `chmod 444 /vismm/fbshow/autorun.py`。
4. push 同一份 `autorun.py` 到 `/vismm/autorun.py`。
5. `chmod 444 /vismm/autorun.py`。
6. service 文件固定来自 `default` 目录。
7. push service 到 `/etc/systemd/system/`。
8. `systemctl daemon-reload`。
9. `systemctl enable ...`。
10. `systemctl restart ...`。

这意味着 `视频播放` 类默认动作不是“播放当前选中文件”，而是部署 `default_movie` autorun bundle。

## 7. 已做过命令级验证的动作

这些动作在迁移过程中有过命令级等价验证：

- 设置静态 IP：`192.168.1.100/24`。
- 设置静态 IP：`192.168.137.100/24`。
- `systemctl set-default graphical.target`。
- `systemctl set-default multi-user.target`。
- 开启 SSH 的板端命令路径曾被验证，但当前 Tauri 后端没有注册 `deploy_enable_ssh`，不能视为 UI 已可用。

## 8. 仍需最终真机验证的动作

- `deploy_install_tools`
- `deploy_install_app`
- `deploy_set_default_pattern`
- `deploy_set_default_movie`
- `setup_loop_images`

## 9. 维护约束

- 新增资源先放入 `resources/deploy/` 对应目录，再更新 `resources/README.md`。
- 资源同名不代表内容一致，关键脚本要和旧 C# 工程做哈希或文本比对。
- 部署动作不要依赖 Framebuffer 文件工作区的当前选中状态。
- 所有会改变启动模式、service、initrd、IP、SSH 的动作都应在 UI 和日志中可见。

