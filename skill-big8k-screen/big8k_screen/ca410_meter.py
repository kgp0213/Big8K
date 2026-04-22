"""
CA410 Brightness Meter Communication Module
CA-VP410 亮度计串口通信协议实现
"""

import serial
import time
from typing import Optional, Dict, List
import serial.tools.list_ports


# CA410 串口参数
CA410_CONFIG = {
    "baudrate": 921600,
    "parity": serial.PARITY_EVEN,
    "bytesize": serial.SEVENBITS,
    "stopbits": serial.STOPBITS_ONE_POINT_FIVE,
    "timeout": 0.5,
    "command_terminator": "\r"
}


class CA410Meter:
    """CA410 亮度计控制类"""

    def __init__(self, port: Optional[str] = None):
        self.port = port
        self.serial: Optional[serial.Serial] = None
        self.is_initialized = False

    def scan_ports(self) -> Dict:
        """扫描并自动检测 CA410 设备端口"""
        ports = list(serial.tools.list_ports.comports())
        ca410_ports = []

        for p in ports:
            # 尝试连接并检测是否是 CA410
            try:
                test_ser = serial.Serial(
                    port=p.device,
                    baudrate=CA410_CONFIG["baudrate"],
                    parity=CA410_CONFIG["parity"],
                    bytesize=CA410_CONFIG["bytesize"],
                    stopbits=CA410_CONFIG["stopbits"],
                    timeout=0.3
                )
                time.sleep(0.3)

                # 发送握手命令
                test_ser.write(b"\r")
                time.sleep(0.2)

                if test_ser.in_waiting > 0:
                    response = test_ser.read(test_ser.in_waiting).decode('utf-8', errors='replace')
                    if "OK" in response or "CA" in response:
                        ca410_ports.append({
                            "port": p.device,
                            "description": p.description,
                            "hwid": p.hwid
                        })

                test_ser.close()
            except Exception:
                continue

        return {
            "success": True,
            "ports": ca410_ports,
            "count": len(ca410_ports)
        }

    def connect(self, port: Optional[str] = None) -> Dict:
        """连接到 CA410 亮度计"""
        target_port = port or self.port

        if not target_port:
            # 尝试自动检测
            scan_result = self.scan_ports()
            if scan_result["count"] == 0:
                return {
                    "success": False,
                    "error": "No CA410 device found"
                }
            target_port = scan_result["ports"][0]["port"]

        try:
            self.serial = serial.Serial(
                port=target_port,
                baudrate=CA410_CONFIG["baudrate"],
                parity=CA410_CONFIG["parity"],
                bytesize=CA410_CONFIG["bytesize"],
                stopbits=CA410_CONFIG["stopbits"],
                timeout=CA410_CONFIG["timeout"]
            )
            time.sleep(0.3)  # 等待连接稳定

            self.port = target_port
            return {
                "success": True,
                "port": target_port,
                "message": "Connected to CA410"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to connect: {str(e)}"
            }

    def disconnect(self) -> Dict:
        """断开连接"""
        if self.serial and self.serial.is_open:
            self.serial.close()

        self.is_initialized = False
        return {
            "success": True,
            "message": "Disconnected"
        }

    def _send_command(self, command: str) -> Dict:
        """发送命令并读取响应"""
        if not self.serial or not self.serial.is_open:
            return {
                "success": False,
                "error": "Not connected"
            }

        try:
            # 清空缓冲区
            if self.serial.in_waiting > 0:
                self.serial.read(self.serial.in_waiting)

            # 发送命令
            full_command = command + CA410_CONFIG["command_terminator"]
            self.serial.write(full_command.encode())
            time.sleep(0.2)

            # 读取响应
            if self.serial.in_waiting > 0:
                response = self.serial.readline().decode('utf-8', errors='replace').strip()
                return {
                    "success": True,
                    "response": response
                }
            else:
                return {
                    "success": False,
                    "error": "No response"
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def initialize(self, sync_freq: float = 60.0) -> Dict:
        """初始化 CA410 亮度计"""
        if not self.serial or not self.serial.is_open:
            result = self.connect()
            if not result["success"]:
                return result

        init_commands = [
            "SCS,0",           # 同步源设置
            f"SCS,4,{sync_freq}",  # INT 模式，指定频率
            "FSC,1",           # FAST 测量速度
            "MMS,0",           # 控制模式
            "MDS,0",           # 显示模式: LV,x,y
            "FMS,0",           # 闪烁方式
            "MCH,0",           # 通道 CH0
            "LUS,1",           # 亮度单位 cd/m²
        ]

        # 发送初始化命令
        for cmd in init_commands:
            result = self._send_command(cmd)
            if not result["success"]:
                return {
                    "success": False,
                    "error": f"Failed to execute {cmd}: {result.get('error')}"
                }
            time.sleep(0.2)

        # 执行零校准
        zrc_result = self._send_command("ZRC")
        if not zrc_result["success"]:
            return {
                "success": False,
                "error": f"Zero calibration failed: {zrc_result.get('error')}"
            }

        # 等待零校准完成
        for _ in range(15):
            time.sleep(1)
            if self.serial.in_waiting > 0:
                response = self.serial.readline().decode('utf-8', errors='replace').strip()
                if "OK00" in response:
                    break

        # 清空缓冲区
        if self.serial.in_waiting > 0:
            self.serial.read(self.serial.in_waiting)

        self.is_initialized = True
        return {
            "success": True,
            "message": "CA410 initialized successfully"
        }

    def measure_once(self) -> Dict:
        """单次测量亮度"""
        if not self.is_initialized:
            # 未初始化，先尝试初始化
            init_result = self.initialize()
            if not init_result["success"]:
                return init_result

        # 发送测量命令
        result = self._send_command("MES,1")
        if not result["success"]:
            return {
                "success": False,
                "error": f"Measurement failed: {result.get('error')}"
            }

        # 解析响应
        response = result.get("response", "")
        if not response or "OK00" not in response:
            return {
                "success": False,
                "error": f"Invalid response: {response}"
            }

        try:
            parts = response.split(",")
            if len(parts) >= 6:
                cx = float(parts[3])  # x 色坐标
                cy = float(parts[4])  # y 色坐标
                lv = float(parts[5])  # 亮度 cd/m²

                return {
                    "success": True,
                    "lv": lv,
                    "cx": cx,
                    "cy": cy,
                    "raw": response
                }
            else:
                return {
                    "success": False,
                    "error": f"Invalid response format: {response}"
                }
        except (ValueError, IndexError) as e:
            return {
                "success": False,
                "error": f"Failed to parse response: {str(e)}"
            }

    def measure_multiple(self, count: int = 5, interval: float = 0.5) -> Dict:
        """多次测量并返回平均值"""
        results = []

        for _ in range(count):
            result = self.measure_once()
            if result["success"]:
                results.append(result)
            time.sleep(interval)

        if not results:
            return {
                "success": False,
                "error": "All measurements failed"
            }

        # 计算平均值
        avg_lv = sum(r["lv"] for r in results) / len(results)
        avg_cx = sum(r["cx"] for r in results) / len(results)
        avg_cy = sum(r["cy"] for r in results) / len(results)

        return {
            "success": True,
            "count": len(results),
            "lv": round(avg_lv, 4),
            "cx": round(avg_cx, 6),
            "cy": round(avg_cy, 6),
            "raw_results": results
        }

    def set_measurement_speed(self, mode: str = "FAST") -> Dict:
        """设置测量速度
        mode: SLOW, FAST, AUTO
        """
        speed_map = {
            "SLOW": "FSC,0",
            "FAST": "FSC,1",
            "AUTO": "FSC,3"
        }

        if mode not in speed_map:
            return {
                "success": False,
                "error": f"Invalid mode: {mode}. Use SLOW, FAST, or AUTO"
            }

        return self._send_command(speed_map[mode])

    def set_sync_frequency(self, freq: float = 60.0) -> Dict:
        """设置同步频率"""
        return self._send_command(f"SCS,4,{freq}")


# 便捷函数
def quick_measure(port: Optional[str] = None) -> Dict:
    """快速测量亮度（自动连接、初始化、测量）"""
    meter = CA410Meter(port)

    # 连接
    conn_result = meter.connect()
    if not conn_result["success"]:
        return conn_result

    # 初始化
    init_result = meter.initialize()
    if not init_result["success"]:
        return init_result

    # 测量
    return meter.measure_once()