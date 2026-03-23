#!/usr/bin/env python3

import smbus2, time

BUS = 4

# 默认电阻，可按需要在实例化时覆盖
R1_DEF = 200e3
R2_DEF = 100e3
R3_DEF = 49.9e3
R_AB_DEF = 50e3
STEPS = 1024
"""
多器件通用 AD5272-50 调压脚本
VOUT = 0.8 * (1 + R1/(RP + R3))
电阻值可按器件实例随意指定
"""

def _cmd(bus, dev_addr, cmd, data):
    """发 2-byte 命令，自带 100 ms 延时"""
    bus.write_i2c_block_data(dev_addr, cmd, [data])
    time.sleep(0.1)

def vout_to_rdac(vout, r1=R1_DEF, r2=R2_DEF, r3=R3_DEF, r_ab=R_AB_DEF):
    """给定目标电压，返码值 0-1023"""
    if not 2.73 <= vout <= 4.0:
        raise ValueError("vout 必须落在 2.73–4.0 V 范围内")
    rp_tgt = r1 / ((vout / 0.8) - 1) - r3
    if rp_tgt <= 0:
        raise ValueError("vout 设置不合理，不可实现")
    r_pot_tgt = 1 / (1/rp_tgt - 1/r2)
    code = round(r_pot_tgt / r_ab * (STEPS - 1))
    return max(0, min(STEPS - 1, code))

def set_vout(vout, bus_no, dev_addr, r1=R1_DEF, r2=R2_DEF, r3=R3_DEF, r_ab=R_AB_DEF):
    """写一次 RDAC，立即生效"""
    code = vout_to_rdac(vout, r1, r2, r3, r_ab)
    with smbus2.SMBus(bus_no) as bus:
        _cmd(bus, dev_addr, 0x1C, 0x02)   # 允许写 RDAC
        _cmd(bus, dev_addr, 0x05, code)   # 写抽头值
    print(f"I²C-{bus_no}  0x{dev_addr:02X}  "
          f"VOUT={vout:.3f} V  →  RDAC 码={code}")
    return code

def save2_50tp(bus_no, dev_addr):
    """把当前 RDAC 值写进 50-TP 非易失存储"""
    print(f"I²C-{bus_no}  0x{dev_addr:02X}  保存到 50-TP ...")
    try:
        with smbus2.SMBus(bus_no) as bus:
            _cmd(bus, dev_addr, 0x1C, 0x03)   # 允许 50-TP 编程
            _cmd(bus, dev_addr, 0x0C, 0x00)   # 执行存储
            _cmd(bus, dev_addr, 0x1C, 0x02)   # 关闭 50-TP
        print("保存完成")
    except Exception as e:
        print("保存失败:", e)

def _read_word(bus, addr, reg):
    """读 INA226 16-bit 寄存器（reg=寄存器指针 0x00~0x07）"""
    bus.write_byte(addr, reg)          # 写指针
    msb, lsb = bus.read_i2c_block_data(addr, reg, 2)
    return (msb << 8) | lsb


def ina226_read(addr, flag=0, rs=0.2):
    """
    单命令读取 INA226 电压或电流
    :param addr: 7 位 I²C 地址
    :param flag: 0-电压(V), 1-电流(A)
    :param rs:   分流电阻(Ω)，仅测电流时使用
    :return:     实测值（V 或 A）
    """
    with smbus2.SMBus(BUS) as bus:
        if flag == 0:                           # ----- 测电压 -----
            raw = _read_word(bus, addr, 0x02)   # Bus Voltage Register
            return raw * 1.25e-3                # 1.25 mV/LSB

        else:                                   # ----- 测电流 -----
            raw = _read_word(bus, addr, 0x01)   # Shunt Voltage Register
            # 先换算成有符号值（16-bit 2's complement）
            if raw & 0x8000:
                raw -= 0x10000
            # print(f"raw = {raw:.3f}~")
            vshunt = raw * 2.5e-3               # 2.5 µV/LSB
            # print(f"vshunt = {vshunt:.4f} mV")
            return vshunt / rs                  # I = Vshunt / Rshunt

# ---------------- DEMO ---------------- #
if __name__ == "__main__":
   
    U1_ADDR, U2_ADDR = 0x2F, 0x2C   # 你的实际地址
    # 器件 1 调到 3.3 V
    # set_vout(3.35, BUS, U1_ADDR)
    # save2_50tp(BUS, U1_ADDR)
	
    print("\r\n--------------------")
    v = ina226_read(0x41)         
    print(f"VCI = {v:.3f} V")
    # 读取同一片的电流（RS=0.2 Ω）
    i = ina226_read(0x41, 1, 0.2)
    print(f"VCI_IOUT = {i:.3f} mA\r\n")

    # vddio = ina226_read(0x45)
    # print(f"VDDIO = {vddio:.3f} V")
    # i = ina226_read(0x45, 1, 0.2)
    # print(f"VDDIO_IOUT = {i:.4f} mA.\r\n")
    #
    # v = ina226_read(0x48)
    # print(f"DVDD = {v:.3f} V")
    # i = ina226_read(0x48, 1, 0.2)
    # print(f"DVDD_IOUT = {i:.4f} mA\r\n")
    #
    # v = ina226_read(0x40)
    # print(f"ELVDD = {v:.3f} V")
    # i = ina226_read(0x40, 1, 0.025)
    # print(f"ELVDD_IOUT = {i:.4f} mA\r\n")
    #
    # v = ina226_read(0x46)
    # print(f"ELVSS = -{v:.3f} V\r\n")
    #
    # v = ina226_read(0x44)
    # print(f"AVDD = {v:.3f} V")
    # i = ina226_read(0x44, 1, 0.2)
    # print(f"AVDD_IOUT = {i:.4f} mA\r\n")
    #
    # v = ina226_read(0x4c)
    # print(f"VGH = {v:.3f} V")
    # i = ina226_read(0x4c, 1, 0.2)
    # print(f"VGH1_IOUT = {i:.3f} mA\r\n")
    #
    # v = ina226_read(0x4a)
    # print(f"VGL = -{v:.3f} V")
    # vi = ina226_read(0x4f)   #增益，50V/V：INA282
    # vgli=1000*(vi-vddio/2)/50/0.2
    # print(f"VGL1_IOUT = {vgli:.3f} mA")
    
