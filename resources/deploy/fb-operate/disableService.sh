#!/bin/bash
# 服务优化脚本
# 功能：禁用非必要系统服务以加速启动
# 警告：修改前请确认了解每个服务的作用

echo "========================================"
echo "  系统服务优化脚本"
echo "========================================"
echo "正在禁用服务..."

# 禁用服务函数（带状态检查）
disable_service() {
    echo -n "禁用 $1 ... "
    if sudo systemctl disable $1 >/dev/null 2>&1; then
        echo "[完成]"
    else
        echo "[失败或服务不存在]"
    fi
}

# ===== 自动更新相关 =====
disable_service unattended-upgrades.service  # 自动安全更新
disable_service ua-reboot-cmds.service       # Ubuntu Advantage重启命令
disable_service apt-daily.service            # 每日APT更新检查
disable_service apt-daily-upgrade.service    # 每日APT升级检查
disable_service apt-daily.timer              # APT每日检查定时器
disable_service apt-daily-upgrade.timer      # APT每日升级定时器

# ===== 硬件相关服务 =====
disable_service bluetooth.service            # 蓝牙服务(无蓝牙设备时)
disable_service ModemManager.service         # 蜂窝网络调制解调器服务
disable_service switcheroo-control.service   # 双显卡切换服务(笔记本专用)

# ===== 外设服务 =====
disable_service triggerhappy.service         # 全局热键服务
disable_service cups.service                 # CUPS打印服务
disable_service cups-browsed.service         # CUPS打印机浏览服务

# ===== 账户与登录服务 =====
disable_service accounts-daemon.service      # 用户账户管理服务

# ===== Snap相关服务 =====
disable_service snapd.service                # Snap核心服务
disable_service snapd.apparmor.service       # Snap AppArmor服务
disable_service snapd.autoimport.service     # Snap自动导入服务
disable_service snapd.core-fixup.service     # Snap核心修复服务
disable_service snapd.recovery-chooser-trigger.service  # Snap恢复选择器
disable_service snapd.seeded.service         # Snap种子服务
disable_service snapd.system-shutdown.service # Snap系统关机服务

# ===== 固件更新服务 =====
disable_service fwupd.service                # 固件更新服务
disable_service fwupd-refresh.service        # 固件更新检查服务

# ===== 显示相关服务 =====
disable_service bootanim.service             # 启动动画服务(OLED无需动画)
disable_service setvtrgb.service             # 虚拟终端颜色设置服务(OLED无需)
disable_service colord.service               # 色彩管理服务(OLED无需精确色彩)

# ===== 其他可选服务 =====
#disable_service vsftpd.service               # FTP服务(不需要时可禁用)
#disable_service upower.service               # 高级电源管理服务
#disable_service gdm.service                 # GNOME显示管理器(使用XFCE时)

echo "========================================"
echo "服务禁用完成！"
echo "建议执行以下操作："
echo "1. 重启系统: sudo reboot"
echo "2. 检查启动时间: systemd-analyze"
echo "3. 查看服务状态: systemctl list-units --type=service"
echo "========================================"

# 显示当前启动时间
echo -e "\n当前启动时间分析："
systemd-analyze | grep "Startup finished"

exit 0