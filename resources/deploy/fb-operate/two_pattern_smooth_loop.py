#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Two-pattern smooth loop for Big8K panel.

Only displays:
1) checkerboard
2) smooth color gradient bar

Switching method is redesigned to reduce visible flicker:
- Keep one process alive (no repeated process startup)
- Keep framebuffer fd + mmap open (no repeated open/close)
- Optional VSYNC wait before frame write
- Cross-fade transition in multiple small steps instead of hard cut

Control:
- Create /dev/shm/two_pattern_loop_stop to stop
- Log: /dev/shm/two_pattern_loop.log
"""

import argparse
import fcntl
import mmap
import os
import struct
import time
from typing import Tuple

import numpy as np

FB_PATH = "/dev/fb0"
STOP_FILE = "/dev/shm/two_pattern_loop_stop"
LOG_FILE = "/dev/shm/two_pattern_loop.log"
# Linux framebuffer VSYNC ioctl (common on many kernels)
FBIO_WAITFORVSYNC = 0x4680


def log(msg: str) -> None:
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{ts}] {msg}\n")
    except Exception:
        pass


def read_int(path: str, default: int) -> int:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return int(f.read().strip())
    except Exception:
        return default


def get_resolution() -> Tuple[int, int]:
    try:
        with open("/sys/class/graphics/fb0/virtual_size", "r", encoding="utf-8") as f:
            raw = f.read().strip()
        w, h = raw.split(",")
        return int(w), int(h)
    except Exception:
        return 800, 600


class FBWriter:
    def __init__(self) -> None:
        self.width, self.height = get_resolution()
        self.bpp = read_int("/sys/class/graphics/fb0/bits_per_pixel", 32)
        if self.bpp not in (24, 32):
            self.bpp = 32
        self.bytespp = 4 if self.bpp == 32 else 3
        self.fb_size = self.width * self.height * self.bytespp

        self.fd = os.open(FB_PATH, os.O_RDWR)
        self.mm = mmap.mmap(self.fd, self.fb_size, mmap.MAP_SHARED, mmap.PROT_WRITE)
        self.vsync_supported = True

        log(f"fb open: {self.width}x{self.height}, bpp={self.bpp}")

    def wait_vsync(self) -> None:
        if not self.vsync_supported:
            return
        try:
            arg = struct.pack("I", 0)
            fcntl.ioctl(self.fd, FBIO_WAITFORVSYNC, arg)
        except Exception:
            # Kernel may not support it; disable silently after first failure.
            self.vsync_supported = False
            log("vsync ioctl unsupported; fallback to timed write")

    def write_rgb(self, frame_rgb: np.ndarray) -> None:
        # Input: RGB uint8 [H, W, 3]
        if self.bpp == 32:
            alpha = np.full((self.height, self.width, 1), 255, dtype=np.uint8)
            frame_bgra = np.concatenate([frame_rgb[..., ::-1], alpha], axis=2)
            buf = frame_bgra.tobytes()
        else:
            frame_bgr = frame_rgb[..., ::-1]
            buf = frame_bgr.tobytes()

        self.wait_vsync()
        self.mm.seek(0)
        self.mm.write(buf)

    def close(self) -> None:
        try:
            self.mm.close()
        finally:
            os.close(self.fd)


def make_checkerboard(h: int, w: int, cell: int = 32) -> np.ndarray:
    y, x = np.indices((h, w))
    mask = ((x // cell) + (y // cell)) % 2
    img = np.where(mask[..., None] == 0, 255, 0).astype(np.uint8)
    return np.repeat(img, 3, axis=2)


def make_smooth_colorbar(h: int, w: int) -> np.ndarray:
    # Piecewise-linear smooth rainbow bar (RGB control points)
    cps = np.array(
        [
            [255, 0, 0],
            [255, 255, 0],
            [0, 255, 0],
            [0, 255, 255],
            [0, 0, 255],
            [255, 0, 255],
            [255, 0, 0],
        ],
        dtype=np.float32,
    )
    t = np.linspace(0.0, 1.0, w, dtype=np.float32)
    seg = np.floor(t * (len(cps) - 1)).astype(np.int32)
    seg = np.clip(seg, 0, len(cps) - 2)
    local_t = t * (len(cps) - 1) - seg

    left = cps[seg]
    right = cps[seg + 1]
    line = (left * (1.0 - local_t[:, None]) + right * local_t[:, None]).astype(np.uint8)

    img = np.repeat(line[None, :, :], h, axis=0)
    return img


def luminance_match(src: np.ndarray, dst: np.ndarray) -> np.ndarray:
    # Match mean luminance to reduce flash sensation at transition endpoints.
    # Y' ~= 0.299 R + 0.587 G + 0.114 B
    src_y = (0.299 * src[..., 0] + 0.587 * src[..., 1] + 0.114 * src[..., 2]).mean()
    dst_y = (0.299 * dst[..., 0] + 0.587 * dst[..., 1] + 0.114 * dst[..., 2]).mean()
    if dst_y < 1e-3:
        return dst
    scale = src_y / dst_y
    out = np.clip(dst.astype(np.float32) * scale, 0, 255).astype(np.uint8)
    return out


def crossfade(writer: FBWriter, a: np.ndarray, b: np.ndarray, transition_ms: int, fps: int) -> None:
    steps = max(2, int(transition_ms / max(1, int(1000 / max(1, fps)))))
    frame_dt = 1.0 / max(1, fps)

    af = a.astype(np.float32)
    bf = b.astype(np.float32)

    for i in range(1, steps + 1):
        if os.path.exists(STOP_FILE):
            return
        alpha = i / float(steps)
        frame = np.clip(af * (1.0 - alpha) + bf * alpha, 0, 255).astype(np.uint8)
        t0 = time.time()
        writer.write_rgb(frame)
        dt = time.time() - t0
        sleep_s = frame_dt - dt
        if sleep_s > 0:
            time.sleep(sleep_s)


def hold(writer: FBWriter, frame: np.ndarray, hold_s: float, fps: int) -> None:
    frame_dt = 1.0 / max(1, fps)
    deadline = time.time() + hold_s
    # Periodic rewrite can keep scan stable on some platforms.
    while time.time() < deadline:
        if os.path.exists(STOP_FILE):
            return
        t0 = time.time()
        writer.write_rgb(frame)
        dt = time.time() - t0
        sleep_s = frame_dt - dt
        if sleep_s > 0:
            time.sleep(sleep_s)


def main() -> int:
    parser = argparse.ArgumentParser(description="Low-flicker 2-pattern loop")
    parser.add_argument("--hold", type=float, default=0.8, help="hold time per endpoint (seconds)")
    parser.add_argument("--transition-ms", type=int, default=180, help="crossfade duration (ms)")
    parser.add_argument("--fps", type=int, default=60, help="target update fps")
    parser.add_argument("--cell", type=int, default=32, help="checkerboard cell size")
    args = parser.parse_args()

    if os.path.exists(STOP_FILE):
        try:
            os.remove(STOP_FILE)
        except Exception:
            pass

    writer = FBWriter()
    try:
        checker = make_checkerboard(writer.height, writer.width, max(2, args.cell))
        colorbar = make_smooth_colorbar(writer.height, writer.width)
        # Match endpoint mean brightness to reduce flash on hard endpoints.
        colorbar = luminance_match(checker, colorbar)

        log(
            f"start loop: hold={args.hold}s, transition={args.transition_ms}ms, fps={args.fps}, cell={args.cell}"
        )

        while not os.path.exists(STOP_FILE):
            hold(writer, checker, args.hold, args.fps)
            if os.path.exists(STOP_FILE):
                break
            crossfade(writer, checker, colorbar, args.transition_ms, args.fps)
            if os.path.exists(STOP_FILE):
                break
            hold(writer, colorbar, args.hold, args.fps)
            if os.path.exists(STOP_FILE):
                break
            crossfade(writer, colorbar, checker, args.transition_ms, args.fps)

        log("stop signal received")
        return 0
    finally:
        writer.close()


if __name__ == "__main__":
    raise SystemExit(main())
