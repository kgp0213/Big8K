#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from pathlib import Path
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

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
    width = int(sys.argv[1]) if len(sys.argv) > 1 else 3036
    height = int(sys.argv[2]) if len(sys.argv) > 2 else 1952
    img = Image.new("RGBA", (width, height), (0, 0, 0, 255))
    draw = ImageDraw.Draw(img)

    scale = min(width / 3036.0, height / 1952.0)
    font = load_font(max(32, int(460 * scale)))
    bbox = draw.textbbox((0, 0), TEXT, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (width - text_w) // 2
    y = (height - text_h) // 2 - max(10, int(80 * scale))

    glow = max(2, int(14 * scale))
    shadow = max(2, int(10 * scale))
    for dx, dy in [(-glow, 0), (glow, 0), (0, -glow), (0, glow), (-shadow, -shadow), (shadow, -shadow), (-shadow, shadow), (shadow, shadow)]:
        draw.text((x + dx, y + dy), TEXT, font=font, fill=(255, 80, 80, 255))

    draw.text((x, y), TEXT, font=font, fill=(255, 255, 255, 255))

    sub_font = load_font(max(18, int(120 * scale)))
    sub_text = "8K Framebuffer Test"
    sub_bbox = draw.textbbox((0, 0), sub_text, font=sub_font)
    sub_w = sub_bbox[2] - sub_bbox[0]
    draw.text(((width - sub_w) // 2, y + text_h + max(20, int(140 * scale))), sub_text, font=sub_font, fill=(255, 200, 120, 255))

    with open(FB_PATH, "wb") as fb:
        fb.write(to_bgra_bytes(img))

    print("TEXT_OK")


if __name__ == "__main__":
    main()
