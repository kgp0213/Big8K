#!/usr/bin/env python3
#20250507
import os
import time
import mmap
import cv2
import numpy as np
import subprocess
from PIL import Image, ImageDraw, ImageFont
import re
import evdev
# 定义按键常量
FORWARD = "04"  #menu
BACKWARD = "03" #esc
RIGHT = "02"    #volume down
LEFT = "01"     #volume up

# 全局变量，存储选择的按键获取方法
getKeyValue = None
adc_device = None
last_key_time = 0
DEBOUNCE_TIME = 0.1  # 200ms防抖时间
last_key_value = ""

def init_key_detection():
    """初始化按键检测方法，只在程序启动时调用一次"""
    global getKeyValue, adc_device

    kernel_version = check_kernel_version()
    print(f"当前内核版本: {kernel_version}")

    if kernel_version == "5.10.209-rk3588":
        print("检测到RK3588内核，使用evdev方式获取按键")
        adc_device = find_adc_device()
        if adc_device:
            getKeyValue = get_key_evdev
        else:
            print("未找到ADC按键设备，回退到默认方式")
            getKeyValue = get_key_default
    else:
        print("使用默认方式获取按键")
        getKeyValue = get_key_default


def check_kernel_version():
    """检测当前系统内核版本"""
    try:
        result = subprocess.run("uname -r", shell=True,
                                capture_output=True, text=True)
        return result.stdout.strip()
    except Exception as e:
        print(f"内核版本检测错误: {str(e)}")
        return ""


def find_adc_device():
    """查找ADC按键设备"""
    try:
        devices = [evdev.InputDevice(path) for path in evdev.list_devices()]
        for device in devices:
            if "adc-keys" in device.name:
                print(f"找到ADC按键设备: {device.path}")
                return device
        return None
    except Exception as e:
        print(f"查找ADC设备错误: {str(e)}")
        return None


def get_key_default():
    """默认按键获取方式"""
    try:
        result = subprocess.run("cat /proc/chenfeng_adckey/chenfeng_adckey",
                                shell=True, capture_output=True, text=True)
        return result.stdout.strip().replace(" ", "")
    except Exception as e:
        print(f"按键读取错误: {str(e)}")
        return ""


def get_key_evdev():
    """使用evdev获取按键值(带防抖功能)"""
    global last_key_time, last_key_value

    try:
        current_time = time.time()

        # 检查是否在防抖时间内
        if current_time - last_key_time < DEBOUNCE_TIME:
            return ""

        # 读取按键事件
        event = adc_device.read_one()
        if event is None:
            return ""

        if event.type == evdev.ecodes.EV_KEY:
            key_event = evdev.categorize(event)

            # 只处理按键按下事件(值为1)，忽略释放事件(值为0)
            if key_event.keystate == 1:  # 按键按下
                # 更新最后按键时间
                last_key_time = current_time

                # 映射到原有按键编码
                if key_event.keycode == "KEY_MENU":
                    last_key_value = FORWARD
                elif key_event.keycode == "KEY_ESC":
                    last_key_value = BACKWARD
                elif key_event.keycode == "KEY_DOWN":
                    last_key_value = RIGHT
                elif key_event.keycode == "KEY_UP":
                    last_key_value = LEFT
                else:
                    last_key_value = ""

                return last_key_value

        return ""

    except Exception as e:
        print(f"evdev按键读取错误: {str(e)}")
        return ""


class FrameBufferWriter:
    def __init__(self):
        # 自动检测分辨率
        self._get_native_resolution()
        self.BYTES_PER_PIXEL = 4  # BGRA格式
        self.FB_DEVICE = "/dev/fb0"
        #self.BMP_DIR = os.path.join(os.path.dirname(__file__), "bmp_online")
        self.BMP_DIR =  "/vismm/fbshow/bmp_online"
        self._find_chinese_font()
        # 初始化流程
        self._verify_environment()
        self._init_framebuffer()
        
        self.frames = self._preload_frames()
        
    def _find_chinese_font(self):
        """查找可用的中文字体"""
        font_paths = [
            '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
            "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        ]
        for path in font_paths:
            if os.path.exists(path):
                self.chinesefontpath=path
                return path
        raise Exception("请安装中文字体：sudo apt install fonts-wqy-microhei")

    def _show_text(self,lines, bg_color=(0x80,0x10,0x10), text_color=(255,255,255)):
        """显示多行文本到屏幕"""  
    
        try:
           
            width=self.SCREEN_WIDTH 
            height=self.SCREEN_HEIGHT
            print(f"✅ 分辨率: {width}x{height}")

            font_path = self.chinesefontpath #self._find_chinese_font()
            
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
    def _get_native_resolution(self):
        """从系统获取原生分辨率"""
        try:
            cmd = "cat /sys/class/graphics/fb0/virtual_size"
            result = subprocess.run(cmd, shell=True, check=True, 
                                  stdout=subprocess.PIPE, universal_newlines=True)    
            resolution = result.stdout.strip()
            width, height = map(int, resolution.split(','))
            
            self.SCREEN_WIDTH = width
            self.SCREEN_HEIGHT = height
            print(f"✅ 当前分辨率: {self.SCREEN_WIDTH}x{self.SCREEN_HEIGHT}")
        except Exception as e:
            print(f"❌ 无法获取分辨率: {str(e)}")
            print("❌ 请手动检查: cat /sys/class/graphics/fb0/virtual_size")
            raise SystemExit(1)  # 直接退出程序，返回错误码1

    def _verify_environment(self):
        """环境验证与错误处理"""
        if not os.path.exists(self.BMP_DIR):
            raise FileNotFoundError(
                f"BMP目录不存在: {self.BMP_DIR}\n"
                f"当前目录内容: {os.listdir(os.path.dirname(__file__))}"
            )
        
        if not os.access(self.FB_DEVICE, os.W_OK):
            raise PermissionError(
                f"需要写权限: {self.FB_DEVICE}\n"
                "请执行: sudo chmod 666 /dev/fb0"
            )
        
        if not os.listdir(self.BMP_DIR):
            self._show_text(["请将BMP文件放入bmp_online目录"])
            raise ValueError("BMP目录为空")
            
    def _init_framebuffer(self):
        """初始化帧缓冲内存映射"""
        self.fb_size = self.SCREEN_WIDTH * self.SCREEN_HEIGHT * self.BYTES_PER_PIXEL
        print(f"📐 计算帧缓冲大小: {self.fb_size}字节")
        
        try:
            self.fb_fd = os.open(self.FB_DEVICE, os.O_RDWR)
            self.mm = mmap.mmap(self.fb_fd, self.fb_size, 
                              mmap.MAP_SHARED, mmap.PROT_WRITE)
            print("💾 帧缓冲初始化成功")
        except ValueError as ve:
            raise RuntimeError(f"映射大小错误: {str(ve)}\n"
                             f"建议: 检查分辨率设置（当前: {self.SCREEN_WIDTH}x{self.SCREEN_HEIGHT}）")
        except Exception as e:
            raise RuntimeError(f"初始化失败: {str(e)}")

    def _preload_frames(self):
        """预加载并预处理BMP帧"""
              
        # 定义自然排序函数
        def natural_sort_key(s):
            """自然排序键函数，支持含数字的文件名排序"""
            _DIGIT_PATTERN = re.compile(r'(\d+)')
            return [
                int(part) if part.isdigit() else part.lower()
                for part in _DIGIT_PATTERN.split(s)
            ]
        
        # 获取并排序BMP文件
        bmp_files = sorted(
            [f for f in os.listdir(self.BMP_DIR) if f.lower().endswith(".bmp")],
            key=lambda x: natural_sort_key(os.path.splitext(x)[0])  # 按文件名（不含扩展名）排序
        )
        print(f"📂 开始加载BMP文件: {self.BMP_DIR}")      
        frame_data = []
        for filename in bmp_files:
            filepath = os.path.join(self.BMP_DIR, filename)
            print(f"✅ 已获取文件路径: {filepath}")
            try:
                img = cv2.imread(filepath, cv2.IMREAD_COLOR)
                if img is None:
                    print(f"⚠️ 跳过无效文件: {filename}")
                    continue
                
                # 创建空白画布
                canvas = np.zeros((self.SCREEN_HEIGHT, self.SCREEN_WIDTH, 4), dtype=np.uint8)
                
                # 获取图片尺寸并计算居中位置
                h, w = img.shape[:2]
                x_offset = (self.SCREEN_WIDTH - w) // 2
                y_offset = (self.SCREEN_HEIGHT - h) // 2
                
                # 将图片放置在画布中央
                if x_offset >= 0 and y_offset >= 0:
                    canvas[y_offset:y_offset+h, x_offset:x_offset+w, :3] = img
                    canvas[y_offset:y_offset+h, x_offset:x_offset+w, 3] = 255  # Alpha通道
                else:
                    # 如果图片比屏幕大，居中裁剪
                    start_x = max(0, -x_offset)
                    start_y = max(0, -y_offset)
                    end_x = min(w, self.SCREEN_WIDTH - x_offset)
                    end_y = min(h, self.SCREEN_HEIGHT - y_offset)
                    
                    canvas[max(0, y_offset):max(0, y_offset)+end_y-start_y, 
                          max(0, x_offset):max(0, x_offset)+end_x-start_x, :3] = \
                        img[start_y:end_y, start_x:end_x]
                    canvas[max(0, y_offset):max(0, y_offset)+end_y-start_y, 
                          max(0, x_offset):max(0, x_offset)+end_x-start_x, 3] = 255
                
                frame_data.append(canvas.tobytes())
                print(f"✅ 已加载: {filename}")
            except Exception as e:
                print(f"⚠️ 处理文件 {filename} 失败: {str(e)}")
        
        if not frame_data:
            raise ValueError("没有有效的BMP文件可加载")
        print(f"🎬 成功加载 {len(frame_data)} 帧")
        return frame_data

    def _write_frame(self, frame_data):
        """原子化帧写入操作"""
        self.mm.seek(0)
        self.mm.write(frame_data)
        self.mm.flush()
    def _manual_control_mode(self):
        """手动控制模式"""
        print("\n🔄 进入手动控制模式")
        self._show_text(["手动控制模式", "MENU/ESC 键切换图片", "V+/V-进入自动模式"], bg_color=(0x10,0x80,0x10))
        time.sleep(1)
        
        while True:
            keyValue = getKeyValue()
            
            if keyValue == FORWARD:
                self.current_frame_index = (self.current_frame_index + 1) % len(self.frames)
                self._write_frame(self.frames[self.current_frame_index])
                print(f"keyValue：{keyValue},⏩ 前进到第 {self.current_frame_index + 1} 帧")
                time.sleep(0.3)  # 防抖延时
                
            elif keyValue == BACKWARD:
                self.current_frame_index = (self.current_frame_index - 1) % len(self.frames)
                self._write_frame(self.frames[self.current_frame_index])
                print(f"keyValue：{keyValue},⏪ 后退到第 {self.current_frame_index + 1} 帧")
                time.sleep(0.3)  # 防抖延时
                
            elif keyValue in [RIGHT, LEFT]:
                print(f"keyValue：{keyValue},进入自动模式")
                self._show_text(["自动模式", "MENU/ESC进入手动模式"], bg_color=(0x10,0x80,0x10))
                time.sleep(1)
                print("\n⏹ 退出手动控制模式")
                break
                
            time.sleep(0.1)  # 降低CPU占用
    def run(self, delay_seconds=1.0):
        """简化播放循环，使用固定延时"""
        print(f"\n▶ 开始播放 | 图片切换延时: {delay_seconds}秒")
        
        try:
            while True:
                for i, frame in enumerate(self.frames):
                        self.current_frame_index = i
                        self._write_frame(frame)
                        
                        # 检查按键
                        start_time = time.time()
                        while time.time() - start_time < delay_seconds:
                            keyValue = getKeyValue()
                            if keyValue in [FORWARD, BACKWARD]:
                                self._manual_control_mode()
                                break  # 退出内层循环，继续自动播放
                            time.sleep(0.1)  # 降低CPU占用

        except KeyboardInterrupt:
            print("\n⏹ 用户终止播放")
        finally:
            self.mm.close()
            os.close(self.fb_fd)
            print("🛑 已释放帧缓冲资源")


if __name__ == "__main__":
    init_key_detection()
    try:
        import argparse
        parser = argparse.ArgumentParser(description='BMP图片播放器')
        parser.add_argument('--delay', type=float, default=2.0,
                          help='图片切换延时（秒）')
        args = parser.parse_args()
        
        player = FrameBufferWriter()
        player._show_text([
            "系统启动中...",
            "自动检测并播放图片",
            "3秒后自动图片轮播",
            " ",
            "MENU/ESC键手动控制"
        ],bg_color=(0x80,0x80,0x80))
        time.sleep(3)
        player.run(delay_seconds=args.delay)
		# 默认1秒切换:	 python3 script.py; 	# 指定0.5秒切换: python3 script.py --delay 0.5
    except Exception as e:
        print(f"\n❌ 严重错误: {str(e)}")
        print("🛠️ 故障排查指南:")   
        print("1. 分辨率验证:")
        print("   cat /sys/class/graphics/fb0/virtual_size")
        print("2. BMP文件检查:")
        print(" 文件路径以及文件格式")
        