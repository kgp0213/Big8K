#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import mmap
import subprocess
import numpy as np

FB_PATH = '/dev/fb0'


def get_resolution():
    result = subprocess.run(
        "cat /sys/class/graphics/fb0/virtual_size",
        shell=True,
        capture_output=True,
        text=True,
        check=True,
    )
    raw = result.stdout.strip().replace('x', ',').replace('×', ',')
    width, height = [int(x) for x in raw.split(',')[:2]]
    return width, height


def open_fb(width: int, height: int):
    fb = open(FB_PATH, 'r+b')
    mm = mmap.mmap(fb.fileno(), width * height * 4, mmap.MAP_SHARED, mmap.PROT_WRITE)
    arr = np.frombuffer(mm, dtype=np.uint8).reshape((height, width, 4))
    return fb, mm, arr


def fill_color(arr, rgba):
    arr[:, :] = np.array(rgba, dtype=np.uint8)


def vertical_gradient(width, height, mode='gray', reverse=False):
    grad = np.linspace(0, 255, height, dtype=np.uint8)
    if reverse:
        grad = grad[::-1]
    col = grad[:, None]
    arr = np.zeros((height, width, 4), dtype=np.uint8)
    if mode == 'gray':
        arr[..., 0] = col
        arr[..., 1] = col
        arr[..., 2] = col
    elif mode == 'red':
        arr[..., 2] = col
    elif mode == 'green':
        arr[..., 1] = col
    elif mode == 'blue':
        arr[..., 0] = col
    arr[..., 3] = 255
    return arr


def horizontal_gradient(width, height, reverse=False):
    grad = np.linspace(0, 255, width, dtype=np.uint8)
    if reverse:
        grad = grad[::-1]
    row = np.tile(grad[None, :], (height, 1))
    arr = np.zeros((height, width, 4), dtype=np.uint8)
    arr[..., 0] = row
    arr[..., 1] = row
    arr[..., 2] = row
    arr[..., 3] = 255
    return arr


def color_bar(width, height):
    colors = np.array([
        [255, 255, 255, 255],
        [0, 255, 255, 255],
        [255, 255, 0, 255],
        [0, 255, 0, 255],
        [255, 0, 255, 255],
        [0, 0, 255, 255],
        [255, 0, 0, 255],
        [0, 0, 0, 255],
    ], dtype=np.uint8)
    x = np.arange(width)
    idx = np.minimum(x * len(colors) // max(width, 1), len(colors) - 1)
    row = colors[idx]
    return np.repeat(row[None, :, :], height, axis=0)


def checkerboard(width, height, block=80):
    y = np.arange(height)[:, None]
    x = np.arange(width)[None, :]
    mask = ((x // block) + (y // block)) % 2 == 0
    arr = np.zeros((height, width, 4), dtype=np.uint8)
    arr[mask] = np.array([255, 255, 255, 255], dtype=np.uint8)
    arr[~mask] = np.array([0, 0, 0, 255], dtype=np.uint8)
    return arr


def radial_gray(width, height):
    y, x = np.ogrid[:height, :width]
    min_dist = np.minimum.reduce([x, width - 1 - x, y, height - 1 - y]).astype(np.float32)
    max_distance = max(min(width, height) / 2.0, 1.0)
    gray = np.clip((min_dist / max_distance) * 255, 0, 255).astype(np.uint8)
    arr = np.zeros((height, width, 4), dtype=np.uint8)
    arr[..., 0] = gray
    arr[..., 1] = gray
    arr[..., 2] = gray
    arr[..., 3] = 255
    return arr


def logic_like_colorbar_gradient(width, height, horizontal=True, reverse=False):
    arr = np.zeros((height, width, 4), dtype=np.uint8)
    bars = 6
    if horizontal:
        bar_width = max(width // bars, 1)
        for i in range(bars):
            start = i * bar_width
            end = width if i == bars - 1 else min((i + 1) * bar_width, width)
            grad = np.linspace(0, 255, max(end - start, 1), dtype=np.uint8)
            if reverse:
                grad = grad[::-1]
            arr[:, start:end, i % 3] = grad[None, :]
    else:
        bar_height = max(height // bars, 1)
        for i in range(bars):
            start = i * bar_height
            end = height if i == bars - 1 else min((i + 1) * bar_height, height)
            grad = np.linspace(0, 255, max(end - start, 1), dtype=np.uint8)
            if reverse:
                grad = grad[::-1]
            arr[start:end, :, i % 3] = grad[:, None]
    arr[..., 3] = 255
    return arr


def main():
    if len(sys.argv) < 2:
        print('Usage: python3 render_patterns.py <pattern>')
        sys.exit(1)

    pattern = sys.argv[1]
    width, height = get_resolution()
    fb, mm, arr = open_fb(width, height)
    try:
        if pattern == 'pure_red':
            fill_color(arr, (0, 0, 255, 255))
        elif pattern == 'pure_green':
            fill_color(arr, (0, 255, 0, 255))
        elif pattern == 'pure_blue':
            fill_color(arr, (255, 0, 0, 255))
        elif pattern == 'pure_black':
            fill_color(arr, (0, 0, 0, 255))
        elif pattern == 'pure_white':
            fill_color(arr, (255, 255, 255, 255))
        elif pattern == 'gray_gradient':
            arr[:] = vertical_gradient(width, height, 'gray')
        elif pattern == 'red_gradient':
            arr[:] = vertical_gradient(width, height, 'red')
        elif pattern == 'green_gradient':
            arr[:] = vertical_gradient(width, height, 'green')
        elif pattern == 'blue_gradient':
            arr[:] = vertical_gradient(width, height, 'blue')
        elif pattern == 'h_gradient_1':
            arr[:] = horizontal_gradient(width, height, False)
        elif pattern == 'h_gradient_2':
            arr[:] = horizontal_gradient(width, height, True)
        elif pattern == 'v_gradient_1':
            arr[:] = vertical_gradient(width, height, 'gray', False)
        elif pattern == 'v_gradient_2':
            arr[:] = vertical_gradient(width, height, 'gray', True)
        elif pattern == 'h_colorbar_gradient_1':
            arr[:] = logic_like_colorbar_gradient(width, height, True, False)
        elif pattern == 'h_colorbar_gradient_2':
            arr[:] = logic_like_colorbar_gradient(width, height, True, True)
        elif pattern == 'v_colorbar_gradient_1':
            arr[:] = logic_like_colorbar_gradient(width, height, False, False)
        elif pattern == 'v_colorbar_gradient_2':
            arr[:] = logic_like_colorbar_gradient(width, height, False, True)
        elif pattern == 'radial_gray':
            arr[:] = radial_gray(width, height)
        elif pattern == 'color_bar':
            arr[:] = color_bar(width, height)
        elif pattern == 'checkerboard':
            arr[:] = checkerboard(width, height)
        else:
            print(f'Unknown pattern: {pattern}')
            sys.exit(2)
        mm.flush()
        print(f'OK:{pattern}')
    finally:
        arr = None
        mm.close()
        fb.close()


if __name__ == '__main__':
    main()
