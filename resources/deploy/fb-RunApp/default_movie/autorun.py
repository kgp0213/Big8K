from threading import Thread, Event
from queue import Queue, Full, Empty
import cv2
import os
import time
import mmap
import subprocess
import numpy as np
import re
from PIL import Image, ImageDraw, ImageFont

# ====================== 配置区 ======================
folder_path = '/vismm/fbshow/bmp_online'
movie_path = '/vismm/fbshow/movie_online'

manual = 0       # 手/自动模式
movie_total = 3  # 视频总数
local_movies = []

bmp_index = 0
movie_index = 0

cmos_total = 2   # CMOS显示种类
cmos_index = 1

Forward = "01"
Backward = "02"
Right = "03"
Left = "04"

horizontal = "1080"
vertical = "1920"

image_total = 5     # 图片总数
local_images = []

# ====================== 工具函数 ======================
_DIGIT_PATTERN = re.compile(r'(\d+)')

def natural_sort_key(s):
    """自然排序键函数，支持含数字的文件名排序"""
    return [
        int(part) if part.isdigit() else part.lower()
        for part in _DIGIT_PATTERN.split(s)
    ]

def list_images(folder):
    """获取并自然排序图片文件列表"""
    global local_images
    image_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.bmp')
    
    files = [
        os.path.join(folder, f) 
        for f in os.listdir(folder) 
        if os.path.splitext(f)[1].lower() in image_extensions
    ]
    
    local_images = sorted(files, key=lambda x: natural_sort_key(os.path.basename(x)))
    return local_images
    
def list_movie(folder):
    """获取并自然排序视频文件列表"""
    global local_movies
    video_extensions = ('.mp4', '.avi')
    
    files = [
        os.path.join(folder, f) 
        for f in os.listdir(folder) 
        if os.path.splitext(f)[1].lower() in video_extensions
    ]
    
    local_movies = sorted(files, key=lambda x: natural_sort_key(os.path.basename(x)))
    return local_movies

# ====================== 显示功能 ======================
def bmpShowinList(pic_num):
    """优化后的图片显示函数"""
    global horizontal, vertical
    bmp_file = local_images[pic_num]
    
    # 带缓存的图像加载
    if not hasattr(bmpShowinList, "cache"):
        bmpShowinList.cache = {}
        
    if bmp_file not in bmpShowinList.cache:
        frame = cv2.imread(bmp_file)
        frame = cv2.resize(frame, (int(horizontal), int(vertical)), interpolation=cv2.INTER_LINEAR)
        bmpShowinList.cache[bmp_file] = cv2.cvtColor(frame, cv2.COLOR_BGR2BGRA)
    
    with open('/dev/fb0', 'wb') as fb:
        fb.write(bmpShowinList.cache[bmp_file].tobytes())

def movieShowinList(film_num):
    """获取排序后的视频路径"""
    return local_movies[film_num]

# ====================== 摄像头功能 ======================
def cmos_Show(mode):
    """摄像头显示功能"""
    global horizontal, vertical
    # 获取分辨率
    fb0_path = '/sys/class/graphics/fb0/virtual_size'
    with open(fb0_path) as f:
        horizontal, vertical = f.read().strip().split(',')
    
    # 初始化摄像头
    cap = cv2.VideoCapture('/dev/video0')
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc('M', 'J', 'P', 'G'))
    cap.set(cv2.CAP_PROP_FPS, 30)
    
    if not cap.isOpened():
        print("无法打开摄像头")
        return

    try:
        while True:
            # 按键检测
            keyValue = getKeyValue()
            if keyValue in [Forward, Backward, Right, Left]:
                break
            
            # 读取帧
            ret, frame = cap.read()
            if not ret:
                print("摄像头读取失败")
                break
            
            # 调整尺寸和格式
            frame = cv2.resize(frame, (int(horizontal), int(vertical)), interpolation=cv2.INTER_AREA)
            image = cv2.cvtColor(frame, cv2.COLOR_BGR2BGRA)
            
            # 写入帧缓冲
            with open('/dev/fb0', 'wb') as fb:
                fb.write(image.tobytes())
                
    finally:
        cap.release()
        cv2.destroyAllWindows()

# ====================== 视频播放优化 ======================
class VideoPlayer:
    def __init__(self):
        self.cap = None
        self.frame_queue = Queue(maxsize=30)  # 缓冲队列
        self.stop_event = Event()
        self.pause_event = Event()
        self.display_thread = None
        self.reader_thread = None
        
    def _process_frame(self, frame):
        """视频帧处理（居中显示/裁剪）"""
        target_w = int(horizontal)
        target_h = int(vertical)
        h, w = frame.shape[:2]
        
        # 当视频尺寸小于屏幕时，居中显示
        if w < target_w or h < target_h:
            padded = np.zeros((target_h, target_w, 3), dtype=np.uint8)
            x = (target_w - w) // 2
            y = (target_h - h) // 2
            padded[y:y+h, x:x+w] = frame
            return padded
        
        # 当视频尺寸大于屏幕时，居中裁剪
        start_x = max((w - target_w) // 2, 0)
        start_y = max((h - target_h) // 2, 0)
        return frame[start_y:start_y+target_h, start_x:start_x+target_w]
    
    def _reader_thread(self, path):
        """视频读取线程"""
        global movie_index  # 
        while not self.stop_event.is_set():
            self.cap = cv2.VideoCapture(path)
            if not self.cap.isOpened():
                break
            
            fps = self.cap.get(cv2.CAP_PROP_FPS)
            frame_delay = 1.0 / fps if fps > 0 else 0.033
            
            while not self.stop_event.is_set():
                if self.pause_event.is_set():
                    time.sleep(0.01)
                    continue
                    
                ret, frame = self.cap.read()
                if not ret:
                    break
                    
                processed = self._process_frame(frame)
                
                try:
                    self.frame_queue.put(processed, timeout=0.1)
                except Full:
                    pass  # 主动丢帧保流畅
            
            self.cap.release()
            if not self.stop_event.is_set():  # 如果不是手动停止，循环播放
                movie_index = updateIndex(movie_index, 1, movie_total)
                path = movieShowinList(movie_index)
    
    def _display_thread(self):
        """显示线程（双缓冲优化）"""
        buffer = np.empty((int(vertical), int(horizontal), 4), dtype=np.uint8)
        next_frame_time = time.perf_counter()
        
        try:
            with open('/dev/fb0', 'r+b') as fb:
                mm = mmap.mmap(fb.fileno(), int(horizontal)*int(vertical)*4, 
                              mmap.MAP_SHARED, mmap.PROT_WRITE)
                
                while not self.stop_event.is_set():
                    # 精确帧同步
                    now = time.perf_counter()
                    if now < next_frame_time:
                        sleep_time = next_frame_time - now
                        time.sleep(sleep_time/2)
                        continue
                    
                    try:
                        frame = self.frame_queue.get_nowait()
                        # 转换颜色空间
                        bgra = cv2.cvtColor(frame, cv2.COLOR_BGR2BGRA)
                        # 直接内存写入
                        mm.seek(0)
                        mm.write(bgra.tobytes())
                        
                        # 计算下一帧时间
                        next_frame_time = max(next_frame_time + 0.033, 
                                            now - 0.005)  # 允许5ms追赶
                    except Empty:
                        pass
                
                mm.close()
        except Exception as e:
            print(f"显示错误: {str(e)}")
            self.stop_event.set()
    
    def play(self, path):
        """启动视频播放"""
        self.stop_event.clear()
        self.pause_event.clear()
        
        # 启动子线程
        self.reader_thread = Thread(target=self._reader_thread, args=(path,))
        self.reader_thread.start()
        self.display_thread = Thread(target=self._display_thread)
        self.display_thread.start()
    
    def stop(self):
        """停止播放"""
        self.stop_event.set()
        if self.display_thread:
            self.display_thread.join(timeout=1)
        if self.reader_thread:
            self.reader_thread.join(timeout=1)

# ====================== 修改后的视频播放函数 ======================
def movie_Show(my_path):
    """优化后的视频播放函数"""
    global movie_index, movie_total
    
    player = VideoPlayer()
    player.play(my_path)
    
    try:
        while True:
            # 按键检测
            keyValue = getKeyValue()
            if keyValue in [Forward, Backward, Right, Left]:
                break
            
            time.sleep(0.01)  # 降低主循环CPU占用
            
    finally:
        player.stop()
        cv2.destroyAllWindows()

# ====================== 系统交互 ======================
def getKeyValue():
    """获取物理按键值"""
    try:
        result = subprocess.run("cat /proc/chenfeng_adckey/chenfeng_adckey", 
                               shell=True, capture_output=True, text=True)
        return result.stdout.strip().replace(" ", "")
    except Exception as e:
        print(f"按键读取错误: {str(e)}")
        return ""

def updateIndex(current_index, step, max_index):
    """循环更新索引"""
    new_index = current_index + step
    if new_index >= max_index:
        return 0
    elif new_index < 0:
        return max_index - 1
    return new_index

# ====================== 主控制逻辑 ======================
def Delay_bmp(time_set):
    """延时处理与按键响应"""
    global bmp_index, manual, movie_index, cmos_index
    
    start_time = time.time()
    while time.time() - start_time < time_set:
        keyValue = getKeyValue()
        
        if not keyValue:
            time.sleep(0.1)
            continue
        
        # 短按处理
        if keyValue == Forward:
            print("下一张图片")
            bmp_index = updateIndex(bmp_index, 1, image_total)
            manual = 1
            return
        elif keyValue == Backward:
            print("上一张图片")
            bmp_index = updateIndex(bmp_index, -1, image_total)
            manual = 1
            return
        elif keyValue == Right:
            print("切换视频")
            movie_index = updateIndex(movie_index, 1, movie_total)
            movie_Show(movieShowinList(movie_index))
            manual = 1
            return
        elif keyValue == Left:
            print("切换摄像头模式")
            cmos_index = updateIndex(cmos_index, 1, cmos_total)
            cmos_Show(cmos_index)
            manual = 1
            return
        
        time.sleep(0.05)

def main_master():
    """主控制函数"""
    global horizontal, vertical, image_total, movie_total, bmp_index, manual
    
    try:
        # 初始化显示参数
        with open('/sys/class/graphics/fb0/virtual_size') as f:
            horizontal, vertical = f.read().strip().split(',')
            print(f"显示分辨率: {horizontal}x{vertical}")
        
        # 加载媒体列表
        list_images(folder_path)
        image_total = len(local_images)
        list_movie(movie_path)
        movie_total = len(local_movies)
        
        # GPIO初始化
        subprocess.run("echo 01 01 > /proc/chenfeng_gpio/gpio3c3", shell=True)
        time.sleep(0.1)
        subprocess.run("echo 01 00 > /proc/chenfeng_gpio/gpio3c3", shell=True)
        
        # 直接进入视频轮播模式
        if movie_total > 0:
            movie_Show(movieShowinList(movie_index))
        
        # 主循环
        while True:
            # 显示当前图片
            bmpShowinList(bmp_index)
            
            # 模式处理
            if manual == 0:
                # 自动轮播模式
                Delay_bmp(3)
                bmp_index = updateIndex(bmp_index, 1, image_total)
            else:
                # 手动模式
                Delay_bmp(0.1)
                
    except Exception as e:
        print(f"系统错误: {str(e)}")
    finally:
        # 清理GPIO
        subprocess.run("echo 01 00 > /proc/chenfeng_gpio/gpio3c3", shell=True)

def find_chinese_font():
    """查找可用的中文字体"""
    font_paths = [
        '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    ]
    for path in font_paths:
        if os.path.exists(path):
            return path
    raise Exception("请安装中文字体：sudo apt install fonts-wqy-microhei")

def get_display_resolution():
    """获取当前显示设备的分辨率"""
    try:
        if os.path.exists('/sys/class/graphics/fb0/virtual_size'):
            with open('/sys/class/graphics/fb0/virtual_size', 'r') as f:
                return tuple(map(int, f.read().strip().split(',')))
        
        try:
            result = subprocess.run(['fbset'], stdout=subprocess.PIPE, text=True)
            if result.returncode == 0:
                for line in result.stdout.split('\n'):
                    if 'geometry' in line:
                        return tuple(map(int, line.split()[1:3]))
        except: pass
        
        return 1920, 1080
    except:
        return 1920, 1080

def show_text(lines, bg_color=(0x80,0x80,0x80), text_color=(255,255,255)):
    """显示多行文本到屏幕"""
    try:
        width, height = get_display_resolution()
        font_path = find_chinese_font()
        
        img = Image.new('RGB', (width, height), bg_color)
        draw = ImageDraw.Draw(img)
        
        # 动态计算字体大小
        font_size = min(width, height) // 25
        font = ImageFont.truetype(font_path, font_size)
        line_spacing = font_size // 2
        
        # 计算总高度和起始位置
        total_height = len(lines) * (font_size + line_spacing)
        y = (height - total_height) // 2
        
        # 逐行绘制文本
        for line in lines:
            bbox = draw.textbbox((0, 0), line, font=font)
            text_width = bbox[2] - bbox[0]
            x = (width - text_width) // 2
            draw.text((x, y), line, font=font, fill=text_color)
            y += font_size + line_spacing
        
        # 写入framebuffer
        bgra = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGRA)
        with open('/dev/fb0', 'wb') as fb:
            fb.write(bgra.tobytes())
            
    except Exception as e:
        print("显示错误:", str(e))
        raise

# ====================== 入口 ======================
if __name__ == "__main__":
    show_text([
        "系统启动中...",
        "按任意按键切换显示模式：",
        "图片轮播 / 视频循环播放",
        "本画面将在5秒后自动进入视频轮播"
    ])
    time.sleep(5)
    main_master()