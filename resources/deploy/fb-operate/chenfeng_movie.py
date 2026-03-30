import cv2
import os
import time
import mmap
import sys
import subprocess
import numpy as np
import fcntl
import struct

# 查看 /sys/class/graphics/fb0/modes 获取可用模式
fb0_path = '/sys/class/graphics/fb0/virtual_size'
resolution = subprocess.run(['cat', fb0_path], stdout=subprocess.PIPE, text=True)
horizontal, vertical = resolution.stdout.split(',')

# 获取并打印分辨率
print(resolution.stdout)


# 检查参数个数
if len(sys.argv) < 2:
    print("请提供一个参数。")
    sys.exit(1)
 
# 获取参数
argument = sys.argv[1]
fb_rotate=1
#fb_rotate = sys.argv[2]  
#fb_delete = sys.argv[3]
 
# 打印参数
print(f"movie路径: {argument}")

# 创建一个VideoCapture对象，参数是视频文件的路径
cap = cv2.VideoCapture(argument)


# 获取视频的宽度和高度
frame_width = int(cap.get(3))
frame_height = int(cap.get(4))

# 设置视频帧率
#desired_fps = int(60)
cap.set(cv2.CAP_PROP_FPS, 30)
 
# 检查帧率是否设置成功
actual_fps = cap.get(cv2.CAP_PROP_FPS)
print(f"Desired FPS:, Actual FPS: {actual_fps}")

 
# 检查视频是否成功打开
if not cap.isOpened():
    print("Error: Could not open video.")
    exit()
    
cap.set(cv2.CAP_PROP_POS_FRAMES, 0) 
#open('/dev/fb0', 'wb') as fb

idx = 0
freq = 2
# 循环播放视频帧
if int(fb_rotate)==1:
    while True:
        idx += 1
        ret = cap.grab()            
        if idx % freq == 1:
            ret, frame0 = cap.retrieve() 
        if not ret:
            idx=0
            # 如果读取失败，表示已经到了视频的末尾
            # 重置视频帧位置到第一帧
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue  
        # 拉伸视频帧
        frame = cv2.resize(frame0, (int(horizontal), int(vertical)), interpolation=cv2.INTER_AREA)        
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2BGRA)
        with open('/dev/fb0', 'wb') as fb:
        #fb = open('/dev/fb0', 'wb')
            fb.write(image.tobytes())
        
            
elif int(fb_rotate)==0: 
    while True:
        idx += 1
        ret = cap.grab()            
        if idx % freq == 1:
            ret, frame0 = cap.retrieve() 
        if not ret:
            idx=0
            # 如果读取失败，表示已经到了视频的末尾
            # 重置视频帧位置到第一帧
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue
        frame = cv2.rotate(frame0, cv2.ROTATE_90_CLOCKWISE)     
        # 拉伸视频帧
        frame = cv2.resize(frame, (int(horizontal), int(vertical)), interpolation=cv2.INTER_AREA)        
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2BGRA)
        with open('/dev/fb0', 'wb') as fb:
            fb.write(image.tobytes()) 
                    
elif int(fb_rotate)==2: 
    while True:
        idx += 1
        ret = cap.grab()            
        if idx % freq == 1:
            ret, frame0 = cap.retrieve() 
        if not ret:
            idx=0
            # 如果读取失败，表示已经到了视频的末尾
            # 重置视频帧位置到第一帧
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue 
        # 垂直翻转帧，旋转180度
        frame = cv2.flip(frame0, 0)    
        # 拉伸视频帧
        frame = cv2.resize(frame, (int(horizontal), int(vertical)), interpolation=cv2.INTER_AREA)        
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2BGRA)
        with open('/dev/fb0', 'wb') as fb:
            fb.write(image.tobytes()) 
            
# 释放视频对象和销毁所有窗口
cap.release()
cv2.destroyAllWindows()

