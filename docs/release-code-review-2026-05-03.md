# Release 产物审查记录

日期：2026-05-03  
重写日期：2026-05-04  
范围：`src-tauri/target/release`、`dist`、`resources`、Tauri 配置和相关源码线索

## 1. 结论

`src-tauri/target/release` 是构建产物目录，不是正式交付目录。当前 release 产物可以运行，但不够干净，不建议直接把整个 `target/release` 发给用户。

主要原因：

- 混入大量构建中间产物和调试符号。
- 主程序和安装包未签名。
- Tauri CSP 关闭。
- shell 插件能力偏宽。
- 打包资源边界不清。
- 依赖审计命中过已知风险版本。

## 2. 检查到的产物

典型内容包括：

- `Big8K.exe`
- `Big8K.pdb`
- `deps/`
- `.fingerprint/`
- `.rlib` / `.rmeta` / `.o` / `.d`
- `bundle/msi/*.msi`
- `bundle/nsis/*setup.exe`
- `_up_/resources/`

这些内容混在一起说明 release 目录只是构建缓存和打包输出的集合，不能直接视为“绿色发布包”。

## 3. 发布资源观察

`_up_/resources` 中能看到：

- `adb.exe`
- `AdbWinApi.dll`
- `AdbWinUsbApi.dll`
- YAML 网络模板
- 说明文件

ADB 随包发布是合理方向，但需要明确目录结构、版本和用途，不能让资源目录变成“把整个仓库都塞进去”。

## 4. 安全配置观察

`src-tauri/tauri.conf.json` 中的关键点：

- `frontendDist: "../dist"`
- `bundle.targets: "all"`
- `bundle.resources: ["../resources/*"]`
- `plugins.shell.open: true`
- `app.security.csp: null`

风险最高的是：

- CSP 关闭。
- shell 插件开放面。
- bundle target 和资源范围过宽。

## 5. 依赖审计观察

早期 `npm audit --omit=dev` 命中过：

- `@tauri-apps/plugin-shell`
- `nodemailer`
- `basic-ftp`

发布前需要重新跑审计，以当前锁文件结果为准，不应只沿用旧审查结论。

## 6. 优先级

P0：

- 不直接发布整个 `target/release`。
- 给正式 exe 和安装包签名。
- 启用 CSP。
- 收紧 shell 插件能力。

P1：

- 明确发布包只包含运行必需文件。
- 固定 ADB 资源目录和版本说明。
- 确认 `resources/deploy` 是否完整进入正式包。
- 重新跑依赖审计。

P2：

- 收窄 `bundle.targets`。
- 区分正式包、现场调试包和开发包。
- 为 release 输出增加清单。

## 7. 建议的交付物

普通交付：

```text
Big8K-Setup-x64.exe
```

企业部署：

```text
Big8K-x64.msi
```

现场调试绿色包：

```text
Big8K-green/
  Big8K.exe
  resources/
```

绿色包也必须从干净清单生成，不能复制整个 `target/release`。

