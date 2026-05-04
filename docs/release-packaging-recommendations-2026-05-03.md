# 发布打包建议

日期：2026-05-03  
重写日期：2026-05-04  
适用范围：Big8K Tauri 2 Windows 桌面应用

## 1. 推荐结论

默认发布 NSIS 安装包，企业部署时补 MSI，现场调试可额外提供裁剪后的绿色包。

不要直接发布 `src-tauri/target/release`。

## 2. 为什么首选 NSIS

NSIS 更适合现场和普通用户：

- 安装体验直接。
- 支持卸载器和快捷方式。
- 易于携带主程序和资源。
- Tauri Windows 桌面工具默认分发更友好。

建议文件名：

```text
Big8K-Setup-x64.exe
```

## 3. MSI 的定位

MSI 适合：

- 企业内网部署。
- 组策略分发。
- 静默安装。
- 资产管理系统接入。

它不建议作为唯一格式。

## 4. ADB 是否随包

ADB 应随包发布，因为当前应用的核心功能依赖 ADB。

建议打包：

```text
resources/adb/adb.exe
resources/adb/AdbWinApi.dll
resources/adb/AdbWinUsbApi.dll
```

运行时策略：

- 正式包优先使用内置 ADB。
- 开发环境可 fallback 到系统 PATH。
- 启动时检查 ADB 和 DLL 是否齐全。
- 错误信息要明确告诉用户缺哪个文件。

## 5. 脚本和模板是否随包

需要随包发布：

- Python 脚本。
- Shell 脚本。
- YAML 网络模板。
- JSON 清单和预设。
- 默认 autorun bundle。
- 板端工具和必要二进制。

不应在安装目录反复写入：

- 用户配置。
- 日志。
- 临时导出文件。
- 运行期生成文件。

建议运行期可写内容放到：

```text
%APPDATA%\Big8K\
  config.json
  command_presets.json
  logs\
  generated\
```

## 6. 推荐资源结构

理想发布结构：

```text
resources/
  adb/
    adb.exe
    AdbWinApi.dll
    AdbWinUsbApi.dll
  deploy/
    manifests/
    dist-packages/
    python-libs/
    fb-operate/
    fb-RunApp/
  templates/
  presets/
```

当前仓库实际资源仍在 `resources/` 和 `resources/deploy/`，后续可以逐步向上面的结构收敛。

## 7. 发布前检查清单

必须做：

- `npm run build`
- `cargo check`
- Tauri 打包。
- 重新跑依赖审计。
- 检查 ADB 和 DLL 是否可被打包后程序找到。
- 检查 `resources/deploy` 是否完整。
- 检查正式产物签名。
- 检查 CSP 和 shell 插件能力。
- 检查安装包内没有 `.pdb`、`.rlib`、`.rmeta`、`.o`、`.d` 等中间产物。

建议做：

- 生成发布清单。
- 记录 ADB 版本。
- 区分正式包和现场调试包。
- 对高影响命令保留 UI 确认。

## 8. 最终建议

发布目标应是：

```text
安装即用，但资源边界清楚；
现场可调试，但正式包不夹带构建垃圾；
带 ADB，但不暴露过宽 shell 能力。
```

