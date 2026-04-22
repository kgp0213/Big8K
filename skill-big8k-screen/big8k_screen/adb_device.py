"""
Big8K ADB Device Control Module
"""

from __future__ import annotations

import subprocess
from typing import Dict, List, Optional


class ADBDevice:
    """ADB 设备控制类。"""

    def __init__(self, device_id: Optional[str] = None):
        self.device_id = device_id
        self._adb_path = "adb"

    def _run_command(self, args: List[str], timeout: int = 30) -> Dict:
        cmd = [self._adb_path] + args
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip(),
                "returncode": result.returncode,
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "stdout": "",
                "stderr": "Command timeout",
                "returncode": -1,
            }
        except Exception as exc:
            return {
                "success": False,
                "stdout": "",
                "stderr": str(exc),
                "returncode": -1,
            }

    def run_nowait(self, args: List[str]) -> Dict:
        cmd = [self._adb_path] + args
        try:
            subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return {"success": True}
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    def list_devices(self) -> Dict:
        result = self._run_command(["devices", "-l"])
        if not result["success"]:
            return {
                "success": False,
                "error": result.get("stderr") or "Unknown error",
                "devices": [],
                "count": 0,
            }

        devices = []
        lines = result["stdout"].split("\n")[1:]
        for line in lines:
            if not line.strip():
                continue
            parts = line.split()
            if len(parts) < 2:
                continue
            devices.append({
                "id": parts[0],
                "status": parts[1],
                "raw": line,
            })

        return {
            "success": True,
            "devices": devices,
            "count": len(devices),
        }

    def select_device(self, device_id: str) -> Dict:
        devices_result = self.list_devices()
        if not devices_result["success"]:
            return devices_result

        if not any(device["id"] == device_id for device in devices_result.get("devices", [])):
            return {
                "success": False,
                "error": f"Device {device_id} not found",
            }

        self.device_id = device_id
        return {
            "success": True,
            "device_id": device_id,
        }

    def resolve_device_id(self) -> Dict:
        if self.device_id:
            devices_result = self.list_devices()
            if not devices_result["success"]:
                return devices_result
            if any(device["id"] == self.device_id for device in devices_result.get("devices", [])):
                return {"success": True, "device_id": self.device_id}
            return {
                "success": False,
                "error": f"Device {self.device_id} is not connected",
            }

        devices_result = self.list_devices()
        if not devices_result["success"]:
            return devices_result

        devices = devices_result.get("devices", [])
        if not devices:
            return {
                "success": False,
                "error": "No device connected",
            }

        self.device_id = devices[0]["id"]
        return {
            "success": True,
            "device_id": self.device_id,
        }

    def probe_device(self) -> Dict:
        resolved = self.resolve_device_id()
        if not resolved["success"]:
            return resolved

        probe_results = {}
        device_id = resolved["device_id"]

        fb_result = self.shell("cat /sys/class/graphics/fb0/name")
        probe_results["fb0_available"] = fb_result["returncode"] == 0
        if fb_result["returncode"] == 0:
            probe_results["fb0_name"] = fb_result["stdout"]

        vs_result = self.shell("cat /sys/class/graphics/fb0/virtual_size")
        if vs_result["returncode"] == 0:
            probe_results["virtual_size"] = vs_result["stdout"]

        bpp_result = self.shell("cat /sys/class/graphics/fb0/bits_per_pixel")
        if bpp_result["returncode"] == 0:
            try:
                probe_results["bits_per_pixel"] = int(bpp_result["stdout"])
            except ValueError:
                pass

        vismpwr_result = self.shell("which vismpwr")
        probe_results["vismpwr_available"] = vismpwr_result["returncode"] == 0

        python_result = self.shell("which python3")
        probe_results["python3_available"] = python_result["returncode"] == 0

        return {
            "success": True,
            "device_id": device_id,
            "probe": probe_results,
        }

    def shell(self, command: str, timeout: int = 30) -> Dict:
        resolved = self.resolve_device_id()
        if not resolved["success"]:
            return {
                "success": False,
                "stdout": "",
                "stderr": resolved.get("error", "No device selected"),
                "returncode": -1,
            }

        result = self._run_command(
            ["-s", resolved["device_id"], "shell", command],
            timeout=timeout,
        )
        return {
            "success": result["returncode"] == 0,
            "stdout": result["stdout"],
            "stderr": result["stderr"],
            "returncode": result["returncode"],
        }

    def push(self, local_path: str, remote_path: str) -> Dict:
        resolved = self.resolve_device_id()
        if not resolved["success"]:
            return {
                "success": False,
                "error": resolved.get("error", "No device selected"),
            }

        result = self._run_command(["-s", resolved["device_id"], "push", local_path, remote_path])
        return {
            "success": result["returncode"] == 0,
            "stdout": result["stdout"],
            "stderr": result["stderr"],
        }

    def pull(self, remote_path: str, local_path: str) -> Dict:
        resolved = self.resolve_device_id()
        if not resolved["success"]:
            return {
                "success": False,
                "error": resolved.get("error", "No device selected"),
            }

        result = self._run_command(["-s", resolved["device_id"], "pull", remote_path, local_path])
        return {
            "success": result["returncode"] == 0,
            "stdout": result["stdout"],
            "stderr": result["stderr"],
        }

    def reboot(self) -> Dict:
        resolved = self.resolve_device_id()
        if not resolved["success"]:
            return {
                "success": False,
                "error": resolved.get("error", "No device selected"),
            }

        result = self._run_command(["-s", resolved["device_id"], "reboot"])
        return {
            "success": result["returncode"] == 0,
            "message": "Reboot command sent",
        }

    def wait_for_device(self, timeout: int = 60) -> Dict:
        result = self._run_command(["wait-for-device"], timeout=timeout)
        return {
            "success": result["returncode"] == 0,
            "message": "Device is now available",
        }
