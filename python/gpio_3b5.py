#!/usr/bin/env python3
import os
import sys

def parse_gpio_pin(gpio_str):
    if not gpio_str.startswith("gpio") or len(gpio_str) != 7:
        raise ValueError("Invalid GPIO string format")
    
    bank = int(gpio_str[4])
    group_str = gpio_str[5].upper()
    x = int(gpio_str[6])
    
    if group_str not in "ABCD":
        raise ValueError("Invalid group character")
    group = ord(group_str) - ord('A')
    
    number = group * 8 + x
    pin = bank * 32 + number
    
    return pin

def export_gpio(pin):
    try:
        with open("/sys/class/gpio/export", "w") as f:
            f.write(str(pin))
    except IOError:
        pass

def set_gpio_direction(pin, direction):
    with open(f"/sys/class/gpio/gpio{pin}/direction", "w") as f:
        f.write(direction)

def write_gpio_value(pin, value):
    with open(f"/sys/class/gpio/gpio{pin}/value", "w") as f:
        f.write(str(value))

if __name__ == "__main__":
    # 默认值为1
    value = 1
    gpio_str = "gpio3b5"
    
    # 检查命令行参数
    if len(sys.argv) > 1:
        if sys.argv[1] in ['0', '1']:
            value = int(sys.argv[1])
        else:
            print("参数错误：只能为0或1")
            sys.exit(1)
    
    pin = parse_gpio_pin(gpio_str)
    
    export_gpio(pin)
    set_gpio_direction(pin, "out")
    write_gpio_value(pin, value)
    
    level = "高电平" if value == 1 else "低电平"
    print(f"GPIO {gpio_str} (pin {pin}) 已设置为{level}")