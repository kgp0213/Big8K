import cv2
import os
import time
import mmap
import sys
import subprocess
import numpy as np
import fcntl
import struct

##配置区--
manual=0       #手/自动模式
bmp_total=3    #图片总数
movie_total=2  #视频总数

bmp_index=1
movie_index=1

Forward = "01"
Backward = "02"
Right = "03"
Left = "04"


def bmpShowinList(pic_num):
    bmp_list = {
        1: "/vismm/fbshow/1260x2720/1.bmp",
        2: "/vismm/fbshow/1260x2720/2.bmp",
        3: "/vismm/fbshow/1260x2720/3.bmp",
    }
    bmp_file = bmp_list.get(pic_num)
    result = subprocess.run(f"./vismm/fbshow/fbShowBmp \"{bmp_file}\"", shell=True, capture_output=True, text=True)
    
    
def movieShowinList(film_num):
    film_list = { 
        1: "/vismm/fbshow/movie_online/1.mp4",
        2: "/vismm/fbshow/movie_online/2.mp4",        
    }
    film_name = film_list.get(film_num)
    return film_name
    #result = subprocess.run(f"shell ./vismm/fbshow/fbShowMovie \vismm\fbshow\movie_online\{film_name}", shell=True, capture_output=True, text=True)    
    
##配置区-END    

def getKeyValue():
    try:
        result = subprocess.run("cat /proc/chenfeng_adckey/chenfeng_adckey", shell=True, capture_output=True, text=True)
        return result.stdout.strip().replace(" ", "")
    except subprocess.SubprocessError as e:
        print("Subprocess error:", str(e))
        return ""


def movie_Show(my_path):
    # 查看 /sys/class/graphics/fb0/modes 获取可用模式
    fb0_path = '/sys/class/graphics/fb0/virtual_size'
    resolution = subprocess.run(['cat', fb0_path], stdout=subprocess.PIPE, text=True)
    horizontal, vertical = resolution.stdout.split(',')
    # 获取并打印分辨率
    print(resolution.stdout)

    # 获取参数
    print(f"movieppp路径: {my_path}")
    argument = my_path 
    #"/vismm/fbshow/movie_online/movie3.mp4"  #sys.argv[1]
    #argument = "/vismm/fbshow/movie_online/1.mp4"  #sys.argv[1]
    fps = "60"  
    # 打印参数
    print(f"movie路径: {argument}")
    # 创建一个VideoCapture对象，参数是视频文件的路径
    cap = cv2.VideoCapture(argument)

    # 获取视频的宽度和高度
    frame_width = int(cap.get(3))
    frame_height = int(cap.get(4))

    # 设置视频帧率
    desired_fps = int(fps)
    cap.set(cv2.CAP_PROP_FPS, desired_fps)
     
    # 检查帧率是否设置成功
    actual_fps = cap.get(cv2.CAP_PROP_FPS)
    print(f"Desired FPS: {desired_fps}, Actual FPS: {actual_fps}")
   
    # 检查视频是否成功打开
    if not cap.isOpened():
        print("Error: Could not open video.")
        exit()
        
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0) 
    # 循环播放视频帧
    coun=0
    
    while True:
        coun=coun+1
        if coun==60:
            keyValue = getKeyValue()
            if keyValue == Forward:                             
                cap.release()
                cv2.destroyAllWindows()
                return 0
            elif keyValue == Backward:
                cap.release()
                cv2.destroyAllWindows()
                return 0
            elif keyValue == Right:  
                cap.release()
                cv2.destroyAllWindows()
                return 0
            elif keyValue == Left:  
                cap.release()
                cv2.destroyAllWindows()
                return 0            
            coun=0
        ret, frame = cap.read()
        if not ret:
            # 如果读取失败，表示已经到了视频的末尾
            # 重置视频帧位置到第一帧
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue
            
        # 拉伸视频帧
        frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
        frame = cv2.resize(frame, (int(horizontal), int(vertical)), interpolation=cv2.INTER_AREA)        
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2BGRA)

        with open('/dev/fb0', 'wb') as fb:
            fb.write(image.tobytes())
            

    # 释放视频对象和销毁所有窗口
    cap.release()
    cv2.destroyAllWindows()
    

def updateIndex(current_index, step, max_index):
    new_index = current_index + step
    if new_index > max_index:
        new_index = 1
    elif new_index < 1:
        new_index = max_index
    return new_index
    

def update_movie_Index(current_index, step, max_index):
    new_index = current_index + step
    if new_index > max_index:
        new_index = 1
    elif new_index < 1:
        new_index = max_index
    return new_index
    
        
def main_master():
    try:
        delay=3  
        time.sleep(0.5)    
        global bmp_total
        global bmp_index	
        global manual
		
        #bmp_total=3
        #bmp_index=1
        #manual=0
        
        while True:
                 
            bmpShowinList(bmp_index)            
            if manual==0:
                bmp_index=updateIndex(bmp_index,1,bmp_total)
                Delay_bmp(delay)                      
            else:
                Delay_bmp(0.01)  
                
     
    except Exception as e:
        print("err：", str(e))
        
def Delay_bmp(time_set):
    global bmp_total
    global bmp_index
    global manual
    global movie_index
    global movie_total
    count=0
    result = subprocess.run("echo 01 01 > /proc/chenfeng_gpio/gpio3c3", shell=True, capture_output=True, text=True)
    time.sleep(0.1)
    result = subprocess.run("echo 01 00 > /proc/chenfeng_gpio/gpio3c3", shell=True, capture_output=True, text=True)    
    for i in range(100):
        k=float(time_set/100);
        keyValue = getKeyValue() #每秒钟检测10次
        if keyValue == Forward:
            print("key[v-]", keyValue)
            while keyValue==Forward:
                keyValue = getKeyValue()
                time.sleep(0.01)
                count+=1
                if count>50:
                    manual=0
                    while keyValue==Forward:
                        keyValue = getKeyValue()
                    return 0
            bmp_index=updateIndex(bmp_index,1,bmp_total)
            manual=1
            return 0
        elif keyValue == Backward:
            print("key[v+]", keyValue)
            while keyValue==Backward:
                keyValue = getKeyValue()
                time.sleep(0.01)
                count+=1
                if count>50:
                    manual=0
                    while keyValue==Backward:
                        keyValue = getKeyValue()
                    return 0
            bmp_index=updateIndex(bmp_index,-1,bmp_total)  
            manual=1
            return 0
        elif keyValue == Right:
            print("key[ESC]", keyValue)
            while keyValue==Right:
                keyValue = getKeyValue()
                time.sleep(0.01)
                if count>50:
                    manual=0
                    while keyValue==Right:
                        keyValue = getKeyValue()
                    return 0
            movie_index=update_movie_Index(movie_index,1,movie_total) 
            movie_path=movieShowinList(movie_index) 
            print("Movie path:", movie_path)
            movie_Show(movie_path)
            manual=1
            return 0
        elif keyValue == Left:
            print("key[MENU]", keyValue)
            while keyValue==Left:
                keyValue = getKeyValue()
                time.sleep(0.01)
                if count>50:
                    manual=1
                    while keyValue==Left:
                        keyValue = getKeyValue()
                    return 0
            movie_index=update_movie_Index(movie_index,-1,movie_total) 
            movie_path=movieShowinList(movie_index)           
            movie_Show(movie_path)
            manual=1
            return 0            
        time.sleep(k)        
        
        
# 使用示例  
if __name__ == "__main__": 

  
    #####主机使用函数，正常送图并发送同步信号。
    main_master()