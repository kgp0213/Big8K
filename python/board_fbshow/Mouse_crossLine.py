#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# 主要功能说明：
# 1,​参数处理​：
#   支持四个命令行参数：gray_value、lineColor、lineX、lineY
#   自动获取屏幕分辨率设置默认坐标
#   参数范围自动限制（0-255或屏幕尺寸内）
# 2,​显示功能​：
#   实时生成包含以下元素的画面：
#       可调灰度背景
#       动态颜色十字线
#       坐标位置实时显示
#   智能文本颜色（根据背景灰度自动切换黑白）
# 3,​鼠标交互​：
#   右键拖动：调节背景灰度
#   左键拖动：调节十字线位置
#   滚轮调节：十字线亮度（0-255）

import cv2
import numpy as np
import mmap
import argparse
import os
import subprocess
import logging
import struct
from threading import Thread, Lock
from time import sleep
from collections import deque

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
class FrameBuffer:
    def __init__(self):
        self.lock = Lock()
        self.screen_width, self.screen_height = self.get_resolution()
        self.fb_path = '/dev/fb0'
        self.fb_size = self.screen_height * self.screen_width * 4
        self._dirty = False
        
    def get_resolution(self):
        try:
            cmd = "cat /sys/class/graphics/fb0/virtual_size"
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            return tuple(map(int, result.stdout.strip().split(',')))
        except:
            return (800, 600)

    def update_once(self, image: np.ndarray) -> None:
        with self.lock:
            try:
                with open(self.fb_path, 'r+b') as fb:
                    mm = mmap.mmap(fb.fileno(), self.fb_size, mmap.MAP_SHARED, mmap.PROT_WRITE)
                    if image.shape[2] == 3:
                        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGRA)
                    mm.write(image.tobytes())
                    mm.close()
                    self._dirty = False
            except Exception as e:
                logging.error(f"Frame buffer error: {str(e)}")

class InteractiveSystem:
    def __init__(self, args):
        self.fb = FrameBuffer()
        self.params = {
            'gray_value': args.gray_value,
            'lineX': args.lineX,
            'lineY': args.lineY,
            'line_rgb': args.lineColor
        }
        self.params_lock = Lock()
        self.running = True
        self._init_defaults()

    def _init_defaults(self):
        with self.params_lock:
            self.params['lineX'] = int(np.clip(self.params['lineX'], 0, self.fb.screen_width-1))
            self.params['lineY'] = int(np.clip(self.params['lineY'], 0, self.fb.screen_height-1))
            self.line_color = self._calc_line_color(self.params['line_rgb'])

    def _calc_line_color(self, line_rgb):
        value = int(np.clip(line_rgb, 0, 255))
        return (value, value, value)

    def generate_frame(self):
        with self.params_lock:
            # 确保坐标值为整数
            lineY = int(np.clip(self.params['lineY'], 0, self.fb.screen_height-1))
            lineX = int(np.clip(self.params['lineX'], 0, self.fb.screen_width-1))
            
            frame = np.full((self.fb.screen_height, self.fb.screen_width, 3), 
                          self.params['gray_value'], dtype=np.uint8)
            
            # 使用验证后的坐标值
            cv2.line(frame, (0, lineY), (self.fb.screen_width, lineY), 
                    self.line_color, 2)
            cv2.line(frame, (lineX, 0), (lineX, self.fb.screen_height), 
                    self.line_color, 2)
            
            text_color = (0, 0, 0) if self.params['gray_value'] > 127 else (255, 255, 255)
            text = f"X:{lineX} Y:{lineY} rgb:{self.params['gray_value']}"
            (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            text_x = min(lineX + 20, self.fb.screen_width - tw)
            text_y = min(lineY + 20, self.fb.screen_height - th)
            cv2.putText(frame, text, (text_x, text_y), cv2.FONT_HERSHEY_SIMPLEX,
                      0.5, text_color, 1, cv2.LINE_AA)
            return frame

    def handle_mouse(self, device_path):
        button_state = {'left': False, 'right': False}
        try:
            with open(device_path, 'rb') as f:
                while self.running:
                    data = f.read(24)
                    if len(data) == 24:
                        _, _, ev_type, code, value = struct.unpack('llHHI', data)
                        
                        # # 添加原始输入日志
                        # if ev_type == 2:  # 鼠标移动事件包含滚轮移动
                        #     axis_type = "X" if code == 0 else "Y" if code == 1 else "Other"
                        #     logging.info(f"Mouse input - Type:{ev_type} Code:{code}({axis_type}) Value:{value}")

                        if value > 0x7FFFFFFF: value -= 0x100000000
                                # 处理Linux输入子系统返回的32位无符号值，将其转换为有符号整数。
                        if ev_type == 2 and code == 8:  # 滚轮事件
                            with self.params_lock:
                                old_line_rgb = self.params['line_rgb']  # 记录旧值
                                self.params['line_rgb'] = (self.params['line_rgb'] + (1 if value < 0x7FFFFFFF else -1))%256
                                # 添加颜色变化日志
                                if self.params['line_rgb'] != old_line_rgb:
                                    logging.info(f"LineColor changed: {old_line_rgb} → {self.params['line_rgb']}")
                                self.line_color = self._calc_line_color(self.params['line_rgb'])
                                self.fb._dirty = True
                        
                        if ev_type == 1:  # 按钮事件，ev_type == 1 表示按键事件
                            if code == 272: ## 左键事件码为 272，右键事件码为 273
                                button_state['left'] = (value == 1)
                            elif code == 273:
                                button_state['right'] = (value == 1)
                            logging.info(f"Mouse click - Type:{ev_type} Code:{code}(button_state:{button_state}) Value:{value}")
                        
                        if ev_type == 2:  # 移动事件
                            with self.params_lock:
                                changed = False
                                if code == 0 and button_state['right']:  # code == 0对应x方向，移动鼠标调整灰度值
                                    old_gray = self.params['gray_value']
                                   
                                    new_val = (old_gray + value)%256                                    
                                    self.params['gray_value'] = new_val
                                    changed = True
                                    # 添加灰度变化日志
                                    logging.info(f"GrayValue changed: {old_gray} → {new_val}")
                                        
                                elif code == 1 and button_state['left']:  # 调整Y轴
                                    old_y = self.params['lineY']
                                    
                                    new_val = (old_y + value)%self.fb.screen_height
                                    if new_val != old_y:
                                        self.params['lineY'] = new_val
                                        changed = True
                                    # 添加Y坐标变化日志
                                    logging.info(f"LineY changed: {old_y} → {new_val}")
                                        
                                elif code == 0 and button_state['left']:  # 调整X轴
                                    old_x = self.params['lineX']
                                    
                                    new_val = (old_x + value )%self.fb.screen_width
                                    if new_val != old_x:
                                        self.params['lineX'] = new_val
                                        changed = True
                                    # 添加X坐标变化日志
                                    logging.info(f"LineX changed: {old_x} → {new_val}")
                                        
                                if changed:
                                    self.fb._dirty = True
        except Exception as e:
            logging.error(f"Mouse error: {str(e)}")

    def start(self):
        mouse_devices = [os.path.join('/dev/input/by-path', d) 
                        for d in os.listdir('/dev/input/by-path') if 'event-mouse' in d]
        
        if mouse_devices:
            Thread(target=self.handle_mouse, args=(mouse_devices[0],), daemon=True).start()
            logging.info("Mouse listener started")

        try:
            initial_frame = self.generate_frame()
            self.fb.update_once(initial_frame)
            
            while self.running:
                if self.fb._dirty:
                    frame = self.generate_frame()
                    self.fb.update_once(frame)
                sleep(0.01)
        except KeyboardInterrupt:
            self.running = False

if __name__ == "__main__":
    fb = FrameBuffer()
    
    parser = argparse.ArgumentParser(description='Embedded Crosshair Display')
    parser.add_argument('--gray_value', type=int, default=128, help='Background gray (0-255)')
    parser.add_argument('--lineColor', type=int, default=255, help='Crosshair brightness (0-255)')
    parser.add_argument('--lineX', type=int, default=fb.screen_width//2, 
                      help=f'Initial X (default {fb.screen_width//2})')
    parser.add_argument('--lineY', type=int, default=fb.screen_height//2,
                      help=f'Initial Y (default {fb.screen_height//2})')
    
    args = parser.parse_args()
    
    system = InteractiveSystem(args)
    system.start()