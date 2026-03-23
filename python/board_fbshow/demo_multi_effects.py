#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
8K Display Multi Demo - 多种显示效果演示
在 Framebuffer 上显示各种效果
"""

import struct
import time
import subprocess
import random

def get_screen_resolution():
    """获取屏幕分辨率"""
    try:
        cmd = "cat /sys/class/graphics/fb0/virtual_size"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, check=True)
        resolution = result.stdout.strip()
        width, height = map(int, resolution.split(','))
        return width, height
    except:
        return 7680, 4320

def fill_screen_color(color_rgb, duration=1.0):
    """用指定颜色填充整个屏幕"""
    width, height = get_screen_resolution()
    
    # 转换为 BGRA 格式 (32-bit)
    b = (color_rgb >> 0) & 0xFF
    g = (color_rgb >> 8) & 0xFF
    r = (color_rgb >> 16) & 0xFF
    a = 0xFF
    
    pixel = struct.pack('BBBB', b, g, r, a)
    frame_data = pixel * (width * height)
    
    try:
        with open('/dev/fb0', 'wb') as fb:
            fb.write(frame_data)
        
        if duration > 0:
            time.sleep(duration)
        
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

def draw_gradient():
    """绘制渐变色"""
    width, height = get_screen_resolution()
    
    print("[+] Drawing gradient...", end='', flush=True)
    
    frame_data = bytearray(width * height * 4)
    
    for y in range(height):
        for x in range(width):
            # 从红色到蓝色的渐变
            r = int(255 * x / width)
            g = int(255 * y / height)
            b = 255
            a = 255
            
            pixel_idx = (y * width + x) * 4
            frame_data[pixel_idx:pixel_idx+4] = struct.pack('BBBB', b, g, r, a)
    
    try:
        with open('/dev/fb0', 'wb') as fb:
            fb.write(frame_data)
        print(" OK")
        time.sleep(1)
        return True
    except Exception as e:
        print(f" ERROR: {e}")
        return False

def draw_checkerboard(square_size=100, color1=(255,0,0), color2=(0,0,255)):
    """绘制棋盘图案"""
    width, height = get_screen_resolution()
    
    print("[+] Drawing checkerboard...", end='', flush=True)
    
    frame_data = bytearray(width * height * 4)
    
    for y in range(height):
        for x in range(width):
            # 计算棋盘位置
            checker_x = x // square_size
            checker_y = y // square_size
            
            if (checker_x + checker_y) % 2 == 0:
                r, g, b = color1
            else:
                r, g, b = color2
            
            a = 255
            pixel_idx = (y * width + x) * 4
            frame_data[pixel_idx:pixel_idx+4] = struct.pack('BBBB', b, g, r, a)
    
    try:
        with open('/dev/fb0', 'wb') as fb:
            fb.write(frame_data)
        print(" OK")
        time.sleep(1)
        return True
    except Exception as e:
        print(f" ERROR: {e}")
        return False

def draw_stripes(vertical=True, stripe_width=50):
    """绘制条纹图案"""
    width, height = get_screen_resolution()
    
    direction = "vertical" if vertical else "horizontal"
    print(f"[+] Drawing {direction} stripes...", end='', flush=True)
    
    frame_data = bytearray(width * height * 4)
    
    colors = [(255,0,0), (0,255,0), (0,0,255), (255,255,0)]
    
    for y in range(height):
        for x in range(width):
            if vertical:
                stripe_idx = (x // stripe_width) % len(colors)
            else:
                stripe_idx = (y // stripe_width) % len(colors)
            
            r, g, b = colors[stripe_idx]
            a = 255
            
            pixel_idx = (y * width + x) * 4
            frame_data[pixel_idx:pixel_idx+4] = struct.pack('BBBB', b, g, r, a)
    
    try:
        with open('/dev/fb0', 'wb') as fb:
            fb.write(frame_data)
        print(" OK")
        time.sleep(1)
        return True
    except Exception as e:
        print(f" ERROR: {e}")
        return False

def draw_circles():
    """绘制圆形图案"""
    width, height = get_screen_resolution()
    
    print("[+] Drawing circles...", end='', flush=True)
    
    frame_data = bytearray(width * height * 4)
    
    center_x = width // 2
    center_y = height // 2
    max_radius = min(width, height) // 3
    
    for y in range(height):
        for x in range(width):
            # 计算到中心的距离
            dist = ((x - center_x) ** 2 + (y - center_y) ** 2) ** 0.5
            
            # 根据距离选择颜色
            if dist < max_radius * 0.3:
                r, g, b = (255, 0, 0)  # 红色圆心
            elif dist < max_radius * 0.6:
                r, g, b = (0, 255, 0)  # 绿色
            else:
                r, g, b = (0, 0, 255)  # 蓝色
            
            a = 255
            pixel_idx = (y * width + x) * 4
            frame_data[pixel_idx:pixel_idx+4] = struct.pack('BBBB', b, g, r, a)
    
    try:
        with open('/dev/fb0', 'wb') as fb:
            fb.write(frame_data)
        print(" OK")
        time.sleep(1)
        return True
    except Exception as e:
        print(f" ERROR: {e}")
        return False

def run_all_demos():
    """运行所有演示"""
    
    print("\n" + "="*60)
    print("[*] 8K Display Multi Demo")
    print("="*60)
    print(f"[*] Screen Resolution: {get_screen_resolution()}")
    print("="*60 + "\n")
    
    # 演示 1: 彩色填充
    print("[1/5] Pure Colors Demo:")
    colors = [
        (0xFF0000, 'Red'),
        (0x00FF00, 'Green'),
        (0x0000FF, 'Blue'),
        (0xFFFF00, 'Yellow'),
        (0xFF00FF, 'Magenta'),
        (0x00FFFF, 'Cyan'),
    ]
    
    for color_val, color_name in colors:
        print(f"  - {color_name}...", end='', flush=True)
        if fill_screen_color(color_val, 0.5):
            print(" OK")
        else:
            print(" FAILED")
    
    print()
    
    # 演示 2: 渐变
    print("[2/5] Gradient Demo:")
    draw_gradient()
    
    print()
    
    # 演示 3: 棋盘
    print("[3/5] Checkerboard Demo:")
    draw_checkerboard(square_size=80)
    draw_checkerboard(square_size=200, color1=(255,0,0), color2=(255,255,255))
    
    print()
    
    # 演示 4: 条纹
    print("[4/5] Stripes Demo:")
    draw_stripes(vertical=True, stripe_width=100)
    draw_stripes(vertical=False, stripe_width=150)
    
    print()
    
    # 演示 5: 圆形
    print("[5/5] Circles Demo:")
    draw_circles()
    
    print()
    print("="*60)
    print("[+] All demos completed!")
    print("="*60 + "\n")

if __name__ == '__main__':
    run_all_demos()
