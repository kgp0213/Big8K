#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from datetime import datetime
from pathlib import Path
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont

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


def get_resolution():
    result = subprocess.run(
        "cat /sys/class/graphics/fb0/virtual_size",
        shell=True,
        capture_output=True,
        text=True,
        check=True,
    )
    raw = result.stdout.strip().replace("x", ",").replace("×", ",")
    width, height = [int(x) for x in raw.split(",")[:2]]
    return width, height


def rgba_to_bgra(img: Image.Image) -> bytes:
    arr = np.array(img.convert("RGBA"), dtype=np.uint8)
    bgra = np.empty_like(arr)
    bgra[:, :, 0] = arr[:, :, 2]
    bgra[:, :, 1] = arr[:, :, 1]
    bgra[:, :, 2] = arr[:, :, 0]
    bgra[:, :, 3] = arr[:, :, 3]
    return bgra.tobytes()


def make_demo_image(width: int, height: int) -> Image.Image:
    img = Image.new("RGBA", (width, height), (8, 12, 20, 255))
    draw = ImageDraw.Draw(img)

    sx = width / 3036.0
    sy = height / 1952.0
    s = min(sx, sy)

    def px(v: float) -> int:
        return max(1, int(round(v * sx)))

    def py(v: float) -> int:
        return max(1, int(round(v * sy)))

    def ps(v: float) -> int:
        return max(1, int(round(v * s)))

    # 背景渐变
    for y in range(height):
        t = y / max(height - 1, 1)
        r = int(8 + 20 * t)
        g = int(12 + 60 * t)
        b = int(20 + 120 * t)
        draw.line((0, y, width, y), fill=(r, g, b, 255))

    # 顶部标题区
    draw.rounded_rectangle((px(90), py(70), width - px(90), py(420)), radius=ps(48), fill=(15, 23, 42, 220), outline=(80, 180, 255, 255), width=max(2, ps(6)))
    draw.text((px(160), py(120)), "BIG8K FRAMEBUFFER DEMO", fill=(255, 255, 255, 255), font=load_font(ps(110)))
    draw.text((px(165), py(260)), "ADB -> /dev/fb0 直接写屏", fill=(120, 220, 255, 255), font=load_font(ps(68)))

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
    bar_top = py(560)
    bar_height = py(240)
    bar_width = max((width - px(240)) // len(colors), 1)
    for i, color in enumerate(colors):
        x0 = px(120) + i * bar_width
        x1 = px(120) + (i + 1) * bar_width - max(2, px(10))
        draw.rounded_rectangle((x0, bar_top, x1, bar_top + bar_height), radius=ps(24), fill=color)

    # 左下灰阶渐变
    gray_x0, gray_y0 = px(140), py(980)
    gray_w, gray_h = px(1280), py(260)
    for x in range(gray_w):
        v = int(255 * x / max(gray_w - 1, 1))
        draw.line((gray_x0 + x, gray_y0, gray_x0 + x, gray_y0 + gray_h), fill=(v, v, v, 255))
    draw.rounded_rectangle((gray_x0, gray_y0, gray_x0 + gray_w, gray_y0 + gray_h), radius=ps(24), outline=(255, 255, 255, 255), width=max(2, ps(4)))
    draw.text((gray_x0, gray_y0 - py(90)), "灰阶渐变", fill=(255, 255, 255, 255), font=load_font(ps(72)))

    # 右下棋盘格
    board_x0, board_y0 = px(1700), py(930)
    board_size = min(px(900), max(width - board_x0 - px(100), 1), max(height - board_y0 - py(200), 1))
    block = max(ps(90), 8)
    for y in range(0, board_size, block):
        for x in range(0, board_size, block):
            is_white = ((x // block) + (y // block)) % 2 == 0
            color = (255, 255, 255, 255) if is_white else (30, 30, 30, 255)
            draw.rectangle((board_x0 + x, board_y0 + y, board_x0 + x + block - 1, board_y0 + y + block - 1), fill=color)
    draw.rounded_rectangle((board_x0, board_y0, board_x0 + board_size, board_y0 + board_size), radius=ps(28), outline=(255, 255, 255, 255), width=max(2, ps(4)))
    draw.text((board_x0, board_y0 - py(90)), "棋盘格", fill=(255, 255, 255, 255), font=load_font(ps(72)))

    # 底部信息
    now_text = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    draw.rounded_rectangle((px(100), height - py(250), width - px(100), height - py(100)), radius=ps(40), fill=(0, 0, 0, 120), outline=(100, 180, 255, 255), width=max(2, ps(4)))
    draw.text((px(150), height - py(220)), f"分辨率: {width}×{height}   格式: BGRA8888   输出: /dev/fb0", fill=(255, 255, 255, 255), font=load_font(ps(56)))
    draw.text((px(150), height - py(145)), f"生成时间: {now_text}", fill=(120, 220, 255, 255), font=load_font(ps(50)))

    return img


def main():
    width, height = get_resolution()
    img = make_demo_image(width, height)
    with open(FB_PATH, "wb") as fb:
        fb.write(rgba_to_bgra(img))
    print("DEMO_OK")


if __name__ == "__main__":
    main()
