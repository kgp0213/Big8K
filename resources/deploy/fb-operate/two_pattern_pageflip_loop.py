#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tear-minimized two-pattern loop using framebuffer page-flip (if supported).

Displays ONLY two frames:
- checkerboard
- smooth color bar

Core redesign:
- Pre-render both frames once
- Write each frame into separate framebuffer page
- Switch by FBIOPAN_DISPLAY page flip (instead of rewriting active scanout)

This can dramatically reduce tearing when yres_virtual >= 2*yres and pan is supported.
If page-flip is unavailable, script falls back to direct rewrite loop (with warning).

Stop signal:
- create /dev/shm/two_pattern_flip_stop
"""

import argparse
import ctypes
import fcntl
import mmap
import os
import time

import numpy as np

FB_PATH = "/dev/fb0"
STOP_FILE = "/dev/shm/two_pattern_flip_stop"
LOG_FILE = "/dev/shm/two_pattern_flip.log"

FBIOGET_VSCREENINFO = 0x4600
FBIOPUT_VSCREENINFO = 0x4601
FBIOGET_FSCREENINFO = 0x4602
FBIOPAN_DISPLAY = 0x4606
FBIO_WAITFORVSYNC = 0x4680


class fb_bitfield(ctypes.Structure):
    _fields_ = [
        ("offset", ctypes.c_uint32),
        ("length", ctypes.c_uint32),
        ("msb_right", ctypes.c_uint32),
    ]


class fb_var_screeninfo(ctypes.Structure):
    _fields_ = [
        ("xres", ctypes.c_uint32),
        ("yres", ctypes.c_uint32),
        ("xres_virtual", ctypes.c_uint32),
        ("yres_virtual", ctypes.c_uint32),
        ("xoffset", ctypes.c_uint32),
        ("yoffset", ctypes.c_uint32),
        ("bits_per_pixel", ctypes.c_uint32),
        ("grayscale", ctypes.c_uint32),
        ("red", fb_bitfield),
        ("green", fb_bitfield),
        ("blue", fb_bitfield),
        ("transp", fb_bitfield),
        ("nonstd", ctypes.c_uint32),
        ("activate", ctypes.c_uint32),
        ("height", ctypes.c_uint32),
        ("width", ctypes.c_uint32),
        ("accel_flags", ctypes.c_uint32),
        ("pixclock", ctypes.c_uint32),
        ("left_margin", ctypes.c_uint32),
        ("right_margin", ctypes.c_uint32),
        ("upper_margin", ctypes.c_uint32),
        ("lower_margin", ctypes.c_uint32),
        ("hsync_len", ctypes.c_uint32),
        ("vsync_len", ctypes.c_uint32),
        ("sync", ctypes.c_uint32),
        ("vmode", ctypes.c_uint32),
        ("rotate", ctypes.c_uint32),
        ("colorspace", ctypes.c_uint32),
        ("reserved", ctypes.c_uint32 * 4),
    ]


class fb_fix_screeninfo(ctypes.Structure):
    _fields_ = [
        ("id", ctypes.c_char * 16),
        ("smem_start", ctypes.c_ulong),
        ("smem_len", ctypes.c_uint32),
        ("type", ctypes.c_uint32),
        ("type_aux", ctypes.c_uint32),
        ("visual", ctypes.c_uint32),
        ("xpanstep", ctypes.c_uint16),
        ("ypanstep", ctypes.c_uint16),
        ("ywrapstep", ctypes.c_uint16),
        ("line_length", ctypes.c_uint32),
        ("mmio_start", ctypes.c_ulong),
        ("mmio_len", ctypes.c_uint32),
        ("accel", ctypes.c_uint32),
        ("capabilities", ctypes.c_uint16),
        ("reserved", ctypes.c_uint16 * 2),
    ]


def log(msg: str) -> None:
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write("[{}] {}\n".format(ts, msg))
    except Exception:
        pass


def make_checkerboard(h: int, w: int, cell: int = 32) -> np.ndarray:
    y, x = np.indices((h, w))
    mask = ((x // cell) + (y // cell)) % 2
    img = np.where(mask[..., None] == 0, 255, 0).astype(np.uint8)
    return np.repeat(img, 3, axis=2)


def make_smooth_colorbar(h: int, w: int) -> np.ndarray:
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
    return np.repeat(line[None, :, :], h, axis=0)


def to_bgra(frame_rgb: np.ndarray) -> np.ndarray:
    h, w, _ = frame_rgb.shape
    out = np.empty((h, w, 4), dtype=np.uint8)
    out[..., 0] = frame_rgb[..., 2]
    out[..., 1] = frame_rgb[..., 1]
    out[..., 2] = frame_rgb[..., 0]
    out[..., 3] = 255
    return out


def write_page(mm: mmap.mmap, line_length: int, yres: int, ypage: int, bgra: np.ndarray) -> None:
    row_bytes = bgra.shape[1] * 4
    base = ypage * yres * line_length
    for y in range(yres):
        start = base + y * line_length
        mm[start : start + row_bytes] = bgra[y].tobytes()


def wait_vsync(fd: int) -> bool:
    try:
        arg = ctypes.c_uint32(0)
        fcntl.ioctl(fd, FBIO_WAITFORVSYNC, arg)
        return True
    except Exception:
        return False


def pan_to(fd: int, var: fb_var_screeninfo, yoffset: int) -> bool:
    try:
        var.xoffset = 0
        var.yoffset = yoffset
        fcntl.ioctl(fd, FBIOPAN_DISPLAY, var)
        return True
    except Exception:
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="two-pattern page-flip loop")
    parser.add_argument("--hold", type=float, default=0.8, help="seconds each frame")
    parser.add_argument("--cell", type=int, default=32, help="checkerboard cell")
    args = parser.parse_args()

    if os.path.exists(STOP_FILE):
        try:
            os.remove(STOP_FILE)
        except Exception:
            pass

    fd = os.open(FB_PATH, os.O_RDWR)
    try:
        var = fb_var_screeninfo()
        fix = fb_fix_screeninfo()
        fcntl.ioctl(fd, FBIOGET_VSCREENINFO, var)
        fcntl.ioctl(fd, FBIOGET_FSCREENINFO, fix)

        if var.bits_per_pixel != 32:
            log("warning: bpp={} not 32, may fail".format(var.bits_per_pixel))

        xres = int(var.xres)
        yres = int(var.yres)
        line_length = int(fix.line_length)

        log(
            "fb: {}x{}, virt={}x{}, bpp={}, line_length={}, smem_len={}".format(
                xres, yres, int(var.xres_virtual), int(var.yres_virtual), int(var.bits_per_pixel), line_length, int(fix.smem_len)
            )
        )

        # Try to enable double buffer (2 pages in y)
        if int(var.yres_virtual) < yres * 2:
            try:
                var.yres_virtual = yres * 2
                fcntl.ioctl(fd, FBIOPUT_VSCREENINFO, var)
                # re-read actual applied
                fcntl.ioctl(fd, FBIOGET_VSCREENINFO, var)
                fcntl.ioctl(fd, FBIOGET_FSCREENINFO, fix)
                line_length = int(fix.line_length)
            except Exception:
                pass

        can_flip = int(var.yres_virtual) >= yres * 2
        required_two_pages = line_length * yres * 2
        has_two_pages_mem = int(fix.smem_len) >= required_two_pages
        can_flip = can_flip and has_two_pages_mem
        log(
            "page_flip_check: yvirt_ok={}, mem_ok={}, required={}, smem_len={}, final={}".format(
                int(var.yres_virtual) >= yres * 2,
                has_two_pages_mem,
                required_two_pages,
                int(fix.smem_len),
                can_flip,
            )
        )

        mm = mmap.mmap(fd, int(fix.smem_len), mmap.MAP_SHARED, mmap.PROT_WRITE)
        try:
            checker = to_bgra(make_checkerboard(yres, xres, max(2, args.cell)))
            colorbar = to_bgra(make_smooth_colorbar(yres, xres))

            if can_flip:
                # preload page0/page1 once
                write_page(mm, line_length, yres, 0, checker)
                write_page(mm, line_length, yres, 1, colorbar)

                # show checker first
                pan_to(fd, var, 0)
                log("start flip loop")

                current = 0
                while not os.path.exists(STOP_FILE):
                    if wait_vsync(fd):
                        pass
                    target = 1 if current == 0 else 0
                    if not pan_to(fd, var, target * yres):
                        log("pan failed, break")
                        break
                    current = target
                    time.sleep(max(0.01, args.hold))
            else:
                log("fallback rewrite loop")
                row_bytes = xres * 4
                while not os.path.exists(STOP_FILE):
                    for frame in (checker, colorbar):
                        if os.path.exists(STOP_FILE):
                            break
                        for y in range(yres):
                            start = y * line_length
                            mm[start : start + row_bytes] = frame[y].tobytes()
                        time.sleep(max(0.01, args.hold))

            log("stop signal received")
        finally:
            mm.close()

    finally:
        os.close(fd)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
