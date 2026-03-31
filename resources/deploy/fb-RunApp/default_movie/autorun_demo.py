import cv2
import os
import time
import mmap
import sys
import subprocess
import numpy as np
import fcntl
import struct
import re

##配置区--
folder_path='chenfeng_path@@@'
movie_path='/vismm/fbshow/movie_online'

manual=0       #手/自动模式
movie_total=3  #视频总数
local_movies=[]

bmp_index=0
movie_index=0

cmos_total=2  #cmos显示种类
cmos_index=1

Forward = "01"
Backward = "02"
Right = "03"
Left = "04"

horizontal="1080"
vertical="1920"

image_total=5     #图片总数
local_images=[]

def extract_number(s):
    # 使用正则表达式查找字符串中的数字
    numbers = re.findall(r'\d+', s)
    # 如果找到数字，返回第一个数字的整数值，否则返回0（或者你可以根据需要返回其他值）
    return int(numbers[0]) if numbers else 0

def list_images(folder):
    global local_images
    # 定义图片的扩展名列表
    image_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp']
    local_images = []
    local_num = []
    flag = True
    # 遍历文件夹
    for filename in os.listdir(folder):
        if any(filename.lower().endswith(ext) for ext in image_extensions):
            local_images.append(os.path.join(folder, filename))
            # 使用正则表达式提取全部数字
            numbers = re.findall(r'\d+', filename)
            # 将提取的数字列表转换成字符串
            numbers_str = ''.join(numbers)
            local_num.append(numbers_str)
            if numbers_str=='':
                flag=False
    if flag==True:
        # 使用列表推导式将每个元素转换为int
        int_list = [int(x) for x in local_num]
        local_num,local_images=bubble_sort_optimized(int_list,local_images)

    return local_images
    
    
def bubble_sort_optimized(arr,str):
    n = len(arr)
    for i in range(n):
        swapped = False
        for j in range(n-i-1):
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
                str[j], str[j+1] = str[j+1], str[j]
                swapped = True
        if not swapped:
            break
    return arr,str    
    
    
def list_movie(folder):
    global local_movies
    # 定义图片的扩展名列表
    image_extensions = ['.mp4', '.avi']
    local_movies = []

    # 遍历文件夹
    for filename in os.listdir(folder):
        if any(filename.lower().endswith(ext) for ext in image_extensions):
            local_movies.append(os.path.join(folder, filename))
            
    #sorted_list = sorted(local_movies, key=lambda x: int(re.search(r'\d+', x).group()))        
    return local_movies    
    
    

def bmpShowinList(pic_num):
    global horizontal, vertical
    bmp_file = local_images[pic_num]
    frame = cv2.imread(f"{bmp_file}")
    #width = frame.shape[1]
    #height = frame.shape[0]
    
    frame0 = cv2.resize(frame, (int(horizontal), int(vertical)), interpolation=cv2.INTER_LINEAR)
    #frame = cv2.resize(frame, 2652, 1392, interpolation=cv2.INTER_AREA) 
    #frame = cv2.rotate(frame, cv2.ROTATE_180)
    image = cv2.cvtColor(frame0, cv2.COLOR_BGR2BGRA)
    with open('/dev/fb0', 'wb') as fb:
        fb.write(image.tobytes())    
    #result = subprocess.run(f"./vismm/fbshow/fbShowBmp \"{bmp_file}\"", shell=True, capture_output=True, text=True)
    
    
def movieShowinList(film_num):

    film_name = local_movies[film_num]
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
		
		
def cmos_Show(mode):
    # 查看 /sys/class/graphics/fb0/modes 获取可用模式
    fb0_path = '/sys/class/graphics/fb0/virtual_size'
    resolution = subprocess.run(['cat', fb0_path], stdout=subprocess.PIPE, text=True)
    horizontal, vertical = resolution.stdout.split(',')
    # 获取并打印分辨率
    print(resolution.stdout)
    # 初始化摄像头
    cap = cv2.VideoCapture('/dev/video0')
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc('M', 'J', 'P', 'G'))   

    #cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280) # 设置宽为1920
    #cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 800) # 设置高为1080    
    
     # 设置帧率（每秒帧数）
    cap.set(cv2.CAP_PROP_FPS, 30)
    
    if not cap.isOpened():
        print("无法打开摄像头")
        exit()
    # 加载预训练的人脸检测模型
    #face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    coun=0 
    
    while True:
        coun=coun+1
        if coun==100:
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
    
        # 读取一帧
        ret, frame = cap.read()

        # 如果正确读取帧，ret为True
        if not ret:
            print("无法读取视频帧")
            break

        frame = cv2.resize(frame, (int(horizontal), int(vertical)), interpolation=cv2.INTER_AREA)            
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2BGRA)       
        
        with open('/dev/fb0', 'wb') as fb:
            fb.write(image.tobytes())
            
    # 释放摄像头资源并关闭所有窗口
    cap.release()
    cv2.destroyAllWindows()

def movie_cmos_Show(my_path):

    global movie_index,movie_total

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
    
            # 初始化摄像头
    cap_camera = cv2.VideoCapture('/dev/video0')
    cap_camera.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc('M', 'J', 'P', 'G'))    
    
    if not cap_camera.isOpened():
        print("无法打开摄像头")
        exit()
       
    
    while True:
        coun=coun+1
        if coun==100:
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
            
                # 读取一帧
        ret_camera, frame_camera = cap_camera.read()

        # 如果正确读取帧，ret为True
        if not ret_camera:
            print("无法读取视频帧")
            break    
                # 转换为灰度图像，以便于检测 
        frame_camera = cv2.resize(frame_camera, (480, 270), interpolation=cv2.INTER_AREA)        
            
        ret, frame = cap.read()
        if not ret:
            # 如果读取失败，表示已经到了视频的末尾
            # 重置视频帧位置到第一帧      
            movie_index=update_movie_Index(movie_index,1,movie_total) 
            movie_path=movieShowinList(movie_index) 
             # 创建一个VideoCapture对象，参数是视频文件的路径
            cap = cv2.VideoCapture(movie_path)

            # 获取视频的宽度和高度
            frame_width = int(cap.get(3))
            frame_height = int(cap.get(4))

            # 设置视频帧率
            desired_fps = int(fps)
            cap.set(cv2.CAP_PROP_FPS, desired_fps)
             
            # 检查帧率是否设置成功
            actual_fps = cap.get(cv2.CAP_PROP_FPS)
            print(f"Desired FPS: {desired_fps}, Actual FPS: {actual_fps}")
                 
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue
            
        # 拉伸视频帧
        #frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
        frame = cv2.resize(frame, (int(horizontal), int(vertical)), interpolation=cv2.INTER_AREA)
        frame[50:270+50, 50:480+50] = frame_camera[:,:]    
        
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2BGRA) 
        # 将小图像叠加到大图像上（不考虑透明度)
        #image[1:200, 1:320] = image_camera  # 注意：这将覆盖大图上的像素，不考虑透明度
        
        with open('/dev/fb0', 'wb') as fb:
            fb.write(image.tobytes())
            

    # 释放视频对象和销毁所有窗口
    cap.release()
    cv2.destroyAllWindows()
			


def movie_Show(my_path):

    global movie_index,movie_total
    global horizontal, vertical

    # 获取参数
    print(f"movieppp路径: {my_path}")
    argument = my_path 
    #"/vismm/fbshow/movie_online/movie3.mp4"  #sys.argv[1]
    #argument = "/vismm/fbshow/movie_online/1.mp4"  #sys.argv[1]
    fps = "30"  
    # 打印参数
    print(f"movie路径: {argument}")
    # 创建一个VideoCapture对象，参数是视频文件的路径
    cap = cv2.VideoCapture(argument)

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
    idx = 0
    freq = 2
    
    while True:
        coun=coun+1
        if coun==100:
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
        #ret, frame = cap.read()  
        
        idx += 1
        ret = cap.grab()            
        if idx % freq == 1:
            ret, frame = cap.retrieve() 
            #frame = cv2.rotate(frame, cv2.ROTATE_180)
            
        if not ret:
            idx = 0
            # 如果读取失败，表示已经到了视频的末尾
            # 重置视频帧位置到第一帧      
            movie_index=update_movie_Index(movie_index,1,movie_total) 
            movie_path=movieShowinList(movie_index) 
             # 创建一个VideoCapture对象，参数是视频文件的路径
            cap = cv2.VideoCapture(movie_path)

            # 设置视频帧率
            desired_fps = int(fps)
            cap.set(cv2.CAP_PROP_FPS, desired_fps)
             
            # 检查帧率是否设置成功
            actual_fps = cap.get(cv2.CAP_PROP_FPS)
            print(f"Desired FPS: {desired_fps}, Actual FPS: {actual_fps}")
                 
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue
        
        # 拉伸视频帧
        
        frame = cv2.resize(frame, (int(horizontal), int(vertical)), interpolation=cv2.INTER_AREA)        
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2BGRA)

        with open('/dev/fb0', 'wb') as fb:
            fb.write(image.tobytes())
            

    # 释放视频对象和销毁所有窗口
    cap.release()
    cv2.destroyAllWindows()
    

def updateIndex(current_index, step, max_index):
    new_index = current_index + step
    if new_index > max_index-1:
        new_index = 0
    elif new_index < 0:
        new_index = max_index-1
    return new_index
    

def update_movie_Index(current_index, step, max_index):
    new_index = current_index + step
    if new_index > max_index-1:
        new_index = 0
    elif new_index < 0:
        new_index = max_index-1
    return new_index


def update_cmos_Index(current_index, step, max_index):
    new_index = current_index + step
    if new_index > max_index-1:
        new_index = 0
    elif new_index < 0:
        new_index = max_index-1
    return new_index
    
        
def main_master():
    try:
        delay=3 
        time.sleep(0.5)    
        global bmp_index	
        global manual
        global image_total,movie_total
        global horizontal, vertical
        
        # 查看 /sys/class/graphics/fb0/modes 获取可用模式
        fb0_path = '/sys/class/graphics/fb0/virtual_size'
        resolution = subprocess.run(['cat', fb0_path], stdout=subprocess.PIPE, text=True)
        horizontal, vertical = resolution.stdout.split(',')
        # 获取并打印分辨率
        print(resolution.stdout)
      
        my_list=list_images(folder_path)
        image_total=int(len(my_list))
        
        mv_list=list_movie(movie_path)
        movie_total=int(len(mv_list))
        
        
        #movie_path=movieShowinList(1) 
        #print("Movie path:", movie_path)
        #movie_Show(movie_path)
      
        while True:
                 
            bmpShowinList(bmp_index)
            if manual==0:
                bmp_index=updateIndex(bmp_index,1,image_total)
                Delay_bmp(delay)                      
            else:
                Delay_bmp(0.01)  
                
     
    except Exception as e:
        print("err：", str(e))
        
def Delay_bmp(time_set):
    global image_total,bmp_index
    global manual
    global movie_index,movie_total
    global cmos_index,cmos_total
    global horizontal, vertical
#
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
            bmp_index=updateIndex(bmp_index,1,image_total)
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
            bmp_index=updateIndex(bmp_index,-1,image_total)  
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

            if (int(horizontal)==1280) and (int(vertical)==800):  ##若为7寸后视镜头
                cmos_index=update_cmos_Index(cmos_index,-1,cmos_total)
                movie_index=update_movie_Index(movie_index,-1,movie_total)
                movie_path=movieShowinList(movie_index)
                #print("Movie path:", movie_path)
                if cmos_index == 1:
                    cmos_Show(cmos_index)
                else:
                    movie_cmos_Show(movie_path)
            else:
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