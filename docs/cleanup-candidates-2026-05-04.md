# 目录清理记录

日期：2026-05-04

本文件记录已清理内容、保留内容和后续待判断内容。清理原则：只删除明确生成物或与项目无关的临时分析文件；硬件参考、部署脚本和不确定资源先保留。

## 1. 已删除

- `.tauri-dev.err.log`
- `.tauri-dev.log`
- `.vite-dev.err.log`
- `.vite-dev.log`
- `build-latest.log`
- `src-tauri/build_full.log`
- `python/__pycache__/`
- `resources/deploy/fb-operate/__pycache__/`
- `skill-big8k-screen/big8k_screen/__pycache__/`
- `scan_and_analyze.py`
- `pdf_analysis_report.json`

## 2. 已保留

- `docs/release-code-review-2026-05-03.md`
- `docs/release-packaging-recommendations-2026-05-03.md`
- `resources/deploy/fb-operate/two_pattern_pageflip_loop.py`
- `resources/deploy/fb-operate/two_pattern_smooth_loop.py`
- `skill-big8k-screen/oled-config-validate.json`
- `docs/ca-sdk2_en-US.pdf`
- `skill-big8k-screen/requirements.txt`，如果本地存在

## 3. 生成物但默认不删

- `dist/`：前端构建输出，可再生成，但可能用于本地打包检查。
- `node_modules/`：前端依赖。
- `src-tauri/target/`：Rust 构建输出。
- `.workbuddy/`：本地工具状态。

## 4. 后续判断

- 确认 `two_pattern_*` 是否是正式 Framebuffer deploy 脚本。
- 如果是正式资源，更新 `resources/README.md` 和部署说明。
- 如果是实验脚本，移动到明确 archive 或删除。
- 检查 `.gitignore` 是否误忽略合法文档或依赖说明。

