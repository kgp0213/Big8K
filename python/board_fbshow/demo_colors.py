#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
8K Display Color Demo - 彩色演示脚本
在 Framebuffer 上显示各种彩色画面
"""

import struct
import time
import subprocess

def get_screen_resolution():
    """获取屏幕分辨率"""
    try:
        cmd = "cat /sys/class/graphics/fb0/virtual_size"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, check=True)
        resolution = result.stdout.strip()
        width, height = map(int, resolution.split(','))
        return width, height
    except:
        # 默认 8K 分辨率
        return 7680, 4320

def fill_screen_color(color_rgb):
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
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

def demo_colors():
    """演示各种颜色"""
    
    colors = [
        (0xFF0000, 'Red (红色)'),
        (0x00FF00, 'Green (绿色)'),
        (0x0000FF, 'Blue (蓝色)'),
        (0xFFFF00, 'Yellow (黄色)'),
        (0xFF00FF, 'Magenta (品红)'),
        (0x00FFFF, 'Cyan (青色)'),
        (0xFFFFFF, 'White (白色)'),
        (0x000000, 'Black (黑色)'),
    ]
    
    print("[*] 8K Display Color Demo")
    print("[*] Screen Resolution:", get_screen_resolution())
    print()
    
    for color_val, color_name in colors:
        print(f"[+] Displaying {color_name}...", end='', flush=True)
        if fill_screen_color(color_val):
            print(" OK")
            time.sleep(1)
        else:
            print(" FAILED")
    
    print("[+] Demo Complete!")

if __name__ == '__main__':
    demo_colors()
