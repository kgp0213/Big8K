#!/bin/bash

# 定义路径变量
INITRD_ORIG="/boot/initrd-5.10"
INITRD_BAK="/boot/initrd-5.10.bak"
INITRD_NEW="/boot/initrd-5.10.new"
FIRMWARE_MARKER="/boot/firmware_init"
REPACK_DIR="/boot/uimage_repack"
FIRMWARE_SRC="/vismm/vis-timing.bin"
FIRMWARE_DEST="$REPACK_DIR/initramfs/lib/firmware/vis-timing.bin"
LOG_FILE="/tmp/repack.log"

# 错误处理函数（只处理关键错误）
critical_fail() {
    echo "关键错误: $1" | tee -a "$LOG_FILE"
    echo "为避免损坏系统，已停止执行" | tee -a "$LOG_FILE"
    
    # 删除可能生成的不完整新文件（保留原始文件）
    [[ -f "$INITRD_NEW" ]] && sudo rm -f "$INITRD_NEW"
    
    # 如果是首次运行，清理标记文件
    if [[ -f "$FIRMWARE_MARKER" ]] && [[ ! -f "$INITRD_BAK" ]]; then
        sudo rm -f "$FIRMWARE_MARKER"
    fi
    
    exit 1
}

# 初始化日志
exec > >(tee -a "$LOG_FILE") 2>&1
echo "===== Script started at $(date) ====="

# 检查是否是首次运行
if [[ ! -f "$FIRMWARE_MARKER" ]]; then
    echo "首次运行脚本，创建标记文件并备份原initrd"
    sudo touch "$FIRMWARE_MARKER" 2>/dev/null
    
    # 关键保护：备份原initrd
    if [[ ! -f "$INITRD_ORIG" ]]; then
        critical_fail "原initrd文件 $INITRD_ORIG 不存在"
    fi
    
    if ! sudo cp "$INITRD_ORIG" "$INITRD_BAK"; then
        critical_fail "无法备份原initrd到 $INITRD_BAK"
    fi
    echo "已备份原initrd: $INITRD_BAK"

    # 首次运行需要完整解包流程
    echo "执行首次解包流程..."
    
    # 准备解包目录
    sudo mkdir -p "$REPACK_DIR" 2>/dev/null
    cd "$REPACK_DIR" || critical_fail "无法进入工作目录 $REPACK_DIR"

    # 关键步骤1：解包initrd
    if ! sudo dumpimage -T ramdisk -p 0 -o old_initrd.gz "$INITRD_ORIG"; then
        critical_fail "解包initrd失败！Error 44 : Unrecognized header"
    fi

    # 检查解包文件是否有效
    if [[ $(stat -c%s "old_initrd.gz") -lt 7071017 ]]; then
        critical_fail "解包后的文件过小，可能解包失败"
    fi

    # 关键步骤2：解压initramfs
    mkdir -p initramfs
    cd initramfs || critical_fail "无法进入initramfs目录"
    if ! sudo zcat ../old_initrd.gz | sudo cpio -idmv >/dev/null 2>&1; then
        critical_fail "解压initramfs内容失败"
    fi
    sudo mkdir -p lib/firmware
    echo "首次解包完成，initramfs内容已保存至: $REPACK_DIR/initramfs"
else
    echo "检测到非首次运行，跳过备份和解包步骤"
    cd "$REPACK_DIR/initramfs" || critical_fail "无法进入initramfs目录"    
fi

# 关键检查：源固件文件
if [[ ! -f "$FIRMWARE_SRC" ]]; then
    critical_fail "必须的固件文件 $FIRMWARE_SRC 不存在"
fi

# 更新/添加固件文件
echo "更新固件文件..."
if ! sudo cp "$FIRMWARE_SRC" "$FIRMWARE_DEST"; then
    critical_fail "无法复制固件文件到 $FIRMWARE_DEST"
fi
sudo chmod 644 "$FIRMWARE_DEST" 2>/dev/null
echo "已更新固件: $FIRMWARE_DEST"

# 关键步骤3：重新打包
echo "开始重新打包initramfs (使用lz4压缩)..."
if ! find . | cpio -o -H newc | gzip > ../new_initrd.gz; then
    critical_fail "打包initramfs失败"
fi

# 关键步骤4：生成U-Boot镜像
cd ..
if ! mkimage -A arm -O linux -T ramdisk -C gzip -d new_initrd.gz "$INITRD_NEW"  -a 0x00000000 -e 0x00000000; then
    critical_fail "生成U-Boot镜像失败"
fi

# 最终验证：检查新镜像是否有效
if [[ $(stat -c%s "$INITRD_NEW") -lt 7071177 ]]; then
    critical_fail "生成的新initrd文件过小（小于原始文件大小+96byte），可能无效"
fi

# 关键步骤5：安全替换原文件
if ! sudo mv "$INITRD_NEW" "$INITRD_ORIG"; then
    critical_fail "替换原initrd文件失败"
fi
echo "新initrd已成功生成并替换原文件"

echo "===== 脚本执行完成，准备重启 ====="
sync
# sudo reboot