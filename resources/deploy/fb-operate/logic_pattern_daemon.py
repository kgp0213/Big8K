#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Low-flicker logic pattern daemon (v3 — ping-pong double buffer with FBIOPAN_DISPLAY).

Key improvements over v1:
- smem_len=14114816, stride=1440, yres=2392
- yres_virtual=9802, enough for 2 full frames (page0 at y=0, page1 at y=2392)
- Pre-write next frame to the non-visible page, then pan to it via FBIOPAN_DISPLAY
- Wait for vsync before pan, so the switch happens at frame boundary

Control files:
- /dev/shm/logic_pattern_cmd         (write pattern id 0-39)
- /dev/shm/logic_pattern_applied     (daemon writes last applied pattern id)
- /dev/shm/logic_pattern_stop        (create file to stop daemon)
"""

import ctypes
import fcntl
import mmap
import os
import struct
import time
import traceback
from typing import Optional

import numpy as np

from logicPictureShow import InteractiveSystem

FB_PATH = "/dev/fb0"
CMD_FILE = "/dev/shm/logic_pattern_cmd"
APPLIED_FILE = "/dev/shm/logic_pattern_applied"
STOP_FILE = "/dev/shm/logic_pattern_stop"
PID_FILE = "/dev/shm/logic_pattern_daemon.pid"
READY_FILE = "/dev/shm/logic_pattern_daemon.ready"
LOG_FILE = "/dev/shm/logic_pattern_daemon.log"

# RK3588 fb ioctls
FBIOGET_VSCREENINFO = 0x4600
FBIOPUT_VSCREENINFO = 0x4601
FBIOGET_FSCREENINFO = 0x4602
FBIOPAN_DISPLAY = 0x4606
FBIO_WAITFORVSYNC = 0x4680

# Frame geometry (from sysfs)
YRES = 2392          # visible height
STRIDE = 1440        # bytes per line (360 pixels * 4 bytes)
BYTES_PER_FRAME = YRES * STRIDE   # 3444480 bytes
PAGE_SIZE = YRES * STRIDE         # one frame page


class PingPongFB:
    """Persistent ping-pong framebuffer writer with vsync-aligned pan."""

    def __init__(self) -> None:
        self.fd = os.open(FB_PATH, os.O_RDWR)
        # Get current var/fb info
        self.var = fb_var_screeninfo()
        self.fix = fb_fix_screeninfo()
        fcntl.ioctl(self.fd, FBIOGET_VSCREENINFO, self.var)
        fcntl.ioctl(self.fd, FBIOGET_FSCREENINFO, self.fix)

        self.yres = int(self.var.yres)
        self.stride = int(self.fix.line_length)
        self.bpp = int(self.var.bits_per_pixel)
        self.bytespp = 4 if self.bpp == 32 else 3
        self.yres_virtual = int(self.var.yres_virtual)
        self.current_page = 0   # 0 or 1 (y offset in rows)

        # Mmap the whole fb shared memory
        smem_len = int(self.fix.smem_len)
        self.mm = mmap.mmap(self.fd, smem_len, mmap.MAP_SHARED, mmap.PROT_WRITE)

        # Derive page size from actual geometry
        self.page_size = self.yres * self.stride
        pages_per_fb = smem_len // self.page_size
        self.can_pan = pages_per_fb >= 2

        _log(
            "fb init: {}x{} virt={} stride={} bpp={} smem={} pages={} can_pan={}".format(
                self.yres, self.stride, self.yres_virtual, self.stride,
                self.bpp, smem_len, pages_per_fb, self.can_pan
            )
        )

        if not self.can_pan:
            _log("WARNING: not enough memory for ping-pong, falling back to direct write")

    def _normalize_rgb(self, image_rgb: np.ndarray) -> np.ndarray:
        if image_rgb.ndim == 3 and image_rgb.shape[2] == 3:
            if image_rgb.shape[0] == self.yres and image_rgb.shape[1] * 3 == self.stride:
                return image_rgb
            if image_rgb.shape[0] == 1 and image_rgb.shape[1] == self.yres * self.stride // 3:
                return image_rgb.reshape((self.yres, self.stride // 3, 3))
        if image_rgb.ndim == 1 and image_rgb.size == self.yres * self.stride:
            return image_rgb.reshape((self.yres, self.stride // 3, 3))
        raise ValueError("bad frame shape: {}".format(image_rgb.shape))

    def _rgb_to_bgra(self, rgb: np.ndarray) -> np.ndarray:
        h, w, _ = rgb.shape
        out = np.empty((h, w, 4), dtype=np.uint8)
        out[..., 0] = rgb[..., 2]
        out[..., 1] = rgb[..., 1]
        out[..., 2] = rgb[..., 0]
        out[..., 3] = 255
        return out

    def _wait_vsync(self) -> None:
        try:
            arg = struct.pack("I", 0)
            fcntl.ioctl(self.fd, FBIO_WAITFORVSYNC, arg)
        except Exception:
            pass

    def _pan_y(self, yoffset_rows: int) -> bool:
        try:
            self.var.xoffset = 0
            self.var.yoffset = yoffset_rows
            fcntl.ioctl(self.fd, FBIOPAN_DISPLAY, self.var)
            return True
        except Exception as e:
            _log("pan failed: {}".format(e))
            return False

    def write_to_page(self, image_rgb: np.ndarray, page: int) -> None:
        """Write a normalized RGB frame to the specified page (0 or 1)."""
        rgb = self._normalize_rgb(image_rgb)
        bgra = self._rgb_to_bgra(rgb)

        page_offset = page * self.page_size
        for row_idx in range(self.yres):
            row_start = page_offset + row_idx * self.stride
            self.mm[row_start:row_start + self.stride] = bgra[row_idx].tobytes()

    def switch_to_page(self, page: int) -> None:
        """Pan to make the specified page visible, waiting for vsync first."""
        if page == self.current_page:
            return
        self._wait_vsync()
        self._pan_y(page * self.yres)
        self.current_page = page

    def close(self) -> None:
        try:
            self.mm.close()
        finally:
            os.close(self.fd)


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


def _log(msg: str) -> None:
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write("[{}] {}\n".format(ts, msg))
    except Exception:
        pass


def _read_pattern() -> Optional[int]:
    if not os.path.exists(CMD_FILE):
        return None
    try:
        with open(CMD_FILE, "r", encoding="utf-8") as f:
            v = int(f.read().strip())
        if 0 <= v <= 39:
            return v
    except Exception:
        pass
    return None


def _write_text(path: str, text: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def main() -> int:
    os.makedirs("/dev/shm", exist_ok=True)
    _write_text(PID_FILE, str(os.getpid()))

    if os.path.exists(STOP_FILE):
        try:
            os.remove(STOP_FILE)
        except Exception:
            pass

    system = InteractiveSystem(initial_pattern=0, persistent=False)
    fb = PingPongFB()

    _write_text(READY_FILE, "1")
    _log("daemon started v3 (ping-pong fb, can_pan={})".format(fb.can_pan))

    last_mtime = os.path.getmtime(CMD_FILE) if os.path.exists(CMD_FILE) else 0.0
    last_pattern = None  # type: Optional[int]
    pending_pattern = None  # type: Optional[int]

    initial = _read_pattern()
    if initial is not None:
        last_pattern = initial

    try:
        while True:
            if os.path.exists(STOP_FILE):
                _log("stop signal detected")
                break

            # Check for new pattern command
            if os.path.exists(CMD_FILE):
                mtime = os.path.getmtime(CMD_FILE)
                if mtime != last_mtime:
                    last_mtime = mtime
                    p = _read_pattern()
                    if p is not None and p != last_pattern:
                        pending_pattern = p

            # Apply pending pattern: write to non-visible page, then pan
            if pending_pattern is not None:
                next_page = 1 - fb.current_page
                frame = system.logic_patterns[pending_pattern]()
                fb.write_to_page(frame, next_page)
                fb.switch_to_page(next_page)
                _write_text(APPLIED_FILE, str(pending_pattern))
                _log("applied pattern: {} page: {}".format(pending_pattern, next_page))
                last_pattern = pending_pattern
                pending_pattern = None

            time.sleep(0.01)

    finally:
        try:
            fb.close()
        except Exception:
            pass

    for p in (PID_FILE, READY_FILE, STOP_FILE, CMD_FILE, APPLIED_FILE):
        try:
            if os.path.exists(p):
                os.remove(p)
        except Exception:
            pass

    _log("daemon exited")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
