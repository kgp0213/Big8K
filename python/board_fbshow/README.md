# board_fbshow 说明

这个目录保存的是从板端 `/vismm/fbshow/` 拉下来的参考脚本，主要用于：

- 对照板端已有能力
- 研究现有显示逻辑
- 为上位机功能迁移提供参考

这些脚本**不一定都直接参与主工程运行链路**，更偏向“参考资料 + 板端原始实现备份”。

## 分类索引

### 1. 画面 / Pattern / 显示效果
- `demo_colors.py`：基础纯色轮播
- `demo_multi_effects.py`：多种图案与效果示例
- `logicPictureShow.py`：逻辑测试图主脚本（0~39 模式）
- `Mouse_crossLine.py`：十字线 / 鼠标辅助校准
- `generate_colorful_bmp.py`：生成炫彩图 BMP 素材
- `framebuffer_screenshot.py`：抓取 framebuffer 当前画面

### 2. 视频 / 串流
- `videoPlay.py`：视频播放到 framebuffer
- `chenfeng_movie.py`：视频/动画播放辅助脚本
- `adaptive_screen_streamer.py`：PC 侧自适应串流发送端
- `adaptive_stream_receiver.py`：板端接收端

### 3. 板端自运行 / 轮播
- `autorun.py`：板端自动运行逻辑
- `autorunUSB.py`：USB 介质联动的自运行逻辑

### 4. 板级硬件/专项测试
- `2b0_bist.py`：GPIO/BIST 类专项测试

## 建议

- 需要迁移到上位机的能力，优先参考：
  - `logicPictureShow.py`
  - `demo_multi_effects.py`
  - `demo_colors.py`
  - `framebuffer_screenshot.py`
  - `videoPlay.py`
- 该目录建议继续作为 **参考脚本目录** 使用；真正进入主工程运行链路的脚本，建议放在 `python/` 或 `python/runtime_fbshow/` 中单独维护。
