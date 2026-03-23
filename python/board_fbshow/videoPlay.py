import cv2
import numpy as np
import mmap
import os
import time
import sys
import signal
from threading import Thread, Event, Lock
from collections import deque
import subprocess


# 获取命令行参数中的视频文件路径、屏幕分辨率、是否缩放参数和是否显示帧率参数
if len(sys.argv) < 3:
    print("Usage: python videoPlay.py <video_file_path> <IsResize> [<IsShowFramerate>]")
    sys.exit(1)

video_path = sys.argv[1]
is_resize = int(sys.argv[2])
is_show_framerate = int(sys.argv[3]) if len(sys.argv) > 3 else 0

cmd = "cat /sys/class/graphics/fb0/virtual_size"
result = subprocess.run(cmd, shell=True, check=True, stdout=subprocess.PIPE, universal_newlines=True)    
resolution= result.stdout.strip() 
screen_width,screen_height =map(int, resolution.split(','))
print(screen_width,screen_height)
# 帧缓冲设备路径
fb_path = '/dev/fb0'
fb_size = screen_height * screen_width*4

# 控制信号文件路径
pause_signal_path = "/dev/shm/pause_signal"
stop_signal_path = "/dev/shm/stop_signal"
is_running_signal_path = "/dev/shm/is_running"

# 检查并删除现有的暂停和停止信号文件
if os.path.exists(pause_signal_path):
    os.remove(pause_signal_path)
if os.path.exists(stop_signal_path):
    os.remove(stop_signal_path)

# 检查是否已经有实例在运行
if os.path.exists(is_running_signal_path):
    print("Error: Another instance of the script is already running.")
    sys.exit(1)

# 创建运行信号文件
open(is_running_signal_path, 'w').close()

# 打开视频文件，使用 CUDA 进行硬件加速解码
cap = cv2.VideoCapture(video_path, cv2.CAP_FFMPEG)
cap.set(cv2.CAP_PROP_HW_ACCELERATION, cv2.VIDEO_ACCELERATION_ANY)

# 检查视频是否成功打开
if not cap.isOpened():
    print(f"Error: Cannot open video file {video_path}.")
    os.remove(is_running_signal_path)
    sys.exit(1)
# print(cv2.getBuildInformation())
# 获取视频文件信息
video_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
video_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

fps = cap.get(cv2.CAP_PROP_FPS)
frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
duration = frame_count / fps
print(f"Video Information:\nResolution: {video_width}x{video_height}\nFrame Rate: {fps} FPS\nTotal Frames: {frame_count}\nDuration: {duration:.2f} seconds")

frame_interval = 1 / fps  # 根据视频帧率调整播放速率，单位为秒
# print(frame_interval)

# 创建队列和事件
frame_queue = deque(maxlen=120)  # 增大队列大小
stop_event = Event()
pause_event = Event()
frame_lock = Lock()

# 帧率统计
frame_count = 0
displayed_frame_count = 0

# 调试日志列表
debug_logs = []

def resize_frame(frame):
    if is_resize == 0:
        if video_width < screen_width and video_height < screen_height:
            # 居中显示，四周填黑
            frame_padded = np.zeros((screen_height, screen_width, 3), dtype=np.uint8)
            y_offset = (screen_height - video_height) // 2
            x_offset = (screen_width - video_width) // 2
            frame_padded[y_offset:y_offset+video_height, x_offset:x_offset+video_width] = frame
            frame = frame_padded
        elif video_width > screen_width or video_height > screen_height:
            # 从视频中间裁剪出屏幕分辨率大小的区域
            x_center = video_width // 2
            y_center = video_height // 2
            x_start = x_center - screen_width // 2
            y_start = y_center - screen_height // 2
            frame = frame[y_start:y_start+screen_height, x_start:x_start+screen_width]
    elif is_resize == 1:
        # 按照屏幕长宽比进行缩放，无法填满屏幕的部分填黑
        aspect_ratio = screen_width / screen_height
        if video_width / video_height > aspect_ratio:
            new_width = screen_width
            new_height = int(screen_width / (video_width / video_height))
        else:
            new_height = screen_height
            new_width = int(screen_height * (video_width / video_height))
        frame_resized = cv2.resize(frame, (new_width, new_height))
        frame_padded = np.zeros((screen_height, screen_width, 3), dtype=np.uint8)
        y_offset = (screen_height - new_height) // 2
        x_offset = (screen_width - new_width) // 2
        frame_padded[y_offset:y_offset+new_height, x_offset:x_offset+new_width] = frame_resized
        frame = frame_padded
    elif is_resize == 2:
        # 按照屏幕分辨率进行缩放
        frame = cv2.resize(frame, (screen_width, screen_height))
    elif is_resize == 3:
        start_time = time.time()
        frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)            
        # 缩放到屏幕分辨率
        frame = cv2.resize(frame, (screen_width, screen_height))
        # print(f"rotate_resizetime {time.time()-start_time}")
    return frame

def read_frames():
    global frame_count
    delay=0
    start_time = time.time()
    print(f"Read start_time: {start_time}")
    while not stop_event.is_set():
        if not pause_event.is_set():
            ret, frame = cap.read()
            if not ret:
                stop_event.set()
                break
            with frame_lock:
                frame_queue.append(resize_frame(frame))
            frame_count += 1
            # 动态调整延时,不要读取太多防止溢出导致丢帧
            queue_length = len(frame_queue)
            # delay = frame_interval * ((queue_length*2)/frame_queue.maxlen)
            
            if queue_length>(fps+10):  #队列中的帧数量超过30就暂停一会儿
                delay=5/fps
                time.sleep(delay)
            else:
                delay=0
            # 添加调试日志
            elapsed_time = time.time() - start_time
            if elapsed_time> 1:
                print(f"Read frame {frame_count}, queue length: {queue_length}, delay: {delay:.4f},elapsed_time {elapsed_time}")
                start_time = time.time()
 
def display_frames():
    global displayed_frame_count
    fpsa = fps
    time.sleep(1)

    try:
        with open(fb_path, 'r+b') as fb:
            mm = mmap.mmap(fb.fileno(), fb_size, mmap.MAP_SHARED, mmap.PROT_WRITE)
            start_time = time.time()
            # 使用numpy的frombuffer直接操作内存映射区域
            mm_array = np.frombuffer(mm, dtype=np.uint8).reshape((screen_height, screen_width, 4))
            while not stop_event.is_set() or frame_queue:
                showframes_start = time.perf_counter()

                # with frame_lock:
                if frame_queue:
                    frame = frame_queue.popleft()
                else:
                    continue

                # 转换24bpp到32bpp
                fb_image = cv2.cvtColor(frame, cv2.COLOR_BGR2BGRA)

                # 计算并显示帧率
                if displayed_frame_count % 20 == 0:
                    elapsed_time = time.perf_counter() - start_time
                    fpsa = 20 / elapsed_time
                    start_time = time.perf_counter()
                if is_show_framerate:
                    cv2.putText(fb_image, f"FPS: {fpsa:.2f}", (100, 100), cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 2)
                
                np.copyto(mm_array, fb_image)

                displayed_frame_count += 1
                time_to_sleep = max(frame_interval - (time.perf_counter() - showframes_start), 0)
                time.sleep(time_to_sleep)
            # 重置 mm_array 引用，在关闭 mmap 前确保没有指向 mmap 的引用
            mm_array = None 
            mm.close()

    except Exception as e:
        print(f"Error: {e}")
        stop_event.set()


def handle_signals():
    while not stop_event.is_set():
        if os.path.exists(pause_signal_path):
            if pause_event.is_set():
                pause_event.clear()
            else:
                pause_event.set()
            os.remove(pause_signal_path)
        if os.path.exists(stop_signal_path):
            stop_event.set()
            os.remove(stop_signal_path)
            break
        time.sleep(0.05)  # 检查信号文件的间隔

def signal_handler(sig, frame):
    stop_event.set()

# 注册信号处理程序
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

# 创建并启动线程
reader_thread = Thread(target=read_frames)
display_thread = Thread(target=display_frames)
signal_thread = Thread(target=handle_signals)
reader_thread.start()
display_thread.start()
signal_thread.start()

# 等待线程完成
reader_thread.join()
display_thread.join()
signal_thread.join()

cap.release()
os.remove(is_running_signal_path)

# 输出丢失的帧数
lost_frames = frame_count - displayed_frame_count
print(f"Total frames read: {frame_count};Total frames displayed: {displayed_frame_count};Total frames lost: {lost_frames}")
print("Video displayed on framebuffer...")
