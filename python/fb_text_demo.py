#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

WIDTH = 3036
HEIGHT = 1952
FB_PATH = "/dev/fb0"
TEXT = "卧槽"
FONT_PATHS = [
    "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def load_font(size: int):
    for path in FONT_PATHS:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def to_bgra_bytes(img: Image.Image) -> bytes:
    arr = np.array(img.convert("RGBA"), dtype=np.uint8)
    bgra = np.empty_like(arr)
    bgra[:, :, 0] = arr[:, :, 2]
    bgra[:, :, 1] = arr[:, :, 1]
    bgra[:, :, 2] = arr[:, :, 0]
    bgra[:, :, 3] = arr[:, :, 3]
    return bgra.tobytes()


def main():
    img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 255))
    draw = ImageDraw.Draw(img)

    font = load_font(460)
    bbox = draw.textbbox((0, 0), TEXT, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (WIDTH - text_w) // 2
    y = (HEIGHT - text_h) // 2 - 80

    for dx, dy in [(-14, 0), (14, 0), (0, -14), (0, 14), (-10, -10), (10, -10), (-10, 10), (10, 10)]:
        draw.text((x + dx, y + dy), TEXT, font=font, fill=(255, 80, 80, 255))

    draw.text((x, y), TEXT, font=font, fill=(255, 255, 255, 255))

    sub_font = load_font(120)
    sub_text = "8K Framebuffer Test"
    sub_bbox = draw.textbbox((0, 0), sub_text, font=sub_font)
    sub_w = sub_bbox[2] - sub_bbox[0]
    draw.text(((WIDTH - sub_w) // 2, y + text_h + 140), sub_text, font=sub_font, fill=(255, 200, 120, 255))

    with open(FB_PATH, "wb") as fb:
        fb.write(to_bgra_bytes(img))

    print("TEXT_OK")


if __name__ == "__main__":
    main()
