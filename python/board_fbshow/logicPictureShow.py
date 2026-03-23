#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# # 调用方式示例：
# # 显示pattern 5并进入交互模式
#   ./logic_display.py 5 1  
# # 仅显示pattern 2后退出
#   ./logic_display.py 2
# # 显示默认画面后退出
#   ./logic_display.py
# 交互控制，同时支持物理按键和鼠标控制​：# 
#   左键/滚轮向前切换模式#   右键/按键02退出程序#   独立线程处理输入事件
import cv2
import numpy as np
import mmap
import argparse
import os
import subprocess
import logging
import struct
import time
from threading import Thread, Lock
from time import sleep

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
    def __init__(self, initial_pattern=0, persistent=False):
        self.fb = FrameBuffer()
        self.current_pattern = initial_pattern
        self.persistent = persistent
        self.running = True
        self.pattern_lock = Lock()
        self.logic_patterns = {}
        self._init_patterns()
        
        # 初始化默认显示
        self._update_display()

    def _init_patterns(self):
        # 初始化所有模式对应的生成函数
        # 0-垂直ColorBar
        # 1-水平ColorBar
        # 2-横向256渐变1
        # 3-横向256渐变2
        # 4-竖向256渐变1
        # 5-竖向256渐变2
        # 6-横向ColorBar 256渐变1
        # 7-横向ColorBar 256渐变2
        # 8-竖向ColorBar 256渐变1
        # 9-竖向ColorBar 256渐变2
        # 10-黑底白边框
        # 11-Crosstalk1
        # 12-Crosstalk2
        # 13-Crosstalk3
        # 14-Crosstalk4
        # 15-1Dot inversion
        # 16-棋盘格1
        # 17-棋盘格2
        # 18-棋盘格3
        # 19-棋盘格4
        # 20-红256渐变
        # 21-绿256渐变
        # 22-蓝256渐变
        # 23-正方向“F”字
        # 24-线条
        # 25-圆形
        # 26-15%白
        # 27-255灰阶
        # 28-128灰阶
        # 29-64灰阶
        # 30-32灰阶
        # 31-16灰阶
        # 32-黑
        # 33-单黑线
        # 34-炫彩1
        # 35-炫彩2
        # 36-炫彩3
        # 37-炫彩4
        # 38-黑白1
        # 39-黑白2
        self.logic_patterns = {
            0: self.vertical_color_bar,
            1: self.horizontal_color_bar,
            2: self.horizontal_gradient_1,
            3: self.horizontal_gradient_2,
            4: self.vertical_gradient_1,
            5: self.vertical_gradient_2,
            6: self.horizontal_colorbar_gradient_1,
            7: self.horizontal_colorbar_gradient_2,
            8: self.vertical_colorbar_gradient_1,
            9: self.vertical_colorbar_gradient_2,
            10: self.black_white_border,
            11: self.crosstalk1,
            12: self.crosstalk2,
            13: self.interlaced_black_white_rows,
            14: self.interlaced_black_white_cols,
            15: self.dot_inversion,
            16: self.checkerboard1,
            17: self.checkerboard2,
            18: self.checkerboard3,
            19: self.checkerboard4,
            20: self.red_gradient,
            21: self.green_gradient,
            22: self.blue_gradient,
            23: self.letter_f,
            24: self.line_pattern,
            25: self.circle_pattern,
            26: self.distance_field_gradient,
            27: self.gray_255,
            28: self.gray_128,
            29: self.gray_64,
            30: self.gray_32,
            31: self.gray_16,
            32: self.black_screen,
            33: self.single_black_line,
            34: self.colorful_pattern1,
            35: self.colorful_pattern2,
            36: self.colorful_pattern3,
            37: self.colorful_pattern4,
            38: self.black_white_pattern1,
            39: self.gray_255,  #备用
        }        

    # 以下是各模式生成函数 --------------------------------------------

    def distance_field_gradient(self):
        """26-距离场渐变（边缘黑到中心白）"""
        height = self.fb.screen_height
        width = self.fb.screen_width

        # 计算最大可能距离（从中心到最近边缘的距离）
        max_distance = min(width, height) / 2.0

        # 创建坐标网格
        y, x = np.ogrid[:height, :width]

        # 计算到四条边的距离
        dist_left = x  # 到左边界的距离
        dist_right = width - 1 - x  # 到右边界的距离
        dist_top = y  # 到上边界的距离
        dist_bottom = height - 1 - y  # 到下边界的距离

        # 找到到最近边界的距离
        min_dist_to_edge = np.minimum(
            np.minimum(dist_left, dist_right),
            np.minimum(dist_top, dist_bottom)
        )

        # 归一化距离并计算灰度值（边缘为0，中心为255）
        normalized_dist = np.clip(min_dist_to_edge / max_distance, 0, 1.0)
        gray_value = (normalized_dist * 255).astype(np.uint8)

        # 创建3通道灰度图像
        return np.dstack([gray_value, gray_value, gray_value])

    def vertical_color_bar(self):
        """0-垂直ColorBar"""
        img = np.zeros((self.fb.screen_height, self.fb.screen_width, 3), dtype=np.uint8)
        colors = [
            (255,0,0), (0,255,0), (0,0,255),
            (255,255,0), (0,255,255), (255,0,255),
            (255,255,255), (0,0,0)
        ]
        bar_width = self.fb.screen_width // len(colors)
        for i, color in enumerate(colors):
            start = i * bar_width
            end = (i+1)*bar_width if i < len(colors)-1 else self.fb.screen_width
            img[:, start:end] = color
        return img

    def horizontal_color_bar(self):
        """1-水平ColorBar"""
        img = np.zeros((self.fb.screen_height, self.fb.screen_width, 3), dtype=np.uint8)
        colors = [
            (255,0,0), (0,255,0), (0,0,255),
            (255,255,0), (0,255,255), (255,0,255),
            (255,255,255), (0,0,0)
        ]
        bar_height = self.fb.screen_height // len(colors)
        for i, color in enumerate(colors):
            start = i * bar_height
            end = (i+1)*bar_height if i < len(colors)-1 else self.fb.screen_height
            img[start:end, :] = color
        return img

    def horizontal_gradient_1(self):
        """2-横向256渐变1"""
        grad = np.linspace(0, 255, self.fb.screen_width, dtype=np.uint8)
        return np.dstack([grad]*3).repeat(self.fb.screen_height, 0)

    def horizontal_gradient_2(self):
        """3-横向256渐变2（反向）"""
        grad = np.linspace(255, 0, self.fb.screen_width, dtype=np.uint8)
        return np.dstack([grad]*3).repeat(self.fb.screen_height, 0)

    def vertical_gradient_1(self):
        """4-竖向256渐变1"""
        grad = np.linspace(0, 255, self.fb.screen_height, dtype=np.uint8)
        return np.dstack([grad]*3).repeat(self.fb.screen_width, 1)

    def vertical_gradient_2(self):
        """5-竖向256渐变2（反向）"""
        grad = np.linspace(255, 0, self.fb.screen_height, dtype=np.uint8)
        return np.dstack([grad]*3).repeat(self.fb.screen_width, 1)

    def horizontal_colorbar_gradient_1(self):
        """6-横向ColorBar 256渐变1"""
        img = np.zeros((self.fb.screen_height, self.fb.screen_width, 3), dtype=np.uint8)
        color_bars = 6
        bar_width = self.fb.screen_width // color_bars
        for i in range(color_bars):
            start = i * bar_width
            end = (i+1)*bar_width if i < color_bars-1 else self.fb.screen_width
            grad = np.linspace(0, 255, end-start, dtype=np.uint8)
            img[:, start:end, i%3] = grad
        return img

    def horizontal_colorbar_gradient_2(self):
        """7-横向ColorBar 256渐变2"""
        img = np.zeros((self.fb.screen_height, self.fb.screen_width, 3), dtype=np.uint8)
        color_bars = 6
        bar_width = self.fb.screen_width // color_bars
        for i in range(color_bars):
            start = i * bar_width
            end = (i+1)*bar_width if i < color_bars-1 else self.fb.screen_width
            grad = np.linspace(255, 0, end-start, dtype=np.uint8)
            img[:, start:end, i%3] = grad
        return img

    def vertical_colorbar_gradient_1(self):
        """8-竖向ColorBar 256渐变1"""
        img = np.zeros((self.fb.screen_height, self.fb.screen_width, 3), dtype=np.uint8)
        color_bars = 6
        bar_height = self.fb.screen_height // color_bars
        for i in range(color_bars):
            start = i * bar_height
            end = (i+1)*bar_height if i < color_bars-1 else self.fb.screen_height
            grad = np.linspace(0, 255, end-start, dtype=np.uint8)[:, np.newaxis]
            img[start:end, :, i%3] = grad
        return img

    def vertical_colorbar_gradient_2(self):
        """9-竖向ColorBar 256渐变2"""
        img = np.zeros((self.fb.screen_height, self.fb.screen_width, 3), dtype=np.uint8)
        color_bars = 6
        bar_height = self.fb.screen_height // color_bars
        for i in range(color_bars):
            start = i * bar_height
            end = (i+1)*bar_height if i < color_bars-1 else self.fb.screen_height
            grad = np.linspace(255, 0, end-start, dtype=np.uint8)[:, np.newaxis]
            img[start:end, :, i%3] = grad
        return img

    def black_white_border(self):
        """10-黑底白边框"""
        img = np.zeros((self.fb.screen_height, self.fb.screen_width, 3), dtype=np.uint8)
        border = 1
        img[:border, :] = 255
        img[-border:, :] = 255
        img[:, :border] = 255
        img[:, -border:] = 255
        return img

    def crosstalk1(self):
        """11-竖直线条交替（1像素间隔）"""
        img = np.full((self.fb.screen_height, self.fb.screen_width, 3), 255, dtype=np.uint8)
        # 每2像素绘制黑色垂直线
        img[:, ::2] = 0
        return img

    def crosstalk2(self):
        """12-水平线条交替（1像素间隔）"""
        img = np.full((self.fb.screen_height, self.fb.screen_width, 3), 255, dtype=np.uint8)
        # 每2像素绘制黑色水平线
        img[::2, :] = 0
        return img

    def interlaced_black_white_rows(self):
        """13-隔行黑白 （2像素间隔）"""
        img = np.zeros((self.fb.screen_height, self.fb.screen_width, 3), dtype=np.uint8)
        # 偶数行设为白色
        img[::4, :] = 255
        return img

    def interlaced_black_white_cols(self):
        """14-隔列黑白  （2像素间隔）"""
        img = np.zeros((self.fb.screen_height, self.fb.screen_width, 3), dtype=np.uint8)
        # 偶数列设为白色
        img[:, ::4] = 255
        return img

    def dot_inversion(self):
        """15-点反转（像素级反转）"""
        img = np.zeros((self.fb.screen_height, self.fb.screen_width, 3), dtype=np.uint8)
        # 通过异或运算生成反转模式
        pattern = (np.indices(img.shape[:2]).sum(axis=0) % 2).astype(bool)
        img[pattern] = 255
        return img

    def checkerboard1(self):
        """16-棋盘格1（精确8x8像素块）"""
        # 生成基础8x8块
        base = np.zeros((8, 8, 3), dtype=np.uint8)
        base[::2, ::2] = 255    # 偶数行偶数列白
        base[1::2, 1::2] = 255  # 奇数行奇数列白
        # 计算平铺数量
        tiles_y = self.fb.screen_height // 8 + 1
        tiles_x = self.fb.screen_width // 8 + 1
        # 生成完整棋盘格
        full_board = np.tile(base, (tiles_y, tiles_x, 1))
        return full_board[:self.fb.screen_height, :self.fb.screen_width]

    def checkerboard2(self):
        """17-棋盘格2（精确16x16像素块）"""
        # 创建16x16基础块
        base = np.zeros((16, 16, 3), dtype=np.uint8)
        base[0:8, 0:8] = 255    # 左上1/4白
        base[8:16, 8:16] = 255  # 右下1/4白
        # 平铺计算
        tiles_y = self.fb.screen_height // 16 + 1
        tiles_x = self.fb.screen_width // 16 + 1
        full_board = np.tile(base, (tiles_y, tiles_x, 1))
        return full_board[:self.fb.screen_height, :self.fb.screen_width]

    def checkerboard3(self):
        """18-棋盘格3（32x32像素块，精确对角线分割）"""
        block = np.zeros((32, 32, 3), dtype=np.uint8)
        # 生成斜对角线分割
        for i in range(32):
            block[i, i:i+8] = 255  # 8像素宽对角线
        # 镜像生成完整块
        full_block = np.tile(block, (2, 2, 1))
        # 平铺到屏幕
        tiles_y = self.fb.screen_height // 64 + 1
        tiles_x = self.fb.screen_width // 64 + 1
        full_board = np.tile(full_block, (tiles_y, tiles_x, 1))
        return full_board[:self.fb.screen_height, :self.fb.screen_width]

    def checkerboard4(self):
        """19-棋盘格4（64x64动态渐变棋盘）"""
        # 生成基础渐变块
        x = np.linspace(0, 255, 64)
        y = np.linspace(255, 0, 64)
        xx, yy = np.meshgrid(x, y)
        base = np.zeros((64, 64, 3), dtype=np.uint8)
        base[..., 0] = xx  # 红色通道水平渐变
        base[..., 1] = yy  # 绿色通道垂直渐变
        # 创建棋盘掩模
        mask = np.zeros((64,64), dtype=bool)
        mask[::8, ::8] = True  # 每8像素设置一个棋盘点
        base[mask] = 255       # 棋盘点设为纯白
        # 平铺处理
        tiles_y = self.fb.screen_height // 64 + 1
        tiles_x = self.fb.screen_width // 64 + 1
        full_board = np.tile(base, (tiles_y, tiles_x, 1))
        return full_board[:self.fb.screen_height, :self.fb.screen_width]
    def red_gradient(self):
        """20-红256渐变"""
        grad = np.linspace(0, 255, self.fb.screen_width, dtype=np.uint8)
        return np.dstack([np.zeros_like(grad), np.zeros_like(grad), grad]).repeat(self.fb.screen_height, 0)

    def green_gradient(self):
        """21-绿256渐变"""
        grad = np.linspace(0, 255, self.fb.screen_width, dtype=np.uint8)
        return np.dstack([np.zeros_like(grad), grad, np.zeros_like(grad)]).repeat(self.fb.screen_height, 0)

    def blue_gradient(self):
        """22-蓝256渐变"""
        grad = np.linspace(0, 255, self.fb.screen_width, dtype=np.uint8)
        return np.dstack([grad, np.zeros_like(grad), np.zeros_like(grad)]).repeat(self.fb.screen_height, 0)

    def letter_f(self):
        """23-正方向'F'（自定义绘制版）"""
        img = np.full((self.fb.screen_height, self.fb.screen_width, 3), 128, dtype=np.uint8)
        
        # 计算笔画尺寸（占屏幕75%）
        f_height = int(self.fb.screen_height * 0.75)  # F的总高度
        f_width = int(self.fb.screen_width * 0.5)     # F的总宽度
        stroke_thickness = max(2, int(min(self.fb.screen_width, self.fb.screen_height) * 0.15))  # 笔画粗细
        
        # 计算起始位置（居中）
        start_x = (self.fb.screen_width - f_width) // 2
        start_y = (self.fb.screen_height - f_height) // 2
        
        # 绘制垂直竖线（左侧主干）
        cv2.rectangle(img, 
                    (start_x, start_y),
                    (start_x + stroke_thickness, start_y + f_height),
                    (0, 0, 0), -1)
        
        # 绘制顶部横线
        top_bar_length = f_width
        cv2.rectangle(img,
                    (start_x, start_y),
                    (start_x + top_bar_length, start_y + stroke_thickness),
                    (0, 0, 0), -1)
        
        # 绘制中间横线（长度约为顶部横线的2/3）
        middle_bar_length = int(top_bar_length * 0.66)
        middle_y = start_y + f_height // 3
        cv2.rectangle(img,
                    (start_x, middle_y),
                    (start_x + middle_bar_length, middle_y + stroke_thickness),
                    (0, 0, 0), -1)
        
        return img

    def line_pattern(self):
        """24-线条"""
        img = np.full((self.fb.screen_height, self.fb.screen_width, 3), 255, dtype=np.uint8)
        # 绘制对角线
        cv2.line(img, (0,0), (self.fb.screen_width, self.fb.screen_height), (0,0,0), 3)
        cv2.line(img, (0,self.fb.screen_height), (self.fb.screen_width,0), (0,0,0), 3)
        return img

    def circle_pattern(self):
        """25-圆形"""
        img = np.full((self.fb.screen_height, self.fb.screen_width, 3), 128, dtype=np.uint8)
        center = (self.fb.screen_width//2, self.fb.screen_height//2)
        radius = min(self.fb.screen_width, self.fb.screen_height)//4
        cv2.circle(img, center, radius, (0,0,255), -1)  # 实心蓝色圆形
        return img

    def gray_255(self):
        """27-255灰阶 (纯白)"""
        return np.full((self.fb.screen_height, self.fb.screen_width, 3), 255, dtype=np.uint8)

    def gray_128(self):
        """28-128灰阶"""
        return np.full((self.fb.screen_height, self.fb.screen_width, 3), 128, dtype=np.uint8)

    def gray_64(self):
        """29-64灰阶"""
        return np.full((self.fb.screen_height, self.fb.screen_width, 3), 64, dtype=np.uint8)

    def gray_32(self):
        """30-32灰阶"""
        return np.full((self.fb.screen_height, self.fb.screen_width, 3), 32, dtype=np.uint8)

    def gray_16(self):
        """31-16灰阶"""
        return np.full((self.fb.screen_height, self.fb.screen_width, 3), 16, dtype=np.uint8)

    def black_screen(self):
        """32-黑"""
        return np.zeros((self.fb.screen_height, self.fb.screen_width, 3), dtype=np.uint8)

    def single_black_line(self):
        """33-单黑线"""
        img = np.full((self.fb.screen_height, self.fb.screen_width, 3), 255, dtype=np.uint8)
        cv2.line(img, 
                (0, self.fb.screen_height//2),
                (self.fb.screen_width, self.fb.screen_height//2),
                (0,0,0), 2)
        return img

    def colorful_pattern1(self):
        """34-炫彩1（彩虹渐变）"""
        grad = np.linspace(0, 255, self.fb.screen_width, dtype=np.uint8)
        return np.dstack((
            grad,  # 红色通道渐变
            np.roll(grad, self.fb.screen_width//3),  # 绿色通道偏移
            np.roll(grad, 2*self.fb.screen_width//3)  # 蓝色通道偏移
        )).repeat(self.fb.screen_height, 0)

    def colorful_pattern2(self):
        """35-炫彩2（对角渐变）"""
        x = np.linspace(0, 255, self.fb.screen_width)
        y = np.linspace(0, 255, self.fb.screen_height)
        xx, yy = np.meshgrid(x, y)
        return np.dstack((
            (xx + yy) % 256,  # 红色通道
            (xx * 2) % 256,    # 绿色通道 
            (yy * 2) % 256     # 蓝色通道
        )).astype(np.uint8)

    def colorful_pattern3(self):
        """36-炫彩3（同心圆）"""
        y, x = np.ogrid[:self.fb.screen_height, :self.fb.screen_width]
        center_x = self.fb.screen_width // 2
        center_y = self.fb.screen_height // 2
        radius = np.sqrt((x - center_x)**2 + (y - center_y)**2)
        return np.dstack((
            (np.sin(radius/30) * 127 + 128).astype(np.uint8),  # 红色通道
            (np.cos(radius/20) * 127 + 128).astype(np.uint8),  # 绿色通道
            (radius % 256).astype(np.uint8)                    # 蓝色通道
        ))

    def colorful_pattern4(self):
        """37-炫彩4（随机噪点）"""
        return np.random.randint(0, 256, 
                                (self.fb.screen_height, self.fb.screen_width, 3),
                                dtype=np.uint8)

    def black_white_pattern1(self):
        """38-黑白1（斜条纹）"""
        img = np.zeros((self.fb.screen_height, self.fb.screen_width, 3), dtype=np.uint8)
        stripe_width = 20
        for i in range(0, self.fb.screen_width + self.fb.screen_height, stripe_width*2):
            cv2.line(img, 
                    (i, 0), 
                    (i - self.fb.screen_height, self.fb.screen_height),
                    (255,255,255), 
                    stripe_width)
        return img

    def reserved_pattern(self):
        """预留模式"""
        img = np.full((self.fb.screen_height, self.fb.screen_width, 3), 128, dtype=np.uint8)
        cv2.putText(img, 'Reserved', (50, self.fb.screen_height//2),
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,0), 2)
        return img

    def generate_default(self):
        """默认模式"""
        img = np.full((self.fb.screen_height, self.fb.screen_width, 3), 128, dtype=np.uint8)
        cv2.putText(img, 'Logic Picture', 
                   (self.fb.screen_width//4, self.fb.screen_height//2),
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,0), 2)
        return img

    def generate_gradient(self):
        """无效参数显示灰度渐变"""
        grad = np.linspace(0, 255, self.fb.screen_width, dtype=np.uint8)
        return np.dstack([grad]*3).repeat(self.fb.screen_height, 0)

    def generate_frame(self):
        if self.pattern is None:
            return self.generate_default()
        elif 0 <= self.pattern <= 39:
            return self.logic_patterns[self.pattern]()
        else:
            return self.generate_gradient()
    
    def getKeyValue(self):
        """获取物理按键值"""
        try:
            result = subprocess.run("cat /proc/chenfeng_adckey/chenfeng_adckey", 
                                  shell=True, capture_output=True, text=True)
            time.sleep(0.1)
            return result.stdout.strip().replace(" ", "")
        except Exception as e:
            logging.error(f"Key read error: {str(e)}")
            return ""

    def handle_keys(self):
        """处理物理按键的线程函数"""
        while self.running:
            key = self.getKeyValue()
            if key == "03":   # 向前切换
                self._change_pattern(1)
            elif key == "04": # 向后切换
                self._change_pattern(-1)
            elif key == "02": # 退出程序
                self.running = False
            sleep(0.1)

    def handle_mouse(self, device_path):
        """处理鼠标事件的线程函数"""
        try:
            with open(device_path, 'rb') as f:
                while self.running:
                    data = f.read(24)
                    if len(data) == 24:
                        _, _, ev_type, code, value = struct.unpack('llHHI', data)
                        
                        # 处理滚轮事件
                        if ev_type == 2 and code == 8:
                            self._change_pattern(1 if value < 0x7FFFFFFF else -1)
                        
                        # 处理按键事件
                        elif ev_type == 1:
                            # 左键按下
                            if code == 272 and value == 1: 
                                self._change_pattern(1)
                            # 右键按下
                            elif code == 273 and value == 1:
                                self.running = False
        except Exception as e:
            logging.error(f"Mouse error: {str(e)}")

    def _change_pattern(self, delta):
        """安全修改当前模式"""
        with self.pattern_lock:
            new_pattern = (self.current_pattern + delta) % 39
            if new_pattern != self.current_pattern:
                self.current_pattern = new_pattern
                logging.info(f"Switch to pattern {self.current_pattern}")
                self._update_display()

    def _update_display(self):
        """刷新显示内容"""
        if 0 <= self.current_pattern <= 39:
            frame = self.logic_patterns[self.current_pattern]()
        else:
            frame = self.generate_gradient()
        self.fb.update_once(frame)

    def start_interactive(self):
        """启动交互模式"""
        # 启动按键检测线程
        Thread(target=self.handle_keys, daemon=True).start()
        
        # 启动鼠标检测
        mouse_devices = [os.path.join('/dev/input/by-path', d) 
                        for d in os.listdir('/dev/input/by-path') if 'event-mouse' in d]
        if mouse_devices:
            Thread(target=self.handle_mouse, args=(mouse_devices[0],), daemon=True).start()
        
        # 主循环
        try:
            while self.running:
                sleep(0.1)
            # 退出时保留最后一帧
        except KeyboardInterrupt:
            self.running = False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Logic Picture Display')
    parser.add_argument('pattern', type=int, nargs='?', default=-1,
                      help='Initial display pattern (0-39)')
    parser.add_argument('persist', type=int, nargs='?', default=0,
                      help='Persistent mode flag')
    
    args = parser.parse_args()
    
    # 参数验证
    initial_pattern = args.pattern if 0 <= args.pattern <=39 else 0
    persistent_mode = args.persist >= 1

    system = InteractiveSystem(initial_pattern=initial_pattern, 
                              persistent=persistent_mode)
    
    if persistent_mode:
        system.start_interactive()
    else:
        # 非持久模式直接显示后退出
        if args.pattern == -1:
            system.fb.update_once(system.generate_default())
        else:
            system.fb.update_once(system.logic_patterns[initial_pattern]())
        sleep(0.5)  # 确保帧写入完成