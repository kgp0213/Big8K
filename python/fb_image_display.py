#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

FB_PATH = "/dev/fb0"
FONT_PATHS = [
    "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def get_framebuffer_size():
    """从 fb0 获取实际分辨率"""
    try:
        with open("/sys/class/graphics/fb0/virtual_size", "r") as f:
            content = f.read().strip()
            if "," in content:
                w, h = content.split(",")
                return int(w), int(h)
    except Exception:
        pass
    return 3036, 1952


WIDTH, HEIGHT = get_framebuffer_size()


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
    if len(sys.argv) < 2:
        raise SystemExit("usage: fb_image_display.py <image_path>")

    image_path = sys.argv[1]
    img = Image.open(image_path).convert("RGBA")
    img.thumbnail((WIDTH, HEIGHT), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 255))
    x = (WIDTH - img.width) // 2
    y = (HEIGHT - img.height) // 2
    canvas.alpha_composite(img, (x, y))

    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((40, 40, WIDTH - 40, HEIGHT - 40), radius=36, outline=(255, 255, 255, 120), width=4)
    label_font = load_font(60)
    label = f"Image: {Path(image_path).name}"
    draw.rounded_rectangle((80, HEIGHT - 150, 900, HEIGHT - 70), radius=24, fill=(0, 0, 0, 140))
    draw.text((110, HEIGHT - 135), label, font=label_font, fill=(255, 255, 255, 255))

    with open(FB_PATH, "wb") as fb:
        fb.write(to_bgra_bytes(canvas))
    print("IMAGE_OK")


if __name__ == "__main__":
    main()
