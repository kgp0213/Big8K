#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

WIDTH = 3036
HEIGHT = 1952
FB_PATH = "/dev/fb0"
TEXT = "卧槽"
SUB_TEXT = "BIG8K POSTER MODE"
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
    base = Image.new("RGBA", (WIDTH, HEIGHT), (8, 0, 18, 255))
    draw = ImageDraw.Draw(base)

    # 背景渐变与暗角
    for y in range(HEIGHT):
        t = y / max(HEIGHT - 1, 1)
        r = int(8 + 40 * t)
        g = int(0 + 10 * t)
        b = int(18 + 90 * t)
        draw.line((0, y, WIDTH, y), fill=(r, g, b, 255))

    vignette = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vignette)
    for i in range(18):
        alpha = int(10 + i * 8)
        vd.rounded_rectangle((i * 35, i * 25, WIDTH - i * 35, HEIGHT - i * 25), radius=120, outline=(0, 0, 0, alpha), width=26)
    base = Image.alpha_composite(base, vignette)

    # 斜向装饰条
    deco = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    dd = ImageDraw.Draw(deco)
    dd.polygon([(0, 220), (WIDTH, 0), (WIDTH, 280), (0, 500)], fill=(255, 30, 80, 70))
    dd.polygon([(0, HEIGHT - 420), (WIDTH, HEIGHT - 650), (WIDTH, HEIGHT - 300), (0, HEIGHT - 80)], fill=(0, 180, 255, 70))
    base = Image.alpha_composite(base, deco)

    font = load_font(700)
    sub_font = load_font(135)
    small_font = load_font(72)

    temp = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    td = ImageDraw.Draw(temp)
    bbox = td.textbbox((0, 0), TEXT, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (WIDTH - text_w) // 2
    y = (HEIGHT - text_h) // 2 - 180

    # 发光层
    glow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.text((x, y), TEXT, font=font, fill=(255, 40, 120, 255))
    glow = glow.filter(ImageFilter.GaussianBlur(36))
    base = Image.alpha_composite(base, glow)

    glow2 = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    gd2 = ImageDraw.Draw(glow2)
    gd2.text((x + 8, y + 8), TEXT, font=font, fill=(0, 200, 255, 220))
    glow2 = glow2.filter(ImageFilter.GaussianBlur(18))
    base = Image.alpha_composite(base, glow2)

    # 阴影
    poster = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    pd = ImageDraw.Draw(poster)
    pd.text((x + 24, y + 30), TEXT, font=font, fill=(0, 0, 0, 180))

    # 主字描边 + 主字
    for dx, dy in [(-18, 0), (18, 0), (0, -18), (0, 18), (-14, -14), (14, -14), (-14, 14), (14, 14)]:
        pd.text((x + dx, y + dy), TEXT, font=font, fill=(255, 215, 0, 255))
    pd.text((x, y), TEXT, font=font, fill=(255, 255, 255, 255))

    # 副标题与底部标签
    sub_bbox = pd.textbbox((0, 0), SUB_TEXT, font=sub_font)
    sub_w = sub_bbox[2] - sub_bbox[0]
    pd.text(((WIDTH - sub_w) // 2, y + text_h + 140), SUB_TEXT, font=sub_font, fill=(255, 180, 60, 255))

    pd.rounded_rectangle((160, HEIGHT - 240, WIDTH - 160, HEIGHT - 120), radius=44, fill=(0, 0, 0, 130), outline=(255, 255, 255, 110), width=4)
    note = "ADB + FRAMEBUFFER + BIG8K SCREEN TEST"
    note_bbox = pd.textbbox((0, 0), note, font=small_font)
    note_w = note_bbox[2] - note_bbox[0]
    pd.text(((WIDTH - note_w) // 2, HEIGHT - 210), note, font=small_font, fill=(220, 240, 255, 255))

    base = Image.alpha_composite(base, poster)

    with open(FB_PATH, "wb") as fb:
        fb.write(to_bgra_bytes(base))

    print("POSTER_OK")


if __name__ == "__main__":
    main()
