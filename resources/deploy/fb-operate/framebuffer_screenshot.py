import cv2
import numpy as np
import mmap
import subprocess
import time
import datetime
import os

# 获取屏幕分辨率
cmd = "cat /sys/class/graphics/fb0/virtual_size"
result = subprocess.run(cmd, shell=True, check=True, stdout=subprocess.PIPE, universal_newlines=True)
resolution = result.stdout.strip()
width, height = map(int, resolution.split(','))
print(width, height)

def extract_fb_image():
    # 读取帧缓冲设备的内容
    fb_path = '/dev/fb0'
    fb_size = height * width * 4
    with open(fb_path, 'rb') as fb:
        with mmap.mmap(fb.fileno(), fb_size, mmap.MAP_SHARED, mmap.PROT_READ) as mm:
            mm.seek(0)
            fb_image = np.frombuffer(mm.read(fb_size), dtype=np.uint8).reshape((height, width, 4))

    return fb_image

def save_images(fb_image):
    # 获取当前时间，精确到分钟和秒
    timestamp = datetime.datetime.now().strftime('%M%S')

    # 创建保存目录
    save_dir = '/vismm/fbshow/save'
    os.makedirs(save_dir, exist_ok=True)

    # 分离出24-bit (不带透明度) 和 32-bit (带透明度) 的图像
    image_24bit = fb_image[:, :, :3]  # 取前三个通道
    image_32bit = fb_image  # 包含四个通道

    # 保存24-bit BMP图像
    bmp_filename = os.path.join(save_dir, f'fb_image_24bit_{timestamp}.bmp')
    cv2.imwrite(bmp_filename, image_24bit)

    # 保存32-bit 带透明度的图片
    png_filename = os.path.join(save_dir, f'fb_image_32bit_{timestamp}.png')
    cv2.imwrite(png_filename, image_32bit)

    print(f"Saved images: {bmp_filename} and {png_filename}")

def main():
    fb_image = extract_fb_image()
    save_images(fb_image)

if __name__ == "__main__":
    main()
