# 配置部署 / DEMO 页面整理记录（2026-03-31）

> 目的：记录最近两天在“配置部署”页、DEMO 区、`default_movie` 资源迁移上的关键结论和踩坑，避免后续继续堆成屎山。

---

## 1. 页面与功能边界

### 配置部署页（`src/tabs/NetworkTab.tsx`）
当前页定位：
- 部署工具与资源下发
- 网络 / IP 初始化
- 平台模式切换

当前动作分组：
1. **基础环境**
   - `deploy_install_tools`
   - `deploy_install_app`
2. **默认显示与模式**
   - `deploy_set_default_pattern`
   - `deploy_set_multi_user`
   - `deploy_enable_ssh`
3. **系统UI**
   - `deploy_set_graphical`

### DEMO 区（`src/tabs/FramebufferTab.tsx` 的 `video` 子页）
保留 3 个独立动作：
1. `Set default pattern L128`
2. `循环播放图片`
3. `视频播放`

约束：
- 这 3 个动作都应当是**独立部署动作**
- 不要再和文件工作区 / 视频控制区做状态耦合
- `视频播放` 现在不应依赖：
  - `selectedFileName`
  - `remotePath`
  - `videoZoomMode`
  - `showFramerate`
  - 播放/暂停/停止联动区

---

## 2. 已踩过的坑

### 坑 1：浏览器效果和 exe 效果不一致
现象：
- 浏览器里看到 3 个分组
- exe 里最初只显示 2 个分组

根因：
- exe 没吃到最新前端代码，不是浏览器渲染错
- 重新 `npm run build` + 用**分离式**方式重新拉起 `tauri dev` 后，exe 与浏览器一致

结论：
- **布局是否正确，以浏览器确认结构、以 exe 确认最终观感**
- 如果两边不一致，优先怀疑 exe 没吃到最新前端，而不是先怀疑 CSS/渲染

### 坑 2：`tauri dev` 直接拉起时经常被 SIGKILL
现象：
- 编译完成前后进程经常被杀
- 任务栏看不到稳定窗口

结论：
- 当前环境下，更稳的是用**分离式后台启动** `npm.cmd run tauri dev`
- 会话托管式启动容易把子进程一起带死

### 坑 3：误把资源查找路径当成工程根目录旧路径
误区：
- 以为新工程仍然直接从 `fb_RunApp/...`、`fb_operate/...` 根目录取资源

实际：
- 新工程已经迁到 `resources/deploy/...` 体系
- 后端统一通过 `resolve_deploy_resource_dir(...)` 查找

当前统一资源路径：
- `resources/deploy/dist-packages`
- `resources/deploy/fb-operate`
- `resources/deploy/fb-RunApp/default`
- `resources/deploy/fb-RunApp/default_bmp`
- `resources/deploy/fb-RunApp/default_movie`

### 坑 4：`default_movie` 的 `autorun.py` 一开始放错版本
现象：
- “视频播放”按钮点击后效果不对 / 近似无效

最终定位：
- 新工程里的：
  - `resources/deploy/fb-RunApp/default_movie/autorun.py`
- 与旧 C# 工程里的：
  - `E:\Resource\8Big8K\8K_software\PC-SW\fb_RunApp\default_movie\autorun.py`
- **不是同一个文件**

证据：
- 文件大小不同
- SHA256 不同
- 内容结构明显不同（旧版是当前正常工作版本）

处理：
- 已用旧 C# 当前正常工作的 `autorun.py` 覆盖新工程对应文件
- 覆盖后两边 SHA256 一致

### 坑 5：`视频播放` 按钮最初和视频工作区耦合
原问题：
- `视频播放` 读取了视频区状态和当前选中文件
- 它更像“控制当前视频播放”而不是“部署 default_movie”

修正目标：
- 严格对齐 C# `btn_graphical_target_Click`
- 让 `视频播放` 与：
  - `Set default pattern L128`
  - `循环播放图片`
 处于同一层级

当前处理：
- 已将 `视频播放` 从视频控制区联动中拆出来
- 改成独立调用 `deploy_set_default_movie`

---

## 3. C# 真实行为基线（必须对齐）

### `btn_graphical_target_Click`
C# 真实逻辑：
- 使用 `fb_RunApp/default_movie`
- 调 `_commonControl.ADB_AutorunApp_Setup(str)`
- 最终写一条完成日志

### `ADB_AutorunApp_Setup(app_path)` 的关键步骤
对 `default` / `default_bmp` / `default_movie` 都一致：
1. `rm /vismm/autorun.py`
2. push `app_path/autorun.py` → `/vismm/fbshow/autorun.py`
3. `chmod 444 /vismm/fbshow/autorun.py`
4. push `app_path/autorun.py` → `/vismm/autorun.py`
5. `chmod 444 /vismm/autorun.py`
6. **service 固定取 `default` 目录**
7. push service → `/etc/systemd/system/...`
8. `systemctl daemon-reload`
9. `systemctl enable ...`
10. `systemctl restart ...`

重要结论：
- 旧 C# 不是“立即播放当前选中视频”
- 而是“部署一套 default_movie autorun 资源”

---

## 4. 当前整理原则

### 原则 1：先对齐 C#，再考虑优化
如果旧 C# 已经稳定好用，优先保证：
- 路径一致
- 资源一致
- 执行步骤一致

### 原则 2：同类动作复用同类逻辑
这三类应统一看待：
- `default`
- `default_bmp`
- `default_movie`

它们都是 autorun bundle，只是资源目录不同。

### 原则 3：UI 解耦，不让 DEMO 区依赖文件工作区状态
DEMO 区动作应当：
- 点击即部署
- 不依赖文件选中状态
- 不依赖视频控制参数

---

## 5. 后续整理建议

### 代码层面
1. 抽一个统一的 autorun 部署族：
   - `deploy_set_default_pattern`
   - `setup_loop_images`
   - `deploy_set_default_movie`
2. 让日志风格统一：
   - 调试时可以细
   - 用户态提示应尽量贴近 C# 简洁风格
3. 清理 `FramebufferTab.tsx` 中已经废弃的耦合状态和旧注释

### 资源层面
1. 新增 / 更新资源时，优先和旧 C# 工程做哈希或文本比对
2. 不要默认相信“名字一样就是对的”
3. 尤其是：
   - `autorun.py`
   - service 文件
   - `fb_operate` 目录下工具脚本

---

## 6. 当前已确认有效的修正
- `default_movie/autorun.py` 已替换为旧 C# 当前工作版本
- 配置部署页 exe / 浏览器布局已一致
- `视频播放` 已从视频工作区联动里拆出来

---

## 7. 本页整理的核心目标
一句话：

> **别再让“部署动作”“文件工作区状态”“浏览器预览假效果”三件事混在一起。**

后续继续开发时，优先保证：
- 资源版本对
- 路径对
- C# 行为基线对
- UI 职责边界清楚
