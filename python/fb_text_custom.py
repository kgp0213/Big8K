#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

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


def to_bgra_bytes(img: Image.Image) -> bytes:
    arr = np.array(img.convert("RGBA"), dtype=np.uint8)
    bgra = np.empty_like(arr)
    bgra[:, :, 0] = arr[:, :, 2]
    bgra[:, :, 1] = arr[:, :, 1]
    bgra[:, :, 2] = arr[:, :, 0]
    bgra[:, :, 3] = arr[:, :, 3]
    return bgra.tobytes()


def draw_clean(draw: ImageDraw.ImageDraw, text: str, subtitle: str):
    font = load_font(320)
    sub_font = load_font(96)
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (WIDTH - text_w) // 2
    y = (HEIGHT - text_h) // 2 - 50
    for dx, dy in [(-10, 0), (10, 0), (0, -10), (0, 10), (-7, -7), (7, -7), (-7, 7), (7, 7)]:
        draw.text((x + dx, y + dy), text, font=font, fill=(0, 120, 255, 255))
    draw.text((x, y), text, font=font, fill=(255, 255, 0, 255))
    if subtitle:
        sb = draw.textbbox((0, 0), subtitle, font=sub_font)
        sw = sb[2] - sb[0]
        draw.text(((WIDTH - sw) // 2, y + text_h + 100), subtitle, font=sub_font, fill=(180, 220, 255, 255))


def draw_poster(base: Image.Image, text: str, subtitle: str):
    draw = ImageDraw.Draw(base)
    for y in range(HEIGHT):
        t = y / max(HEIGHT - 1, 1)
        r = int(8 + 40 * t)
        g = int(0 + 10 * t)
        b = int(18 + 90 * t)
        draw.line((0, y, WIDTH, y), fill=(r, g, b, 255))

    deco = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    dd = ImageDraw.Draw(deco)
    dd.polygon([(0, 220), (WIDTH, 0), (WIDTH, 280), (0, 500)], fill=(255, 30, 80, 70))
    dd.polygon([(0, HEIGHT - 420), (WIDTH, HEIGHT - 650), (WIDTH, HEIGHT - 300), (0, HEIGHT - 80)], fill=(0, 180, 255, 70))
    base.alpha_composite(deco)

    font = load_font(680 if len(text) <= 4 else 480)
    sub_font = load_font(120)
    temp = ImageDraw.Draw(base)
    bbox = temp.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (WIDTH - text_w) // 2
    y = (HEIGHT - text_h) // 2 - 150

    glow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.text((x, y), text, font=font, fill=(255, 40, 120, 255))
    glow = glow.filter(ImageFilter.GaussianBlur(32))
    base.alpha_composite(glow)

    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.text((x + 24, y + 30), text, font=font, fill=(0, 0, 0, 180))
    for dx, dy in [(-18, 0), (18, 0), (0, -18), (0, 18), (-14, -14), (14, -14), (-14, 14), (14, 14)]:
        ld.text((x + dx, y + dy), text, font=font, fill=(255, 215, 0, 255))
    ld.text((x, y), text, font=font, fill=(255, 255, 255, 255))
    sub = subtitle or "BIG8K CUSTOM POSTER"
    sb = ld.textbbox((0, 0), sub, font=sub_font)
    sw = sb[2] - sb[0]
    ld.text(((WIDTH - sw) // 2, y + text_h + 120), sub, font=sub_font, fill=(255, 180, 60, 255))
    base.alpha_composite(layer)


def main():
    text = sys.argv[1] if len(sys.argv) > 1 else "电子设计部"
    subtitle = sys.argv[2] if len(sys.argv) > 2 else ""
    style = sys.argv[3] if len(sys.argv) > 3 else "clean"

    if style == "poster":
        img = Image.new("RGBA", (WIDTH, HEIGHT), (8, 0, 18, 255))
        draw_poster(img, text, subtitle)
    else:
        img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 255))
        draw = ImageDraw.Draw(img)
        draw_clean(draw, text, subtitle)

    with open(FB_PATH, "wb") as fb:
        fb.write(to_bgra_bytes(img))
    print("TEXT_CUSTOM_OK")


if __name__ == "__main__":
    main()
