#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成炫彩图案 (34-37) 为 2160x3240 24位BMP格式
"""
import numpy as np
import cv2

# 设置分辨率
SCREEN_WIDTH = 2160
SCREEN_HEIGHT = 3240

def colorful_pattern1():
    """34-炫彩1（彩虹渐变）"""
    grad = np.linspace(0, 255, SCREEN_WIDTH, dtype=np.uint8)
    return np.dstack((
        grad,  # 红色通道渐变
        np.roll(grad, SCREEN_WIDTH//3),  # 绿色通道偏移
        np.roll(grad, 2*SCREEN_WIDTH//3)  # 蓝色通道偏移
    )).repeat(SCREEN_HEIGHT, 0)

def colorful_pattern2():
    """35-炫彩2（对角渐变）"""
    x = np.linspace(0, 255, SCREEN_WIDTH)
    y = np.linspace(0, 255, SCREEN_HEIGHT)
    xx, yy = np.meshgrid(x, y)
    return np.dstack((
        (xx + yy) % 256,  # 红色通道
        (xx * 2) % 256,    # 绿色通道 
        (yy * 2) % 256     # 蓝色通道
    )).astype(np.uint8)

def colorful_pattern3():
    """36-炫彩3（同心圆）"""
    y, x = np.ogrid[:SCREEN_HEIGHT, :SCREEN_WIDTH]
    center_x = SCREEN_WIDTH // 2
    center_y = SCREEN_HEIGHT // 2
    radius = np.sqrt((x - center_x)**2 + (y - center_y)**2)
    return np.dstack((
        (np.sin(radius/30) * 127 + 128).astype(np.uint8),  # 红色通道
        (np.cos(radius/20) * 127 + 128).astype(np.uint8),  # 绿色通道
        (radius % 256).astype(np.uint8)                    # 蓝色通道
    ))

def colorful_pattern4():
    """37-炫彩4（随机噪点）"""
    return np.random.randint(0, 256, 
                            (SCREEN_HEIGHT, SCREEN_WIDTH, 3),
                            dtype=np.uint8)

def save_bmp(image, filename):
    """保存为24位BMP格式"""
    # 确保是RGB格式（BGR转RGB）
    # OpenCV是BGR格式，需要转换
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    cv2.imwrite(filename, image_rgb)
    print(f"已保存: {filename}")

if __name__ == "__main__":
    print(f"生成分辨率: {SCREEN_WIDTH} x {SCREEN_HEIGHT}")
    print("生成炫彩图案 34-37...")
    
    # 生成图案34
    print("生成 炫彩1 (pattern 34)...")
    img1 = colorful_pattern1()
    save_bmp(img1, "colorful_pattern_34.bmp")
    
    # 生成图案35
    print("生成 炫彩2 (pattern 35)...")
    img2 = colorful_pattern2()
    save_bmp(img2, "colorful_pattern_35.bmp")
    
    # 生成图案36
    print("生成 炫彩3 (pattern 36)...")
    img3 = colorful_pattern3()
    save_bmp(img3, "colorful_pattern_36.bmp")
    
    # 生成图案37
    print("生成 炫彩4 (pattern 37)...")
    img4 = colorful_pattern4()
    save_bmp(img4, "colorful_pattern_37.bmp")
    
    print("\n所有图案生成完成!")
    print("生成的文件:")
    print("  - colorful_pattern_34.bmp (炫彩1: 彩虹渐变)")
    print("  - colorful_pattern_35.bmp (炫彩2: 对角渐变)")
    print("  - colorful_pattern_36.bmp (炫彩3: 同心圆)")
    print("  - colorful_pattern_37.bmp (炫彩4: 随机噪点)")
