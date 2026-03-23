import socket
import mss
import numpy as np
import cv2
import time
import struct
import binascii
import logging
import os
import threading
import queue

# 配置日志和常量
FRAME_RATE = 8  # 目标帧率（帧/秒）
FRAME_INTERVAL = 1.0 / FRAME_RATE  # 每帧间隔时间（秒）

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s: %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger('streamer')


class ResolutionAdaptiveStreamer:
    def __init__(self):
        # 网络配置
        self.server_ip = "192.168.1.100"
        self.control_port = 5001  # 控制端口（用于获取分辨率）
        self.data_port = 5100  # 数据端口（用于传输视频帧）
        self.zoom_mode = 0  # 缩放模式标志

        # 分辨率参数（初始化后从接收端获取）
        self.target_width = 0
        self.target_height = 0

        # 性能监控
        self.frame_stats = {
            'last_frame_time': time.perf_counter(),
            'frame_count': 0,
            'dropped_frames': 0
        }

        # 处理队列
        self.processing_queue = queue.Queue(maxsize=10)  # 缓冲10帧

        # 预分配内存
        self.prealloc_jpeg_buffer = None  # 在获取分辨率后初始化

        # 连接对象
        self.control_socket = None
        self.data_socket = None

    def get_remote_resolution_and_configure_display_parameters(self):
        """获取本地显示器信息并计算基础参数"""
        with mss.mss() as sct:
            # 获取主显示器信息
            self.monitor = sct.monitors[1]
            self.local_width = self.monitor['width']
            self.local_height = self.monitor['height']
            self.local_ratio = self.local_width / self.local_height
            logger.info(f"本地显示器分辨率: {self.local_width}x{self.local_height} (比例: {self.local_ratio:.2f})")

        """获取远程分辨率并计算处理参数"""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as control_socket:
                control_socket.settimeout(3)
                control_socket.connect((self.server_ip, self.control_port))
                control_socket.sendall(b"GET_RES")
                resolution_data = control_socket.recv(128).decode().strip()
                remote_width, remote_height = map(int, resolution_data.split(','))

                # 计算远程宽高比（考虑可能的旋转）
                remote_ratio = remote_width / remote_height
                rotated_remote_ratio = remote_height / remote_width  # 旋转后的比例

                # 自动判断是否需要旋转
                ratio_diff = abs(self.local_ratio - remote_ratio)
                rotated_ratio_diff = abs(self.local_ratio - rotated_remote_ratio)

                self.need_rotate = rotated_ratio_diff < ratio_diff

                if self.need_rotate:
                    logger.info(f"需要旋转: 本地 {self.local_width}x{self.local_height} ({self.local_ratio:.2f}) → "
                                f"远程 {remote_width}x{remote_height} (旋转后比例: {rotated_remote_ratio:.2f})")
                    self.target_width = remote_width
                    self.target_height = remote_height
                else:
                    logger.info(
                        f"无需旋转: 本地 {self.local_width}x{self.local_height} → 远程 {remote_width}x{remote_height}")
                    self.target_width = remote_width
                    self.target_height = remote_height

                # 预分配处理缓冲区
                self.prealloc_buffers = [
                    np.zeros((self.target_height, self.target_width, 3), dtype=np.uint8)
                    for _ in range(2)
                ]
                # 创建预合成背景
                self.background = np.zeros(
                    (self.target_height, self.target_width, 3),
                    dtype=np.uint8
                )

                # 可选：填充特定颜色（如50%灰色）
                self.background[:] = (128, 128, 128)  # RGB灰色
                logger.info(f"创建{self.target_width}x{self.target_height}背景缓冲区")

                return True

        except Exception as e:
            logger.error(f"分辨率获取失败: {e}")
            return False

    def connect_data(self):
        """建立数据传输连接"""
        try:
            # 关闭现有连接（如果存在）
            if self.data_socket:
                try:
                    self.data_socket.close()
                except:
                    pass

            # 创建新连接
            self.data_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.data_socket.settimeout(1.0)
            self.data_socket.connect((self.server_ip, self.data_port))
            self.data_socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            logger.info("数据连接成功")
            return True
        except Exception as e:
            logger.warning(f"数据连接失败: {str(e)}. 将在下一次尝试")
            self.data_socket = None
            return False

    def send_frame(self, frame_data: bytes):
        """发送帧数据"""
        if not self.data_socket:
            if not self.connect_data():
                return False

        try:
            # 发送长度头（4字节大端序）
            header = struct.pack(">I", len(frame_data))
            self.data_socket.sendall(header + frame_data)
            return True
        except Exception as e:
            logger.warning(f"发送错误: {str(e)}. 将尝试重新连接")
            self.data_socket = None
            return False

    def process_frame(self, frame: np.ndarray) -> bytes:
        """根据目标分辨率处理帧"""
        if self.target_width <= 0 or self.target_height <= 0:
            logger.error("无效的分辨率设置，无法处理帧")
            return b""

        try:
            # 1. 预处理：裁剪到目标宽高比
            height, width = frame.shape[:2]
            target_ratio = self.target_width / self.target_height
            frame_ratio = width / height

            if abs(frame_ratio - target_ratio) > 0.01:
                if frame_ratio > target_ratio:
                    # 水平裁剪（两边居中裁剪）
                    new_width = int(height * target_ratio)
                    start_x = (width - new_width) // 2
                    frame = frame[:, start_x:start_x + new_width]
                else:
                    # 垂直裁剪（上下居中裁剪）
                    new_height = int(width / target_ratio)
                    start_y = (height - new_height) // 2
                    frame = frame[start_y:start_y + new_height, :]

            # 2. 缩放到目标分辨率
            scaled_frame = cv2.resize(frame, (self.target_width, self.target_height),
                                      interpolation=cv2.INTER_LINEAR)

            # 3. JPEG编码
            success, jpeg_data = cv2.imencode('.jpg', scaled_frame, [
                cv2.IMWRITE_JPEG_QUALITY, 85,  # 压缩质量
                cv2.IMWRITE_JPEG_OPTIMIZE, 1,  # 启用优化
                cv2.IMWRITE_JPEG_PROGRESSIVE, 1  # 渐进式编码
            ])

            if success:
                # 4. 使用预分配缓冲区（如果可用）
                jpeg_bytes = jpeg_data.tobytes()
                if self.prealloc_jpeg_buffer and len(self.prealloc_jpeg_buffer) >= len(jpeg_bytes):
                    self.prealloc_jpeg_buffer[:len(jpeg_bytes)] = jpeg_bytes
                    return memoryview(self.prealloc_jpeg_buffer)[:len(jpeg_bytes)]
                return jpeg_bytes
            else:
                return b""  # 编码失败

        except Exception as e:
            logger.error(f"帧处理错误: {str(e)}")
            return b""

    def capture_thread(self, monitor):
        """截图线程 - 包含完整的预处理流程"""
        with mss.mss() as sct:
            last_capture_time = time.perf_counter()

            # 根据旋转需求确定帧尺寸
            if self.need_rotate:
                source_height, source_width = self.local_width, self.local_height
            else:
                source_height, source_width = self.local_height, self.local_width
            target_height, target_width = self.target_height, self.target_width

            logger.info(f"本地宽高: {source_width}x{source_height}; 目标宽高: {target_width}x{target_height}")

            # 计算裁剪/居中参数
            if source_width > target_width or source_height > target_height:
                # 源图大于背景：从中心裁剪
                crop_x = max(0, (source_width - target_width) // 2)
                crop_y = max(0, (source_height - target_height) // 2)
                src_x_start = crop_x
                src_x_end = min(crop_x + target_width, source_width)
                src_y_start = crop_y
                src_y_end = min(crop_y + target_height, source_height)

                # 目标区域始终是全背景
                dst_x_start = 0
                dst_y_start = 0
            else:
                # 源图小于背景：居中放置
                src_x_start = 0
                src_x_end = source_width
                src_y_start = 0
                src_y_end = source_height

                dst_x_start = (target_width - source_width) // 2
                dst_y_start = (target_height - source_height) // 2

            # 计算最终复制区域（防止越界）
            copy_width = min(src_x_end - src_x_start, target_width - dst_x_start)
            copy_height = min(src_y_end - src_y_start, target_height - dst_y_start)

            while True:
                try:
                    current_time = time.perf_counter()
                    elapsed_time = current_time - last_capture_time

                    # 维持目标帧率
                    if elapsed_time >= FRAME_INTERVAL:
                        # 1. 获取原始截图（BGR格式）
                        raw_frame = np.array(sct.grab(monitor))[:, :, :3]

                        # 2. 旋转处理（如果需要）
                        if self.need_rotate:
                            raw_frame = cv2.rotate(raw_frame, cv2.ROTATE_90_CLOCKWISE)

                        # 3. 合成到背景 -------------------------------------------------
                        composite_frame = self.background.copy()

                        # 直接1:1平铺到背景（缩放模式0）
                        if self.zoom_mode == 0:
                            composite_frame[dst_y_start:dst_y_start + copy_height,
                            dst_x_start:dst_x_start + copy_width] = \
                                raw_frame[src_y_start:src_y_start + copy_height,
                                src_x_start:src_x_start + copy_width]

                        # -------------------------------------------------------------------
                        try:
                            # 放入处理队列
                            self.processing_queue.put_nowait(composite_frame)
                            last_capture_time = current_time
                        except queue.Full:
                            self.frame_stats['dropped_frames'] += 1
                            # 调整时间基线维持帧率
                            last_capture_time += FRAME_INTERVAL
                    else:
                        # 精确睡眠避免CPU占用过高
                        sleep_time = FRAME_INTERVAL - elapsed_time
                        if sleep_time > 0:
                            time.sleep(sleep_time * 0.9)  # 90%睡眠，避免过调

                except Exception as e:
                    logger.error(f"捕获错误: {str(e)}")
                    time.sleep(0.5)

    def sending_thread(self):
        """发送线程 - 维持固定帧率"""
        # 初始化预分配缓冲区（基于分辨率计算）
        if self.target_width > 0 and self.target_height > 0:
            # 估计最大JPEG大小（宽度×高度×3 × 压缩因子）
            max_jpeg_size = self.target_width * self.target_height * 3 // 2
            self.prealloc_jpeg_buffer = bytearray(max_jpeg_size)
            logger.info(f"初始化预分配缓冲区: {max_jpeg_size} 字节")

        while True:
            try:
                start_time = time.perf_counter()

                # 获取下一帧（带超时等待）
                try:
                    frame_to_send = self.processing_queue.get(timeout=0.1)
                except queue.Empty:
                    continue

                # 处理并发送
                processed_frame = self.process_frame(frame_to_send)
                if processed_frame and len(processed_frame) > 0:
                    if self.send_frame(processed_frame):
                        self.frame_stats['frame_count'] += 1
                    else:
                        self.frame_stats['dropped_frames'] += 1

                # 计算处理时间
                elapsed_time = time.perf_counter() - start_time

                # 维持帧率
                if elapsed_time < FRAME_INTERVAL:
                    sleep_time = FRAME_INTERVAL - elapsed_time
                    time.sleep(sleep_time)
                else:
                    logger.warning(f"帧处理超时: {elapsed_time * 1000:.1f}ms > {FRAME_INTERVAL * 1000:.1f}ms")

            except Exception as e:
                logger.error(f"发送线程错误: {str(e)}")
                time.sleep(1)

    def report_stats(self):
        """每10秒报告一次性能数据"""
        while True:
            time.sleep(10)
            frame_count = self.frame_stats['frame_count']
            dropped_frames = self.frame_stats['dropped_frames']
            fps = frame_count / 10.0 if frame_count > 0 else 0

            logger.info(
                f"当前帧率: {fps:.1f}FPS | 累计丢帧: {dropped_frames} | "
                f"队列深度: {self.processing_queue.qsize()}/{self.processing_queue.maxsize} | "
                f"分辨率: {self.target_width}x{self.target_height}"
            )

            # 重置统计计数器
            self.frame_stats['frame_count'] = 0
            self.frame_stats['dropped_frames'] = 0

    def get_local_display_info(self):
        """获取本地显示器信息（冗余定义，已在__init__中实现）"""
        with mss.mss() as sct:
            monitor = sct.monitors[1]
            self.local_width = monitor['width']
            self.local_height = monitor['height']
            self.local_ratio = self.local_width / self.local_height
            logger.info(f"本地显示器分辨率: {self.local_width}x{self.local_height}")

    def start_streaming(self):
        """启动流媒体服务"""
        # 获取远程分辨率
        if not self.get_remote_resolution_and_configure_display_parameters():
            logger.error("无法获取分辨率，流媒体启动失败，请检查接收端脚本工作状态")
            return

        # 尝试建立数据连接
        self.connect_data()

        # 启动工作线程
        threading.Thread(
            target=self.capture_thread,
            args=(self.monitor,),
            daemon=True
        ).start()

        threading.Thread(
            target=self.sending_thread,
            daemon=True
        ).start()

        threading.Thread(
            target=self.report_stats,
            daemon=True
        ).start()

        # 主线程监控
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("\n用户终止")
        finally:
            # 关闭所有连接
            if self.control_socket:
                try:
                    self.control_socket.close()
                except:
                    pass
            if self.data_socket:
                try:
                    self.data_socket.close()
                except:
                    pass


if __name__ == "__main__":
    streamer = ResolutionAdaptiveStreamer()
    streamer.start_streaming()