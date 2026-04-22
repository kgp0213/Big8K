#!/bin/sh
# MIPI mode: try DRM sysfs mode_flags first, fall back to dmesg
MF=$(grep -rFl 'mode_flags' /sys/class/drm/ 2>/dev/null | head -n 1 | xargs cat 2>/dev/null | grep -oE '0x[0-9a-fA-F]+' | head -n 1)
MF=${MF:-0x0}
FV=$(printf '%d' "${MF}" 2>/dev/null || printf '0')
if [ $((FV & 1)) -gt 0 ]; then
    MIPI_MODE=VIDEO
else
    DMESG_MODE=$(dmesg 2>/dev/null | grep -iE 'video mode|Initialized in CMD mode' | tail -n 1)
    if echo "$DMESG_MODE" | grep -qi video; then
        MIPI_MODE=VIDEO
    else
        MIPI_MODE=CMD
    fi
fi
MODEL=$(getprop ro.product.model 2>/dev/null)
PANEL_NAME=""
for CAND in /vismm/vis-timing.bin /lib/firmware/vis-timing.bin /usr/lib/firmware/vis-timing.bin; do
    if [ -f "$CAND" ]; then
        PANEL_NAME=$(dd if="$CAND" bs=1 skip=20 count=16 2>/dev/null | tr -d '\000' | tr -d '\r' | tr -d '\n')
        [ -n "$PANEL_NAME" ] && break
    fi
done
VSIZE=$(cat /sys/class/graphics/fb0/virtual_size 2>/dev/null)
BPP=$(cat /sys/class/graphics/fb0/bits_per_pixel 2>/dev/null)
LANES=$(dmesg 2>/dev/null | grep -o 'dsi,lanes: [0-9]*' | tail -n 1 | sed 's/dsi,lanes: //')
[ -e /dev/fb0 ] && FB0=1 || FB0=0
command -v vismpwr >/dev/null 2>&1 && VISMPWR=1 || VISMPWR=0
command -v python3 >/dev/null 2>&1 && PYTHON3=1 || PYTHON3=0
CPU=$(awk '/cpu / {usage=($2+$4)*100/($2+$4+$5)} END {printf("%.1f%%", usage)}' /proc/stat 2>/dev/null)
MEM=$(awk '/MemTotal/ {t=$2} /MemAvailable/ {a=$2} END {if (t>0) printf("%.1f%% (%dMB / %dMB)", (t-a)*100/t, (t-a)/1024, t/1024)}' /proc/meminfo 2>/dev/null)
TEMP=$(awk '{printf("%.1f", $1/1000)}' /sys/class/thermal/thermal_zone0/temp 2>/dev/null)
echo MIPI_MODE=$MIPI_MODE
echo MODEL=$MODEL
echo PANEL_NAME=$PANEL_NAME
echo VSIZE=$VSIZE
echo BPP=$BPP
echo LANES=$LANES
echo FB0=$FB0
echo VISMPWR=$VISMPWR
echo PYTHON3=$PYTHON3
echo CPU=$CPU
echo MEM=$MEM
echo TEMP=$TEMP
