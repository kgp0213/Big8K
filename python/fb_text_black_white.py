#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from pathlib import Path
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

FB_PATH = "/dev/fb0"
FONT_PATHS = [
    "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def load_font(size: int):
    for path in FONT_PATHS:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()


def to_bgra_bytes(img: Image.Image) -> bytes:
    arr = np.array(img.convert("RGBA"), dtype=np.uint8)
    bgra = np.empty_like(arr)
    bgra[:, :, 0] = arr[:, :, 2]
    bgra[:, :, 1] = arr[:, :, 1]
    bgra[:, :, 2] = arr[:, :, 0]
    bgra[:, :, 3] = arr[:, :, 3]
    return bgra.tobytes()


def get_resolution():
    with open('/sys/class/graphics/fb0/virtual_size', 'r', encoding='utf-8') as f:
        raw = f.read().strip().replace('x', ',').replace('×', ',')
    w, h = [int(x) for x in raw.split(',')[:2]]
    return w, h


def main():
    text = sys.argv[1] if len(sys.argv) > 1 else "测试中"
    width, height = get_resolution()

    img = Image.new("RGBA", (width, height), (0, 0, 0, 255))
    draw = ImageDraw.Draw(img)

    # 大号字体：约占屏幕高度 42%
    font_size = max(80, int(height * 0.42))
    font = load_font(font_size)

    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    x = (width - text_w) // 2
    y = (height - text_h) // 2

    # 纯白主字（黑底白字）
    draw.text((x, y), text, font=font, fill=(255, 255, 255, 255))

    with open(FB_PATH, "wb") as fb:
        fb.write(to_bgra_bytes(img))

    print(f"TEXT_OK {width}x{height} '{text}'")


if __name__ == "__main__":
    main()
