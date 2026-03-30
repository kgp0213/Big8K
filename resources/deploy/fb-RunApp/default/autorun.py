#!/usr/bin/env python3
import os
import subprocess
import cv2
import numpy as np
import mmap
import datetime
# 获取屏幕分辨率
cmd = "cat /sys/class/graphics/fb0/virtual_size"
result = subprocess.run(cmd, shell=True, check=True, stdout=subprocess.PIPE, universal_newlines=True)
resolution = result.stdout.strip()
width, height = map(int, resolution.split(','))

fb_image = np.zeros((height, width, 4), dtype=np.uint8)
# 设置字体和大小
font = cv2.FONT_HERSHEY_SIMPLEX
font_scale = 5
font_thickness = 5
text_size = cv2.getTextSize('Visionox', font, font_scale, font_thickness)[0]

# 计算文本位置
text_x = (width - text_size[0]) // 2
text_y = (height + text_size[1]) // 2

def update_image():
    # 创建一个黑色背景的图像
    # image = np.zeros((height, width, 3), dtype=np.uint8)
    image = np.full((height, width, 3),(128,128, 128), dtype=np.uint8)
    # 在图像上绘制字符
    cv2.putText(image, 'Visionox', (text_x, text_y), font, font_scale, (255, 255, 255), font_thickness)
    
    # 绘制白色边框
    cv2.rectangle(image, (0, 0), (width-1, height-1), (255, 255, 255), 1)

    # # 获取当前时间
    # current_time = datetime.datetime.now().strftime('%S:%f')[:-3]
    # # 在图像左上角绘制时间（大小和random_chars一致）
    # cv2.putText(image, current_time, (10, text_size[1]), font, font_scale, (255, 255, 255), font_thickness)
    
    return image

try:

    # # 通过subprocess.run()函数调用Linux命令并获取输出结果    
    # os.system("/vismm/fbshow/fbShowPattern \"128128128\"")

    image = update_image()
    # 将24bpp的图像数据转换为32bpp
    fb_image[:, :, :3] = image
    fb_image[:, :, 3] = 0  # 添加一个alpha通道，值为0

    # 将图像数据写入帧缓冲设备
    fb_path = '/dev/fb0'
    fb_size = height * width * 4
    with open(fb_path, 'r+b') as fb:
        mm = mmap.mmap(fb.fileno(), fb_size, mmap.MAP_SHARED, mmap.PROT_WRITE)
        mm.write(fb_image.tobytes())
        mm.close()
except Exception as e:
    print("err：", str(e))
