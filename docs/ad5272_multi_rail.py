#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
AD5272 + INA226 多路调压/回读脚本（通过 adb shell + i2ctransfer/i2cdetect）

已验证调压映射：
- VCI   : AD5272 @ 0x2F, INA226 @ 0x41
- VDDIO : AD5272 @ 0x2C, INA226 @ 0x45
- DVDD  : AD5272 @ 0x2E, INA226 @ 0x48

关键写入流程：
- 普通 RDAC 更新：
    1) 先发 0x1C, 0x02    -> 允许更新 wiper/RDAC
    2) 再发 10-bit RDAC 写命令
- 50-TP/OTP 存储：
    1) 先发 0x1C, 0x03    -> 打开 RDAC update + 50-TP program enable
    2) 发 0x0C, 0x00      -> 将当前 RDAC 存到 50-TP
    3) 等待 tMEMORY_PROGRAM
    4) 再发 0x1C, 0x02    -> 退出 50-TP program enable，回到普通可写状态

说明：
- 本脚本运行在 PC 侧，通过 adb 进入目标设备执行 i2c 命令
- 需要目标设备上已有：i2ctransfer / i2cdetect
"""

import argparse
import re
import subprocess
import time
from dataclasses import dataclass
from typing import Optional

BUS = 4
STEPS = 1024
ADB = "adb"
T_MEMORY_PROGRAM_S = 0.40

# AD5272 地址
U1_ADDR = 0x2F   # VCI
U2_ADDR = 0x2C   # VDDIO
U3_ADDR = 0x2E   # DVDD

# INA226 / 监测地址
VCI_MON_ADDR = 0x41
VDDIO_MON_ADDR = 0x45
DVDD_MON_ADDR = 0x48
ELVDD_MON_ADDR = 0x40
ELVSS_MON_ADDR = 0x46
AVDD_MON_ADDR = 0x44
VGL_MON_ADDR = 0x4A
VGLI_MON_ADDR = 0x4F   # INA282 增益输出监测（按用户给定公式推算电流）

HEX_RE = re.compile(r"0x([0-9a-fA-F]{2})\s+0x([0-9a-fA-F]{2})")


@dataclass
class RailConfig:
    name: str
    dev_addr: int
    mon_addr: int
    vref: float
    vmin: float
    vmax: float
    r1: float
    r2: float
    r3: float
    r_ab: float
    rsense: float = 0.2


@dataclass
class MonitorConfig:
    name: str
    addr: int
    rsense: Optional[float] = None
    negative_voltage: bool = False


RAILS = {
    "vci": RailConfig(
        name="VCI",
        dev_addr=U1_ADDR,
        mon_addr=VCI_MON_ADDR,
        vref=1.206,
        vmin=2.73,
        vmax=4.00,
        r1=100e3,
        r2=100e3,
        r3=49.9e3,
        r_ab=50e3,
    ),
    "vddio": RailConfig(
        name="VDDIO",
        dev_addr=U2_ADDR,
        mon_addr=VDDIO_MON_ADDR,
        vref=1.206,
        vmin=1.70,
        vmax=2.00,
        r1=34e3,
        r2=100e3,
        r3=49.9e3,
        r_ab=50e3,
    ),
    "dvdd": RailConfig(
        name="DVDD",
        dev_addr=U3_ADDR,
        mon_addr=DVDD_MON_ADDR,
        vref=0.55,
        vmin=1.05,
        vmax=1.78,
        r1=49.9e3,
        r2=100e3,
        r3=22e3,
        r_ab=50e3,
    ),
}


MONITORS = {
    "vci": MonitorConfig("VCI", VCI_MON_ADDR, rsense=0.2),
    "vddio": MonitorConfig("VDDIO", VDDIO_MON_ADDR, rsense=0.2),
    "dvdd": MonitorConfig("DVDD", DVDD_MON_ADDR, rsense=0.2),
    "elvdd": MonitorConfig("ELVDD", ELVDD_MON_ADDR, rsense=0.025),
    "elvss": MonitorConfig("ELVSS", ELVSS_MON_ADDR, rsense=None, negative_voltage=True),
    "avdd": MonitorConfig("AVDD", AVDD_MON_ADDR, rsense=0.2),
    "vgl": MonitorConfig("VGL", VGL_MON_ADDR, rsense=None, negative_voltage=True),
    "vgli": MonitorConfig("VGLI", VGLI_MON_ADDR, rsense=None),
}


def adb_shell(cmd: str) -> str:
    return subprocess.check_output([ADB, "shell", cmd], text=True, stderr=subprocess.STDOUT).strip()


def detect_bus(bus_no: int = BUS) -> str:
    return adb_shell(f"i2cdetect -y -a {bus_no}")


def read_reg(bus_no: int, addr: int, reg: int) -> tuple[int, str]:
    out = adb_shell(f"i2ctransfer -f -y -a {bus_no} w1@0x{addr:02x} 0x{reg:02x} r2")
    m = HEX_RE.search(out)
    if not m:
        raise RuntimeError(f"unexpected i2ctransfer output: {out!r}")
    value = (int(m.group(1), 16) << 8) | int(m.group(2), 16)
    return value, out


def ina226_read_voltage(bus_no: int, addr: int) -> tuple[float, int, str]:
    raw, raw_text = read_reg(bus_no, addr, 0x02)
    return raw * 1.25e-3, raw, raw_text


def ina226_read_current_ma(bus_no: int, addr: int, rsense: float = 0.2) -> tuple[float, int, int, str]:
    raw, raw_text = read_reg(bus_no, addr, 0x01)
    signed = raw - 0x10000 if raw & 0x8000 else raw
    current_a = (signed * 2.5e-6) / rsense
    return current_a * 1000.0, raw, signed, raw_text


def write_control(bus_no: int, dev_addr: int, data: int) -> None:
    adb_shell(f"i2ctransfer -f -y -a {bus_no} w2@0x{dev_addr:02x} 0x1c 0x{data & 0xFF:02x}")
    time.sleep(0.12)


def write_rdac(bus_no: int, dev_addr: int, code: int) -> tuple[int, int]:
    code = max(0, min(STEPS - 1, int(code)))
    cmd = 0x04 | ((code >> 8) & 0x03)
    data = code & 0xFF

    # 日常 RDAC 更新，使用 0x1C,0x02 即可
    write_control(bus_no, dev_addr, 0x02)
    adb_shell(f"i2ctransfer -f -y -a {bus_no} w2@0x{dev_addr:02x} 0x{cmd:02x} 0x{data:02x}")
    time.sleep(0.25)
    return cmd, data


def save_to_50tp(bus_no: int, dev_addr: int) -> None:
    """
    将当前 RDAC 存入 50-TP。

    推荐流程：
    1) 0x1C,0x03 打开 RDAC update + 50-TP program enable
    2) 0x0C,0x00 执行 store
    3) 等待编程完成
    4) 0x1C,0x02 回到普通 RDAC 可写状态
    """
    write_control(bus_no, dev_addr, 0x03)
    adb_shell(f"i2ctransfer -f -y -a {bus_no} w2@0x{dev_addr:02x} 0x0c 0x00")
    time.sleep(T_MEMORY_PROGRAM_S)
    write_control(bus_no, dev_addr, 0x02)


def prepare_read_control_register(bus_no: int, dev_addr: int) -> None:
    # Command 8: read contents of the control register -> 0x2000
    adb_shell(f"i2ctransfer -f -y -a {bus_no} w2@0x{dev_addr:02x} 0x20 0x00")
    time.sleep(0.05)


def nop_read_16(bus_no: int, dev_addr: int) -> tuple[int, str]:
    # NOP / fetch return word from SDA side
    out = adb_shell(f"i2ctransfer -f -y -a {bus_no} w1@0x{dev_addr:02x} 0x00 r2")
    m = HEX_RE.search(out)
    if not m:
        raise RuntimeError(f"unexpected nop-read output: {out!r}")
    value = (int(m.group(1), 16) << 8) | int(m.group(2), 16)
    return value, out


def read_control_register(bus_no: int, dev_addr: int) -> tuple[int, str]:
    prepare_read_control_register(bus_no, dev_addr)
    value, raw_text = nop_read_16(bus_no, dev_addr)
    return value, raw_text


def decode_control_register(value: int) -> dict:
    # datasheet 里真正有意义的是低 4 bit: C3 C2 C1 C0（按描述位名输出）
    c0 = (value >> 0) & 1
    c1 = (value >> 1) & 1
    c2 = (value >> 2) & 1
    c3 = (value >> 3) & 1
    return {
        "raw": value,
        "C0_50TP_PROGRAM_ENABLE": c0,
        "C1_RDAC_WRITE_ENABLE": c1,
        "C2_RPERF_DISABLE": c2,
        "C3_50TP_PROGRAM_SUCCESS": c3,
    }


def calc_code(vout: float, cfg: RailConfig) -> int:
    if not (cfg.vmin <= vout <= cfg.vmax):
        raise ValueError(f"{cfg.name} vout 必须落在 {cfg.vmin:.2f}–{cfg.vmax:.2f} V 范围内")

    rp_tgt = cfg.r1 / ((vout / cfg.vref) - 1) - cfg.r3
    if rp_tgt <= 0:
        raise ValueError(f"{cfg.name} vout 设置不合理，不可实现: rp_tgt={rp_tgt}")

    den = (1.0 / rp_tgt) - (1.0 / cfg.r2)
    if den <= 0:
        raise ValueError(f"{cfg.name} 按当前参数不可实现: den={den}")

    r_pot_tgt = 1.0 / den
    code = round(r_pot_tgt / cfg.r_ab * (STEPS - 1))
    return max(0, min(STEPS - 1, code))


def readback(bus_no: int, cfg: RailConfig) -> dict:
    v, raw_v, raw_v_text = ina226_read_voltage(bus_no, cfg.mon_addr)
    i_ma, raw_i, signed_i, raw_i_text = ina226_read_current_ma(bus_no, cfg.mon_addr, cfg.rsense)
    return {
        "voltage_v": v,
        "raw_v": raw_v,
        "raw_v_text": raw_v_text,
        "current_ma": i_ma,
        "raw_i": raw_i,
        "signed_i": signed_i,
        "raw_i_text": raw_i_text,
    }


def set_vout_vci(vout: float, bus_no: int = BUS) -> tuple[int, dict]:
    cfg = RAILS["vci"]
    code = calc_code(vout, cfg)
    write_rdac(bus_no, cfg.dev_addr, code)
    return code, readback(bus_no, cfg)


def set_vout_vddio(vout: float, bus_no: int = BUS) -> tuple[int, dict]:
    cfg = RAILS["vddio"]
    code = calc_code(vout, cfg)
    write_rdac(bus_no, cfg.dev_addr, code)
    return code, readback(bus_no, cfg)


def set_vout_dvdd(vout: float, bus_no: int = BUS) -> tuple[int, dict]:
    cfg = RAILS["dvdd"]
    code = calc_code(vout, cfg)
    write_rdac(bus_no, cfg.dev_addr, code)
    return code, readback(bus_no, cfg)


def save_vci_to_50tp(bus_no: int = BUS) -> dict:
    save_to_50tp(bus_no, RAILS["vci"].dev_addr)
    ctrl, raw = read_control_register(bus_no, RAILS["vci"].dev_addr)
    return {"control_raw": ctrl, "control_raw_text": raw, "decoded": decode_control_register(ctrl)}


def save_vddio_to_50tp(bus_no: int = BUS) -> dict:
    save_to_50tp(bus_no, RAILS["vddio"].dev_addr)
    ctrl, raw = read_control_register(bus_no, RAILS["vddio"].dev_addr)
    return {"control_raw": ctrl, "control_raw_text": raw, "decoded": decode_control_register(ctrl)}


def save_dvdd_to_50tp(bus_no: int = BUS) -> dict:
    save_to_50tp(bus_no, RAILS["dvdd"].dev_addr)
    ctrl, raw = read_control_register(bus_no, RAILS["dvdd"].dev_addr)
    return {"control_raw": ctrl, "control_raw_text": raw, "decoded": decode_control_register(ctrl)}


def read_monitor(bus_no: int, key: str, cached: Optional[dict] = None) -> dict:
    cfg = MONITORS[key]
    v, raw_v, raw_v_text = ina226_read_voltage(bus_no, cfg.addr)
    shown_v = -v if cfg.negative_voltage else v

    out = {
        "name": cfg.name,
        "addr": cfg.addr,
        "voltage_v": shown_v,
        "voltage_v_raw_positive": v,
        "raw_v": raw_v,
        "raw_v_text": raw_v_text,
    }

    if cfg.rsense is not None:
        i_ma, raw_i, signed_i, raw_i_text = ina226_read_current_ma(bus_no, cfg.addr, cfg.rsense)
        out.update({
            "current_ma": i_ma,
            "raw_i": raw_i,
            "signed_i": signed_i,
            "raw_i_text": raw_i_text,
            "rsense": cfg.rsense,
        })

    # VGLI 特例：按用户给定公式，用 VDDIO 作为中点参考推算电流
    if key == "vgli":
        if cached is None:
            cached = {}
        if "vddio" not in cached:
            cached["vddio"] = read_monitor(bus_no, "vddio", cached)
        vddio_pos = cached["vddio"]["voltage_v_raw_positive"]
        vi = v  # 0x4F 本身按 bus voltage 读取出的正电压
        vgli_ma = 1000.0 * (vi - vddio_pos / 2.0) / 50.0 / 0.2
        out["current_ma"] = vgli_ma
        out["formula"] = "1000*(vi - vddio/2)/50/0.2"
        out["vddio_reference_v"] = vddio_pos

    return out


def read_all_monitors(bus_no: int = BUS) -> dict:
    cached = {}
    order = ["vci", "vddio", "dvdd", "elvdd", "elvss", "avdd", "vgl", "vgli"]
    for key in order:
        cached[key] = read_monitor(bus_no, key, cached)
    return cached


def fmt_result(name: str, target: float, code: int, rb: dict) -> str:
    return (
        f"{name}: target={target:.3f} V, code={code} (0x{code:03X})\n"
        f"  Vraw={rb['raw_v_text']} -> 0x{rb['raw_v']:04X} -> {rb['voltage_v']:.6f} V\n"
        f"  Iraw={rb['raw_i_text']} -> 0x{rb['raw_i']:04X} signed={rb['signed_i']} -> {rb['current_ma']:.6f} mA"
    )


def fmt_monitor(m: dict) -> str:
    s = f"{m['name']}: addr=0x{m['addr']:02X} Vraw={m['raw_v_text']} -> 0x{m['raw_v']:04X} -> {m['voltage_v']:.6f} V"
    if "current_ma" in m:
        if "raw_i_text" in m:
            s += (
                f"\n  Iraw={m['raw_i_text']} -> 0x{m['raw_i']:04X} signed={m['signed_i']} -> {m['current_ma']:.6f} mA"
            )
        else:
            s += f"\n  I={m['current_ma']:.6f} mA"
    if "formula" in m:
        s += f"\n  formula={m['formula']} (vddio_ref={m['vddio_reference_v']:.6f} V)"
    return s


def main():
    parser = argparse.ArgumentParser(description="AD5272 三路调压脚本（adb 版）")
    parser.add_argument("--bus", type=int, default=BUS)
    parser.add_argument("--detect", action="store_true", help="输出 i2cdetect")
    parser.add_argument("--vci", type=float, help="设置 VCI 电压")
    parser.add_argument("--vddio", type=float, help="设置 VDDIO 电压")
    parser.add_argument("--dvdd", type=float, help="设置 DVDD 电压")
    parser.add_argument("--demo", action="store_true", help="使用示例值：VCI=3.35, VDDIO=1.85, DVDD=1.10")
    parser.add_argument("--save-vci", action="store_true", help="将当前 VCI RDAC 保存到 50-TP")
    parser.add_argument("--save-vddio", action="store_true", help="将当前 VDDIO RDAC 保存到 50-TP")
    parser.add_argument("--save-dvdd", action="store_true", help="将当前 DVDD RDAC 保存到 50-TP")
    parser.add_argument("--read-all", action="store_true", help="读取除 VGH 外的所有电压/电流监测")
    args = parser.parse_args()

    if args.detect:
        print(detect_bus(args.bus))
        print()

    if args.demo:
        args.vci = 3.35 if args.vci is None else args.vci
        args.vddio = 1.85 if args.vddio is None else args.vddio
        args.dvdd = 1.10 if args.dvdd is None else args.dvdd

    did = False

    if args.vci is not None:
        code, rb = set_vout_vci(args.vci, args.bus)
        print(fmt_result("VCI", args.vci, code, rb))
        print()
        did = True

    if args.vddio is not None:
        code, rb = set_vout_vddio(args.vddio, args.bus)
        print(fmt_result("VDDIO", args.vddio, code, rb))
        print()
        did = True

    if args.dvdd is not None:
        code, rb = set_vout_dvdd(args.dvdd, args.bus)
        print(fmt_result("DVDD", args.dvdd, code, rb))
        print()
        did = True

    if args.save_vci:
        info = save_vci_to_50tp(args.bus)
        print("VCI save_to_50tp done")
        print(f"  control_raw={info['control_raw_text']} -> 0x{info['control_raw']:04X}")
        print(f"  decoded={info['decoded']}")
        print()
        did = True

    if args.save_vddio:
        info = save_vddio_to_50tp(args.bus)
        print("VDDIO save_to_50tp done")
        print(f"  control_raw={info['control_raw_text']} -> 0x{info['control_raw']:04X}")
        print(f"  decoded={info['decoded']}")
        print()
        did = True

    if args.save_dvdd:
        info = save_dvdd_to_50tp(args.bus)
        print("DVDD save_to_50tp done")
        print(f"  control_raw={info['control_raw_text']} -> 0x{info['control_raw']:04X}")
        print(f"  decoded={info['decoded']}")
        print()
        did = True

    if args.read_all:
        allm = read_all_monitors(args.bus)
        for key in ["vci", "vddio", "dvdd", "elvdd", "elvss", "avdd", "vgl", "vgli"]:
            print(fmt_monitor(allm[key]))
            print()
        did = True

    if not did:
        parser.print_help()


if __name__ == "__main__":
    main()
