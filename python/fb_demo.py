#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from datetime import datetime
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

WIDTH = 3036
HEIGHT = 1952
FB_PATH = "/dev/fb0"
FONT_PATHS = [
    "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def load_font(size: int):
    for path in FONT_PATHS:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def rgba_to_bgra(img: Image.Image) -> bytes:
    arr = np.array(img.convert("RGBA"), dtype=np.uint8)
    bgra = np.empty_like(arr)
    bgra[:, :, 0] = arr[:, :, 2]
    bgra[:, :, 1] = arr[:, :, 1]
    bgra[:, :, 2] = arr[:, :, 0]
    bgra[:, :, 3] = arr[:, :, 3]
    return bgra.tobytes()


def make_demo_image() -> Image.Image:
    img = Image.new("RGBA", (WIDTH, HEIGHT), (8, 12, 20, 255))
    draw = ImageDraw.Draw(img)

    # 背景渐变
    for y in range(HEIGHT):
        t = y / max(HEIGHT - 1, 1)
        r = int(8 + 20 * t)
        g = int(12 + 60 * t)
        b = int(20 + 120 * t)
        draw.line((0, y, WIDTH, y), fill=(r, g, b, 255))

    # 顶部标题区
    draw.rounded_rectangle((90, 70, WIDTH - 90, 420), radius=48, fill=(15, 23, 42, 220), outline=(80, 180, 255, 255), width=6)
    draw.text((160, 120), "BIG8K FRAMEBUFFER DEMO", fill=(255, 255, 255, 255), font=load_font(110))
    draw.text((165, 260), "ADB -> /dev/fb0 直接写屏", fill=(120, 220, 255, 255), font=load_font(68))

    # 中部彩条块
    colors = [
        (255, 255, 255, 255),
        (255, 255, 0, 255),
        (0, 255, 255, 255),
        (0, 255, 0, 255),
        (255, 0, 255, 255),
        (255, 0, 0, 255),
        (0, 0, 255, 255),
        (0, 0, 0, 255),
    ]
    bar_top = 560
    bar_height = 240
    bar_width = (WIDTH - 240) // len(colors)
    for i, color in enumerate(colors):
        x0 = 120 + i * bar_width
        x1 = 120 + (i + 1) * bar_width - 10
        draw.rounded_rectangle((x0, bar_top, x1, bar_top + bar_height), radius=24, fill=color)

    # 左下灰阶渐变
    gray_x0, gray_y0 = 140, 980
    gray_w, gray_h = 1280, 260
    for x in range(gray_w):
        v = int(255 * x / max(gray_w - 1, 1))
        draw.line((gray_x0 + x, gray_y0, gray_x0 + x, gray_y0 + gray_h), fill=(v, v, v, 255))
    draw.rounded_rectangle((gray_x0, gray_y0, gray_x0 + gray_w, gray_y0 + gray_h), radius=24, outline=(255, 255, 255, 255), width=4)
    draw.text((gray_x0, gray_y0 - 90), "灰阶渐变", fill=(255, 255, 255, 255), font=load_font(72))

    # 右下棋盘格
    board_x0, board_y0 = 1700, 930
    board_size = 900
    block = 90
    for y in range(0, board_size, block):
        for x in range(0, board_size, block):
            is_white = ((x // block) + (y // block)) % 2 == 0
            color = (255, 255, 255, 255) if is_white else (30, 30, 30, 255)
            draw.rectangle((board_x0 + x, board_y0 + y, board_x0 + x + block - 1, board_y0 + y + block - 1), fill=color)
    draw.rounded_rectangle((board_x0, board_y0, board_x0 + board_size, board_y0 + board_size), radius=28, outline=(255, 255, 255, 255), width=4)
    draw.text((board_x0, board_y0 - 90), "棋盘格", fill=(255, 255, 255, 255), font=load_font(72))

    # 底部信息
    now_text = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    draw.rounded_rectangle((100, HEIGHT - 250, WIDTH - 100, HEIGHT - 100), radius=40, fill=(0, 0, 0, 120), outline=(100, 180, 255, 255), width=4)
    draw.text((150, HEIGHT - 220), "分辨率: 3036×1952   格式: BGRA8888   输出: /dev/fb0", fill=(255, 255, 255, 255), font=load_font(56))
    draw.text((150, HEIGHT - 145), f"生成时间: {now_text}", fill=(120, 220, 255, 255), font=load_font(50))

    return img


def main():
    img = make_demo_image()
    with open(FB_PATH, "wb") as fb:
        fb.write(rgba_to_bgra(img))
    print("DEMO_OK")


if __name__ == "__main__":
    main()
