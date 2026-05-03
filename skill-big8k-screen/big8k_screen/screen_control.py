"""
Big8K Screen Display / Deploy Control Module
"""

from __future__ import annotations

import os
import re
import shlex
from pathlib import Path
from typing import Dict, List, Optional

from .adb_device import ADBDevice


RUNTIME_PATTERNS = [
    "gray8",
    "gray64",
    "gray128",
    "gray192",
    "gray255",
    "red",
    "green",
    "blue",
    "white",
    "black",
    "checkerboard",
    "gradient",
    "vertical_lines",
    "horizontal_lines",
    "color_bar",
    "ramps",
]


class ScreenController:
    """屏幕显示与部署控制类。"""

    def __init__(self, device: ADBDevice):
        self.device = device
        self.repo_root = Path(__file__).resolve().parents[2]
        self.python_root = self.repo_root / "python"
        self.deploy_root = self.repo_root / "resources" / "deploy"

    def _quote(self, value: str) -> str:
        return shlex.quote(value)

    def _repo_file(self, relative_path: str) -> Path:
        return self.repo_root / relative_path

    def _run_shell_required(self, command: str, timeout: int = 120) -> Dict:
        result = self.device.shell(command, timeout=timeout)
        return {
            "success": result["returncode"] == 0,
            "stdout": result.get("stdout", ""),
            "stderr": result.get("stderr", ""),
            "error": result.get("stderr") or result.get("stdout") or "Command failed",
        }

    def _ensure_remote_dir(self, remote_dir: str) -> Dict:
        return self._run_shell_required(f"mkdir -p {self._quote(remote_dir)}")

    def _push_required(self, local_path: Path, remote_path: str) -> Dict:
        result = self.device.push(str(local_path), remote_path)
        return {
            "success": result.get("success", False),
            "stdout": result.get("stdout", ""),
            "stderr": result.get("stderr", ""),
            "error": result.get("stderr") or result.get("stdout") or f"Failed to push {local_path}",
        }

    def _push_dir_required(self, local_dir: Path, remote_dir: str) -> Dict:
        result = self.device.push(str(local_dir), remote_dir)
        return {
            "success": result.get("success", False),
            "stdout": result.get("stdout", ""),
            "stderr": result.get("stderr", ""),
            "error": result.get("stderr") or result.get("stdout") or f"Failed to push {local_dir}",
        }

    def _run_project_python(self, local_script: Path, remote_script: str, args: List[str]) -> Dict:
        push_result = self._push_required(local_script, remote_script)
        if not push_result["success"]:
            return push_result

        quoted_args = " ".join(self._quote(arg) for arg in args)
        command = f"python3 {self._quote(remote_script)}"
        if quoted_args:
            command = f"{command} {quoted_args}"
        return self._run_shell_required(command, timeout=180)

    def _sanitize_remote_name(self, remote_name: str) -> str:
        sanitized = re.sub(r"[^A-Za-z0-9._-]", "_", remote_name.strip())
        return sanitized or "input_image.bmp"

    def display_runtime_pattern(self, pattern: str) -> Dict:
        if pattern not in RUNTIME_PATTERNS:
            return {
                "success": False,
                "error": f"Unsupported pattern: {pattern}",
                "available_patterns": RUNTIME_PATTERNS,
            }

        command = f"python3 /vismm/fbshow/big8k_runtime/render_patterns.py {self._quote(pattern)}"
        result = self._run_shell_required(command, timeout=120)
        output = f"{result.get('stdout', '')}\n{result.get('stderr', '')}".lower()
        has_error = any(token in output for token in ["error", "no such file", "not found", "cannot", "traceback"])
        if not result["success"] or has_error:
            return {
                "success": False,
                "error": result["error"],
                "pattern": pattern,
            }

        return {
            "success": True,
            "pattern": pattern,
            "stdout": result.get("stdout", ""),
        }

    def sync_runtime_patterns(self) -> Dict:
        script_candidates = [
            self.deploy_root / "fb-operate" / "big8k_runtime" / "render_patterns.py",
            self.python_root / "runtime_fbshow" / "render_patterns.py",
        ]
        script_path = next((path for path in script_candidates if path.exists()), None)
        if script_path is None:
            return {
                "success": False,
                "error": "render_patterns.py not found in repo resources",
            }

        ensure_result = self._ensure_remote_dir("/vismm/fbshow/big8k_runtime")
        if not ensure_result["success"]:
            return ensure_result

        push_result = self._push_required(script_path, "/vismm/fbshow/big8k_runtime/render_patterns.py")
        if not push_result["success"]:
            return push_result

        self._run_shell_required("chmod 755 /vismm/fbshow/big8k_runtime/render_patterns.py")
        return {
            "success": True,
            "script_path": str(script_path),
        }

    def _logic_daemon_paths(self) -> Dict[str, str]:
        return {
            "script": "/vismm/fbshow/logic_pattern_daemon.py",
            "cmd": "/dev/shm/logic_pattern_cmd",
            "applied": "/dev/shm/logic_pattern_applied",
            "stop": "/dev/shm/logic_pattern_stop",
            "pid": "/dev/shm/logic_pattern_daemon.pid",
            "ready": "/dev/shm/logic_pattern_daemon.ready",
        }

    def _ensure_logic_daemon_script(self) -> Dict:
        required_scripts = [
            self.deploy_root / "fb-operate" / "logicPictureShow.py",
            self.deploy_root / "fb-operate" / "logic_pattern_daemon.py",
        ]
        for local_script in required_scripts:
            if not local_script.exists():
                return {
                    "success": False,
                    "error": f"Missing daemon dependency: {local_script}",
                }

        ensure_result = self._ensure_remote_dir("/vismm/fbshow")
        if not ensure_result["success"]:
            return ensure_result

        for local_script in required_scripts:
            push_result = self._push_required(local_script, f"/vismm/fbshow/{local_script.name}")
            if not push_result["success"]:
                return push_result

        chmod_result = self._run_shell_required("chmod 755 /vismm/fbshow/logic_pattern_daemon.py /vismm/fbshow/logicPictureShow.py")
        if not chmod_result["success"]:
            return chmod_result

        dependency_check = self._run_shell_required("cd /vismm/fbshow && python3 - <<'PY'\nimport numpy\nfrom logicPictureShow import InteractiveSystem\nPY", timeout=60)
        if not dependency_check["success"]:
            return {
                "success": False,
                "error": dependency_check.get("stderr") or dependency_check.get("stdout") or "logic daemon dependency check failed",
            }

        return {"success": True}

    def _ensure_logic_daemon_running(self) -> Dict:
        paths = self._logic_daemon_paths()

        check_result = self._run_shell_required(
            f"if [ -f {paths['pid']} ] && kill -0 $(cat {paths['pid']}) 2>/dev/null; then echo running; else echo stopped; fi",
            timeout=30,
        )
        if not check_result["success"]:
            return check_result

        if "running" in check_result.get("stdout", ""):
            return {"success": True, "running": True}

        # Start daemon in background on device
        start_cmd = (
            "sh -c \"rm -f /dev/shm/logic_pattern_stop /dev/shm/logic_pattern_daemon.ready "
            "/dev/shm/logic_pattern_applied; "
            "nohup /usr/bin/python3 /vismm/fbshow/logic_pattern_daemon.py >/dev/shm/logic_pattern_daemon.start.log 2>&1 &\""
        )
        start_result = self._run_shell_required(start_cmd, timeout=30)
        if not start_result["success"]:
            return start_result

        # Wait for ready flag; Python imports and framebuffer initialization are slow on the board.
        wait_result = self._run_shell_required(
            f"for i in $(seq 1 100); do [ -f {paths['ready']} ] && echo ready && exit 0; sleep 0.05; done; cat /dev/shm/logic_pattern_daemon.start.log 2>/dev/null; echo not_ready; exit 1",
            timeout=30,
        )
        if not wait_result["success"]:
            return {
                "success": False,
                "error": "logic daemon start timeout",
                "stdout": wait_result.get("stdout", ""),
                "stderr": wait_result.get("stderr", ""),
            }

        return {"success": True, "running": True}

    def display_logic_pattern(self, pattern_id: int) -> Dict:
        if pattern_id < 0 or pattern_id > 39:
            return {
                "success": False,
                "error": "逻辑图案编号必须在 0-39 之间",
            }

        ensure_script = self._ensure_logic_daemon_script()
        if not ensure_script["success"]:
            return {
                "success": False,
                "error": ensure_script.get("error", "failed to prepare logic daemon script"),
                "pattern_id": pattern_id,
            }

        ensure_running = self._ensure_logic_daemon_running()
        if not ensure_running["success"]:
            return {
                "success": False,
                "error": ensure_running.get("error", "failed to start logic daemon"),
                "pattern_id": pattern_id,
            }

        paths = self._logic_daemon_paths()
        write_result = self._run_shell_required(
            f"echo {int(pattern_id)} > {paths['cmd']}",
            timeout=30,
        )
        if not write_result["success"]:
            return {
                "success": False,
                "error": write_result["error"],
                "pattern_id": pattern_id,
            }

        # Wait for ack to guarantee command was received and applied.
        ack_result = self._run_shell_required(
            f"for i in $(seq 1 500); do [ -f {paths['applied']} ] && [ \"$(cat {paths['applied']})\" = \"{int(pattern_id)}\" ] && echo ok && exit 0; sleep 0.01; done; echo timeout; exit 1",
            timeout=30,
        )
        if not ack_result["success"]:
            return {
                "success": False,
                "error": "logic pattern apply timeout",
                "pattern_id": pattern_id,
                "stdout": ack_result.get("stdout", ""),
                "stderr": ack_result.get("stderr", ""),
            }

        return {
            "success": True,
            "pattern_id": pattern_id,
            "stdout": write_result.get("stdout", ""),
        }

    def display_remote_image(self, remote_path: str) -> Dict:
        remote_path = remote_path.strip()
        if not remote_path:
            return {
                "success": False,
                "error": "Remote image path is empty",
            }

        check_result = self._run_shell_required(f"ls -la {self._quote(remote_path)}")
        if not check_result["success"]:
            return {
                "success": False,
                "error": f"Remote file not found: {remote_path}",
            }

        if remote_path.lower().endswith(".bmp"):
            result = self._run_shell_required(f"./vismm/fbshow/fbShowBmp {self._quote(remote_path)}", timeout=120)
        else:
            result = self._run_project_python(
                self.python_root / "fb_image_display.py",
                "/data/local/tmp/fb_image_display.py",
                [remote_path],
            )

        if not result["success"]:
            return {
                "success": False,
                "error": result["error"],
                "remote_path": remote_path,
            }

        return {
            "success": True,
            "remote_path": remote_path,
            "stdout": result.get("stdout", ""),
        }

    def display_local_image(self, local_path: str, remote_name: Optional[str] = None) -> Dict:
        path = Path(local_path)
        if not path.exists():
            return {
                "success": False,
                "error": f"File not found: {local_path}",
            }

        target_name = remote_name or path.name
        safe_remote_name = self._sanitize_remote_name(target_name)
        is_bmp = path.suffix.lower() == ".bmp"
        remote_path = (
            f"/vismm/fbshow/bmp_online/{safe_remote_name}"
            if is_bmp
            else f"/data/local/tmp/big8k_images/{safe_remote_name}"
        )
        remote_dir = "/vismm/fbshow/bmp_online" if is_bmp else "/data/local/tmp/big8k_images"

        ensure_result = self._ensure_remote_dir(remote_dir)
        if not ensure_result["success"]:
            return ensure_result

        push_result = self._push_required(path, remote_path)
        if not push_result["success"]:
            return push_result

        display_result = self.display_remote_image(remote_path)
        if not display_result["success"]:
            return display_result

        return {
            "success": True,
            "local_path": str(path),
            "remote_path": remote_path,
            "remote_name": safe_remote_name,
        }

    def play_video(self, video_path: str, zoom_mode: int = 0, show_framerate: int = 0) -> Dict:
        input_path = video_path.strip()
        if not input_path:
            return {
                "success": False,
                "error": "Video path is empty",
            }

        resolved = self.device.resolve_device_id()
        if not resolved["success"]:
            return {
                "success": False,
                "error": resolved.get("error", "No device selected"),
            }

        local_path = Path(input_path)
        if local_path.exists():
            file_name = local_path.name.strip()
            if not file_name:
                return {
                    "success": False,
                    "error": "Video file name is invalid",
                }
            ensure_result = self._ensure_remote_dir("/vismm/fbshow/movie_online")
            if not ensure_result["success"]:
                return {
                    "success": False,
                    "error": ensure_result["error"],
                }
            remote_video_path = f"/vismm/fbshow/movie_online/{file_name}"
            push_result = self._push_required(local_path, remote_video_path)
            if not push_result["success"]:
                return {
                    "success": False,
                    "error": push_result["error"],
                }
        else:
            remote_video_path = input_path

        nowait_result = self.device.run_nowait([
            "-s",
            resolved["device_id"],
            "shell",
            "/usr/bin/python3",
            "/vismm/fbshow/videoPlay.py",
            remote_video_path,
            str(zoom_mode),
            str(show_framerate),
        ])
        if not nowait_result["success"]:
            return {
                "success": False,
                "error": nowait_result.get("error", "Failed to start video"),
            }

        return {
            "success": True,
            "remote_video_path": remote_video_path,
            "zoom_mode": zoom_mode,
            "show_framerate": show_framerate,
        }

    def video_control(self, action: str) -> Dict:
        if action not in ["pause", "resume", "stop"]:
            return {
                "success": False,
                "error": "Invalid action. Use: pause, resume, stop",
            }

        command = {
            "pause": "echo > /dev/shm/pause_signal",
            "resume": "echo > /dev/shm/pause_signal",
            "stop": "echo > /dev/shm/stop_signal",
        }[action]
        result = self._run_shell_required(command, timeout=30)
        if not result["success"]:
            return {
                "success": False,
                "error": result["error"],
                "action": action,
            }

        return {
            "success": True,
            "action": action,
        }

    def get_video_playback_status(self) -> Dict:
        result = self._run_shell_required("if [ -f /dev/shm/is_running ]; then echo running; else echo stopped; fi", timeout=30)
        if not result["success"]:
            return {
                "success": False,
                "error": result["error"],
            }

        output = result.get("stdout", "")
        is_running = any(line.strip() == "running" for line in output.splitlines())
        return {
            "success": True,
            "is_running": is_running,
            "status": "running" if is_running else "stopped",
            "output": output,
        }

    def clear_screen(self) -> Dict:
        return self.display_runtime_pattern("black")

    def deploy_install_tools(self) -> Dict:
        dist_packages = self.deploy_root / "dist-packages"
        python_libs = self.deploy_root / "python-libs"
        if not dist_packages.exists():
            return {"success": False, "error": f"Missing directory: {dist_packages}"}
        if not python_libs.exists():
            return {"success": False, "error": f"Missing directory: {python_libs}"}

        logs: List[str] = []
        for remote_dir in [
            "/vismm",
            "/vismm/fbshow",
            "/vismm/fbshow/default",
            "/vismm/fbshow/bmp_online",
            "/vismm/tools",
            "/vismm/Python_lib",
            "/tmp/cpio",
        ]:
            result = self._ensure_remote_dir(remote_dir)
            if not result["success"]:
                return {"success": False, "error": result["error"], "logs": logs}
        logs.append("已确保关键目录存在")

        push_dist = self._push_dir_required(dist_packages, "/usr/lib/python3/dist-packages")
        if not push_dist["success"]:
            return {"success": False, "error": push_dist["error"], "logs": logs}
        logs.append("已上传 dist-packages 到 /usr/lib/python3/dist-packages")

        chmod_dist = self._run_shell_required("chmod 777 /usr/lib/python3/dist-packages")
        if not chmod_dist["success"]:
            return {"success": False, "error": chmod_dist["error"], "logs": logs}
        logs.append("已设置 /usr/lib/python3/dist-packages 权限")

        whl_files = sorted(python_libs.glob("*.whl"))
        for whl_file in whl_files:
            remote_whl = f"/vismm/Python_lib/{whl_file.name}"
            push_whl = self._push_required(whl_file, remote_whl)
            if not push_whl["success"]:
                return {"success": False, "error": push_whl["error"], "logs": logs}
            logs.append(f"已上传 whl: {whl_file.name}")

            install_whl = self._run_shell_required(f"python3 -m pip install --no-deps {self._quote(remote_whl)}", timeout=300)
            if not install_whl["success"]:
                return {"success": False, "error": install_whl["error"], "logs": logs}
            logs.append(f"已安装 whl: {whl_file.name}")

        deb_file = dist_packages / "cpio_2.13+dfsg-2ubuntu0.4_arm64.deb"
        if not deb_file.exists():
            return {"success": False, "error": f"缺少 cpio 安装包: {deb_file}", "logs": logs}

        push_deb = self._push_required(deb_file, "/tmp/cpio/cpio_2.13+dfsg-2ubuntu0.4_arm64.deb")
        if not push_deb["success"]:
            return {"success": False, "error": push_deb["error"], "logs": logs}
        logs.append("已上传 cpio 安装包")

        install_deb = self._run_shell_required("dpkg -i /tmp/cpio/cpio_2.13+dfsg-2ubuntu0.4_arm64.deb", timeout=300)
        if not install_deb["success"]:
            return {"success": False, "error": install_deb["error"], "logs": logs}
        logs.append("已执行 cpio 安装")

        verify_cpio = self._run_shell_required("dpkg -l | grep cpio", timeout=60)
        if not verify_cpio["success"]:
            return {"success": False, "error": verify_cpio["error"], "logs": logs}
        logs.append(f"验证 cpio: {verify_cpio.get('stdout', '').strip()}")

        repack_script = dist_packages / "repack_initrd.sh"
        if not repack_script.exists():
            return {"success": False, "error": f"缺少 repack_initrd.sh: {repack_script}", "logs": logs}

        push_repack = self._push_required(repack_script, "/vismm/tools/repack_initrd.sh")
        if not push_repack["success"]:
            return {"success": False, "error": push_repack["error"], "logs": logs}
        logs.append("已上传 repack_initrd.sh 到 /vismm/tools")

        chmod_repack = self._run_shell_required("chmod +x /vismm/tools/repack_initrd.sh")
        if not chmod_repack["success"]:
            return {"success": False, "error": chmod_repack["error"], "logs": logs}
        logs.append("已设置 /vismm/tools/repack_initrd.sh 可执行权限")

        return {
            "success": True,
            "logs": logs,
        }

    def _deploy_autorun_bundle(self, bundle_name: str, logs: List[str]) -> Dict:
        bundle_dir = self.deploy_root / "fb-RunApp" / bundle_name
        if not bundle_dir.exists():
            return {"success": False, "error": f"Missing bundle directory: {bundle_dir}"}

        autorun = bundle_dir / "autorun.py"
        if not autorun.exists():
            return {"success": False, "error": f"缺少 autorun.py: {autorun}"}

        service_dir = self.deploy_root / "fb-RunApp" / "default"
        service_candidates = [
            service_dir / "big8k-autorun.service",
            service_dir / "chenfeng-service.service",
        ]
        service_file = next((path for path in service_candidates if path.exists()), None)
        if service_file is None:
            return {"success": False, "error": "缺少 autorun service 文件"}

        self._run_shell_required("rm -f /vismm/autorun.py")
        logs.append("已删除旧 autorun.py")

        push_fbshow = self._push_required(autorun, "/vismm/fbshow/autorun.py")
        if not push_fbshow["success"]:
            return {"success": False, "error": push_fbshow["error"]}
        self._run_shell_required("chmod 444 /vismm/fbshow/autorun.py")
        logs.append("已推送 autorun.py -> /vismm/fbshow/autorun.py")

        push_root = self._push_required(autorun, "/vismm/autorun.py")
        if not push_root["success"]:
            return {"success": False, "error": push_root["error"]}
        self._run_shell_required("chmod 444 /vismm/autorun.py")
        logs.append("已推送 autorun.py -> /vismm/autorun.py")

        remote_service = f"/etc/systemd/system/{service_file.name}"
        push_service = self._push_required(service_file, remote_service)
        if not push_service["success"]:
            return {"success": False, "error": push_service["error"]}
        logs.append(f"已推送 {service_file.name} -> {remote_service}")

        for command in [
            "systemctl daemon-reload",
            f"systemctl enable {service_file.name}",
            f"systemctl restart {service_file.name}",
        ]:
            result = self._run_shell_required(command, timeout=120)
            if not result["success"]:
                return {"success": False, "error": result["error"]}
            if result.get("stdout", "").strip():
                logs.append(result["stdout"].strip())

        logs.append(f"autorun 部署完成 ({service_file.name})")
        return {"success": True}

    def deploy_install_app(self) -> Dict:
        fb_operate = self.deploy_root / "fb-operate"
        if not fb_operate.exists():
            return {"success": False, "error": f"Missing directory: {fb_operate}"}

        logs: List[str] = []
        mkdir_result = self._run_shell_required("mkdir -p /vismm/fbshow/movie_online && mkdir -p /vismm/fbshow/bmp_online")
        if not mkdir_result["success"]:
            return {"success": False, "error": mkdir_result["error"], "logs": logs}
        logs.append("创建目录: /vismm/fbshow/movie_online, /vismm/fbshow/bmp_online")

        push_files = [
            ("vismpwr", "/usr/local/bin/vismpwr"),
            ("disableService.sh", "/vismm/disableService.sh"),
            ("repack_initrd.sh", "/usr/local/bin/repack_initrd.sh"),
            ("fbShowBmp", "/vismm/fbshow/fbShowBmp"),
            ("fbShowPattern", "/vismm/fbshow/fbShowPattern"),
            ("fbShowMovie", "/vismm/fbshow/fbShowMovie"),
            ("xdotool", "/usr/bin/xdotool"),
        ]
        for file_name, remote_path in push_files:
            local_path = fb_operate / file_name
            if not local_path.exists():
                logs.append(f"跳过不存在的文件: {file_name}")
                continue
            result = self._push_required(local_path, remote_path)
            if result["success"]:
                logs.append(f"推送 {file_name} -> {remote_path}")
            else:
                logs.append(f"推送 {file_name} 失败: {result['error']}")

        for script_path in sorted(fb_operate.glob("*.py")):
            remote_path = f"/vismm/fbshow/{script_path.name}"
            result = self._push_required(script_path, remote_path)
            if result["success"]:
                logs.append(f"推送 {script_path.name} -> /vismm/fbshow/")
            else:
                logs.append(f"推送 {script_path.name} 失败: {result['error']}")

        chmod_commands = [
            "chmod +x /usr/local/bin/vismpwr",
            "chmod +x /vismm/disableService.sh",
            "chmod +x /usr/local/bin/repack_initrd.sh",
            "chmod 777 /vismm/fbshow/fbShowBmp",
            "chmod 777 /vismm/fbshow/fbShowPattern",
            "chmod 777 /vismm/fbshow/fbShowMovie",
            "chmod 777 /usr/bin/xdotool",
        ]
        for command in chmod_commands:
            result = self._run_shell_required(command)
            logs.append(f"权限设置{'成功' if result['success'] else '失败'}: {command}")

        disable_service = self._run_shell_required("/vismm/disableService.sh", timeout=120)
        logs.append("执行 disableService.sh 完成" if disable_service["success"] else "执行 disableService.sh 失败")

        for command in [
            "systemctl enable disable-cursor-blink.service",
            "systemctl start disable-cursor-blink.service",
        ]:
            result = self._run_shell_required(command, timeout=120)
            logs.append(f"执行{'成功' if result['success'] else '失败'}: {command}")

        autorun_result = self._deploy_autorun_bundle("default", logs)
        if not autorun_result["success"]:
            return {"success": False, "error": autorun_result["error"], "logs": logs}

        logs.append("Install App 完成")
        return {
            "success": True,
            "logs": logs,
        }
