import socket
import threading
import struct
import cv2
import numpy as np
import time
import os
import logging
import mmap
import queue
from typing import Optional

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s: %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger('receiver')

class AdaptiveStreamReceiver:
    def __init__(self):
        # 网络配置
        self.data_port = 5100  # 固定数据端口
        self.control_port = 5001  # 控制端口用于提供分辨率
        self.fps_text = f"FPS: 0"
        # 显示参数
        self.resolution = self.get_display_resolution()
        if self.resolution == (0, 0):
            logger.error("无法获取有效分辨率，程序将退出")
            exit(1)
            
        self.running = True

        # 性能监控
        self.frame_stats = {
            'frame_count': 0,
            'dropped_frames': 0,
            'last_report': time.time(),
            'processing_time': 0
        }

        # 帧处理队列
        self.frame_queue = queue.Queue(maxsize=10)  # 匹配发送端队列大小

        # 初始化显示系统
        self.init_framebuffer()

        # 连接对象
        self.data_sock = None
        self.data_conn = None

        logger.info(f"接收端初始化完成，分辨率: {self.resolution[0]}x{self.resolution[1]}")

    def get_display_resolution(self) -> tuple:
        """获取实际显示设备分辨率"""
        try:
            with open('/sys/class/graphics/fb0/virtual_size') as f:
                w, h = map(int, f.read().strip().split(','))
                logger.info(f"检测到屏幕分辨率: {w}x{h}")
                return (w, h)
        except Exception as e:
            logger.error(f"无法获取真实分辨率({e})，将使用默认分辨率0x0")
            return (0, 0)

    def init_framebuffer(self):
        """初始化显示缓冲区"""
        try:
            self.fb_device = open('/dev/fb0', 'r+b')
            buffer_size = self.resolution[0] * self.resolution[1] * 4  # BGRA

            self.fb_mmap = mmap.mmap(
                self.fb_device.fileno(),
                buffer_size,
                mmap.MAP_SHARED,
                mmap.PROT_WRITE
            )

            self.framebuffer = np.frombuffer(self.fb_mmap, dtype=np.uint8).reshape(
                (self.resolution[1], self.resolution[0], 4)
            )
            logger.info("Framebuffer内存映射初始化成功")

        except Exception as e:
            logger.error(f"Framebuffer初始化失败: {e}")
            self.fb_device = None
            self.fb_mmap = None
            self.framebuffer = None

    def process_frame(self, frame_data: bytes):
        """简化的帧处理流水线"""
        start_time = time.perf_counter()

        try:
            img_np = cv2.imdecode(
                np.frombuffer(frame_data, np.uint8),
                cv2.IMREAD_COLOR
            )
            # 2. 分辨率检查
            h, w = img_np.shape[:2]
            if (w, h) != self.resolution:
                # 自动缩放以适应显示分辨率
                img_np = cv2.resize(img_np, self.resolution, interpolation=cv2.INTER_AREA)
                logger.info(f"接收到的分辨率异常，自动缩放: {self.resolution[0]}x{self.resolution[1]}")

            # 3. 转换为BGRA格式
            bgra = cv2.cvtColor(img_np, cv2.COLOR_BGR2BGRA)

            # 4. 添加帧率信息
            self.add_fps_overlay(bgra)

            # 5. 更新显示缓冲区
            if self.framebuffer is not None:
                np.copyto(self.framebuffer, bgra)
            else:
                cv2.imshow('Receiver', bgra)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    self.running = False

            # 性能统计
            self.frame_stats['frame_count'] += 1
            self.frame_stats['processing_time'] += time.perf_counter() - start_time

        except Exception as e:
            logger.error(f"处理错误: {e}")
            self.frame_stats['dropped_frames'] += 1

    def add_fps_overlay(self, frame: np.ndarray):
        """帧率信息叠加"""
        current_time = time.time()
        elapsed = current_time - self.frame_stats['last_report']

        if elapsed >= 1.0:
            fps = self.frame_stats['frame_count'] / elapsed
            self.fps_text = f"FPS: {fps:.1f}"
            self.frame_stats['last_report'] = current_time
            self.frame_stats['frame_count'] = 0

            # 计算处理负载
            load_percent = (self.frame_stats['processing_time'] / elapsed) * 100
            self.frame_stats['processing_time'] = 0

            logger.info(
                f"系统负载: {load_percent:.1f}% | "
                f"队列大小: {self.frame_queue.qsize()}/{self.frame_queue.maxsize} | "
                f"丢帧: {self.frame_stats['dropped_frames']}"
            )
            self.frame_stats['dropped_frames'] = 0

        # 添加文本
        cv2.putText(frame, self.fps_text, (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0, 255), 2)

    def receive_frame(self) -> Optional[bytes]:
        """简化的帧接收逻辑，使用64KB缓冲区"""
        try:
            # 接收帧头（仅长度）
            header = self.data_conn.recv(4)
            if len(header) < 4:
                return None

            frame_len = struct.unpack(">I", header)[0]

            # 接收帧数据，使用64KB块大小
            data = bytearray()
            while len(data) < frame_len:
                chunk = self.data_conn.recv(min(65536, frame_len - len(data)))  # 64KB块
                if not chunk:
                    return None
                data.extend(chunk)

            return data

        except socket.timeout:
            logger.debug("接收超时")
            return None
        except Exception as e:
            logger.error(f"接收错误: {e}")
            return None

    def data_server(self):
        """简化的数据服务线程"""
        # 创建监听套接字
        self.data_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.data_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.data_sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        self.data_sock.bind(("0.0.0.0", self.data_port))
        self.data_sock.listen(1)  # 只接受一个连接
        self.data_sock.settimeout(1.0)
        logger.info(f"数据端口 {self.data_port} 已监听")

        while self.running:
            try:
                # 接受新连接
                if self.data_conn is None:
                    conn, addr = self.data_sock.accept()
                    conn.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
                    conn.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 65536)  # 64KB接收缓冲区
                    conn.settimeout(0.5)  # 设置较短的超时
                    logger.info(f"来自 {addr} 的新数据连接")
                    self.data_conn = conn

                # 接收帧数据
                frame_data = self.receive_frame()
                if frame_data is None:
                    logger.warning("接收帧失败，关闭连接")
                    self.close_data_connection()
                    continue

                # 放入队列
                try:
                    self.frame_queue.put(frame_data, timeout=0.05)
                except queue.Full:
                    self.frame_stats['dropped_frames'] += 1
                    logger.warning("队列已满，丢弃帧")

            except socket.timeout:
                continue
            except Exception as e:
                logger.error(f"数据服务错误: {e}")
                self.close_data_connection()
                time.sleep(1)

    def close_data_connection(self):
        """关闭数据连接"""
        if self.data_conn:
            try:
                self.data_conn.close()
            except:
                pass
            self.data_conn = None
            logger.info("数据连接已关闭")

    def process_thread(self):
        """帧处理线程"""
        while self.running:
            try:
                frame_data = self.frame_queue.get(timeout=0.1)
                self.process_frame(frame_data)
            except queue.Empty:
                time.sleep(0.01)
            except Exception as e:
                logger.error(f"帧处理错误: {e}")
                time.sleep(0.1)

    def control_server(self):
        """控制服务线程"""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            s.bind(("0.0.0.0", self.control_port))
            s.listen(1)
            s.settimeout(1.0)
            logger.info(f"控制端口 {self.control_port} 已监听")

            while self.running:
                try:
                    conn, addr = s.accept()
                    conn.settimeout(2.0)
                    logger.info(f"控制连接来自 {addr}")

                    with conn:
                        cmd = conn.recv(1024).decode().strip()
                        logger.info(f"收到控制命令: {cmd}")

                        if cmd == "GET_RES":
                            res_str = f"{self.resolution[0]},{self.resolution[1]}"
                            conn.send(res_str.encode())
                        elif cmd == "STATUS":
                            status = {
                                'queue_size': self.frame_queue.qsize(),
                                'dropped_frames': self.frame_stats['dropped_frames'],
                                'fps': self.fps_text.replace("FPS: ", "")
                            }
                            conn.send(str(status).encode())
                        elif cmd == "EXIT":
                            self.running = False
                            conn.send(b"BYE")
                except socket.timeout:
                    continue
                except Exception as e:
                    logger.error(f"控制服务错误: {e}")

    def start(self):
        """启动接收服务"""
        logger.info(f"启动接收服务，分辨率: {self.resolution[0]}x{self.resolution[1]}")

        # 启动控制线程
        control_thread = threading.Thread(target=self.control_server, daemon=True)
        control_thread.start()

        # 启动数据服务线程
        data_thread = threading.Thread(target=self.data_server, daemon=True)
        data_thread.start()

        # 启动处理线程
        process_thread = threading.Thread(target=self.process_thread, daemon=True)
        process_thread.start()

        try:
            # 主线程监控
            while self.running:
                time.sleep(1)

                # 定期报告状态
                if time.time() - self.frame_stats['last_report'] >= 5.0:
                    logger.info(
                        f"状态 - 队列: {self.frame_queue.qsize()}/{self.frame_queue.maxsize} | "
                        f"帧率: {self.fps_text} | "
                        f"丢帧: {self.frame_stats['dropped_frames']}"
                    )
                    self.frame_stats['dropped_frames'] = 0

        except KeyboardInterrupt:
            logger.info("正在停止服务...")
            self.running = False
        finally:
            self.cleanup()
            logger.info("服务已停止")

    def cleanup(self):
        """资源清理"""
        # 关闭数据连接
        self.close_data_connection()

        # 关闭监听套接字
        if self.data_sock:
            try:
                self.data_sock.close()
            except:
                pass

        # 关闭framebuffer
        if hasattr(self, 'fb_mmap') and self.fb_mmap:
            try:
                self.fb_mmap.close()
            except:
                pass
        if hasattr(self, 'fb_device') and self.fb_device:
            try:
                self.fb_device.close()
            except:
                pass

        # 关闭OpenCV窗口
        try:
            cv2.destroyAllWindows()
        except:
            pass


if __name__ == "__main__":
    # 启动接收端
    receiver = AdaptiveStreamReceiver()
    receiver.start()