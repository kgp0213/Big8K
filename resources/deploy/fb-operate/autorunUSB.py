#!/usr/bin/env python3
import cv2
import numpy as np
import mmap
import struct
import subprocess
import os
import time
import logging
import threading
from pathlib import Path
import itertools
from typing import List  
BASE_MOUNT_POINT = "/mnt/usbsd"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_usb_devices():
    devices = []
    logging.info("扫描 /dev 以查找 USB 设备...")
    for device in os.listdir("/dev"):
        if device.startswith("sd") and device[-1].isdigit():
            devices.append(device)
            logging.info(f"检测到设备: {device}")
    logging.info(f"找到的 USB 设备总数: {len(devices)}")
    return devices

def is_mounted(device_path):
    result = subprocess.run(['mount'], capture_output=True, text=True)
    return device_path in result.stdout

def mount_device(device, mount_point):
    device_path = f"/dev/{device}"
    os.makedirs(mount_point, exist_ok=True)
    if not is_mounted(device_path):
        subprocess.run(['mount', device_path, mount_point], check=True)
        logging.info(f"将 {device_path} 挂载在 {mount_point}")

def display_on_fb(image: np.ndarray) -> None:   
    # 从全局配置获取参数
    fb_path = display_config.fb_path
    screen_width = display_config.screen_width
    screen_height = display_config.screen_height
    
    if image.shape[2] == 3:
        image = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
    
    if image.shape[1] != screen_width or image.shape[0] != screen_height:
        img_height, img_width = image.shape[:2]
        logging.info(f"分辨率 {img_width}x{img_height}")
        image = cv2.resize(image, (screen_width, screen_height), interpolation=cv2.INTER_AREA)

    fb_size = screen_height * screen_width * 4
    try:
        with open(fb_path, 'r+b') as fb:
            mm = mmap.mmap(fb.fileno(), fb_size, mmap.MAP_SHARED, mmap.PROT_WRITE)
            mm.write(image.tobytes())
            mm.close()
    except Exception as e:
        logging.error(f"写入帧缓冲区时出错: {str(e)}")

def update_BMP(image_path: str) -> None:  # 移除参数
    image = cv2.imread(image_path)    
    if image is None: 
        logging.error(f"图像读取失败: {image_path}")
        return   
    logging.info(f"显示图像: {image_path}")
    display_on_fb(image)  

first_execution = True
A_content = None    # 类型: np.ndarray
A_area = None       # 类型: tuple
B_content = None    # 类型: np.ndarray
B_area = None       # 类型: tuple
last_text_size = (0, 0)        # 缓存文本尺寸 (width, height)
last_calculated_area = (0, 0, 0, 0)  # 缓存区域坐标 (x1,y1,x2,y2)

gray_value =128  #用于记录连续灰阶显示时的灰阶值
def display_message(message: str) -> None:

    global display_config
    global A_content,A_area,B_content,B_area,last_text_size,last_calculated_area,first_execution
    screen_width, screen_height=display_config.screen_width,display_config.screen_height
    fb_path = display_config.fb_path
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale, font_thickness = 2, 2
    font_color = (68, 80, 100, 255)  # BGRA格式
    fb_size = screen_height * screen_width * 4
    try: 
        with open(fb_path, 'r+b') as fb:
            # 内存映射操作
            mm = mmap.mmap(fb.fileno(), fb_size, mmap.MAP_SHARED, mmap.PROT_WRITE)
            current_content = np.frombuffer(mm, dtype=np.uint8).reshape((screen_height, screen_width, 4))
            
            # 性能优化：缓存message区域,仅当文本尺寸变化时重新计算区域
            current_text_size = cv2.getTextSize(message, font, font_scale, font_thickness)[0]
            text_size_changed =(current_text_size != last_text_size)
            if  text_size_changed :
                logging.debug(f"文本尺寸变化: {last_text_size} → {current_text_size}")
                last_text_size = current_text_size                
                # 重新计算区域坐标
                text_x = max(0, (screen_width - current_text_size[0]) // 2)
                text_y = min(screen_height, (screen_height + current_text_size[1]) // 2)
                last_calculated_area = (
                    max(0, text_x),
                    max(0, text_y - current_text_size[1]),
                    min(screen_width, text_x + current_text_size[0]),
                    min(screen_height, text_y + font_thickness)
                )
            # 使用缓存区域
            new_area = last_calculated_area
            logging.debug(f"使用缓存区域: {new_area}")

            text_x = new_area[0]  # 区域左边界
            text_y = new_area[3] - font_thickness  # 区域下边界减去线宽
            # ========= 首次执行处理 =========
            if first_execution:
                logging.debug(f"初始化A/B快照基准{first_execution}")
                first_execution = False
                try:
                    A_content = current_content[new_area[1]:new_area[3], new_area[0]:new_area[2]].copy()
                    A_area = new_area
                    B_content = A_content.copy()
                    B_area = A_area
                    logging.debug(f"首次执行，更新A快照区域: {new_area}")                    
                except IndexError as e:
                    logging.error(f"快照截取越界: {str(e)}")               
                # return
            else :  # not first_execution
               # 检查 B 记录的内容是否与当前 framebuffer 对应内容一致，对fb受影响部分进行快照
                if (np.array_equal(B_content, current_content[B_area[1]:B_area[3], B_area[0]:B_area[2]])):
                    # 恢复 A 记录的内容到 framebuffer
                    try:
                        current_content[A_area[1]:A_area[3], A_area[0]:A_area[2]] = A_content
                        logging.debug(f"B记录内容没变化，先恢复 A 记录的内容到 framebuffer")
                    except IndexError as e:
                        logging.error(f"区域恢复越界: {str(e)}")                    
                        return
                    if text_size_changed:
                        # message长度发生变化时再次更新A快照，防止无法有效恢复原始内容
                        try:
                            A_content = current_content[new_area[1]:new_area[3], new_area[0]:new_area[2]].copy()
                            A_area = new_area
                            logging.debug(f"二次更新A快照区域: {new_area}")
                        except IndexError as e:
                            logging.error(f"快照截取越界: {str(e)}")
                            return
                else:  #不相等的时候也要更新A 记录
                    A_content = current_content[new_area[1]:new_area[3], new_area[0]:new_area[2]].copy()
                    A_area = new_area
                    logging.debug(f"B记录内容发生变化，fb内容被刷新,检测到外部画面修改，重新快照记录至 A ")
               
            # 绘制新消息
            cv2.putText(current_content, message, (text_x, text_y), 
                       font, font_scale, font_color, font_thickness)

            # 更新B快照（用于检测外部修改）
            B_content = current_content[new_area[1]:new_area[3], new_area[0]:new_area[2]].copy()
            B_area = new_area
            logging.debug(f"更新B快照区域: {new_area}")
            
    except Exception as e:
        logging.error(f"帧缓冲区操作失败: {str(e)}")
    finally:
        del current_content  # 显式释放大内存对象
        mm.close()

def get_image_paths(directory: str) -> List[str]:
    supported_formats = ('.png', '.jpg', '.jpeg', '.bmp')
    return [os.path.join(directory, file) for file in os.listdir(directory) if file.endswith(supported_formats)]

def show_gray_Presets(value: str) -> None:
    """
    Parameters:
        value: 9位数字字符串，格式为 RRRGGGBBB (每分量3位十进制)
              示例: "255255255" 表示白色
    """
    try:
        if len(value) != 9 or not value.isdigit():
            logging.info  (f"显示预设灰阶失败: {value}")
            raise ValueError("无效颜色格式，需9位数字")  
                
        # 解析RGB分量
        r_str = value[0:3]
        g_str = value[3:6]
        b_str = value[6:9]        
        r = int(r_str)
        g = int(g_str)
        b = int(b_str)
        logging.info (f"显示预设灰阶: {value}")
        showGray(r, g, b)        
    except Exception as e:
        logging.error(f"显示预设灰阶失败: {str(e)}")

def showGray(r: int, g: int, b: int) -> None:
    r = max(0, min(r, 255))
    g = max(0, min(g, 255))
    b = max(0, min(b, 255))
    try:
        # 创建纯色BGRA图像
        color = np.array([b, g, r, 255], dtype=np.uint8)  # OpenCV使用BGR格式
        image = np.full((display_config.screen_height, display_config.screen_width, 4), color, dtype=np.uint8)        
        display_on_fb(image)        
    except Exception as e:
        logging.error(f"显示灰度画面失败: {str(e)}")

def set_DBV():
    value = next(dbv_values_iter)
	
	
    logging.info(f"执行 set_DBV 函数，值: {value}")
    # 实现 set_DBV 函数

def find_mouse_devices():
    return [os.path.join('/dev/input/by-path', device_path) for device_path in os.listdir('/dev/input/by-path') if 'event-mouse' in device_path]

def get_mouse_position(data):
    _, _, ev_type, code, value = struct.unpack('llHHI', data)
    if value > 0x7FFFFFFF: value -= 0x100000000
    if ev_type == 2 and code == 0:  # X轴移动
        return 'x', value
    elif ev_type == 2 and code == 1:  # Y轴移动
        return 'y', value
    return 'x', 0
def mouse_scroll_fun(device_path: str, image_paths: List[str]):
    """    
    Args:
        message: 要显示的文本内容        
    Raises:
        ValueError: 输入消息为空时抛出
    """
    if not image_paths:
        display_message("未找到图像！")
        return   
    # 
    value_pos=0 
    image_index= 0
    global gray_value
    scroll_function_index = 0  # 用于跟踪当前的滚轮功能索引
    middle_button_down = False
    # start_x, start_y = None, None
    with open(device_path, 'rb') as f:
        while True:            
            data = f.read(24)
            if len(data) == 24:
                _, _, ev_type, code, value = struct.unpack('llHHI', data)
                # 识别鼠标滚轮事件
                if ev_type == 2 and code == 8:
                    if scroll_function_index == 0:
                        image_index = (image_index + 1) % len(image_paths)
                        update_BMP(image_paths[image_index])
                    elif scroll_function_index == 1:
                        set_DBV()
                    elif scroll_function_index == 2:
                        logging.debug(f"鼠标滚轮返回值：{value}")                        
                        # if (value!=1): value=-1
                        if value > 0x7FFFFFFF: value -= 0x100000000    
                        gray_value=(gray_value+value)%256
                        logging.info(f"当前显示灰阶为：{gray_value}")
                        showGray(gray_value,gray_value,gray_value)                    
                
                # 检查鼠标中键按下
                elif ev_type == 1 and code == 274 and value == 1:
                    logging.info("中键按下")
                    middle_button_down = True
                    start_x, start_y = None, None

                # 检查鼠标中键松开
                elif ev_type == 1 and code == 274 and value == 0:
                    logging.info("中键松开")
                    if scroll_function_index == 2:
                        display_message(f"{gray_value}")
                    middle_button_down = False

                # 检查鼠标移动
                elif middle_button_down and ev_type == 2:
                    axis, pos = get_mouse_position(data)
                    if axis == 'x':   
                        logging.info(f"中键按住并左右移动: {pos}")
                    elif axis == 'y':
                        logging.info(f"中键按住并上下移动: {pos}")
                    
                # 识别左键点击
                elif ev_type == 1 and code == 272 and value == 1:
                    logging.debug("左键点击")
                    gray_values_str = next(gray_values_str_iter)
                    show_gray_Presets(gray_values_str)
                
                # 识别右键点击
                elif ev_type == 1 and code == 273 and value == 1:
                    logging.debug("右键点击")
                    scroll_function_index = (scroll_function_index + 1) % 4  # 切换到下一个滚轮功能
                    logging.info(f"切换到滚轮功能索引: {scroll_function_index}")
                    display_message(f"scroll function: {scroll_function_index}")
                # 鼠标左右移动
                elif scroll_function_index == 3:                    
                    axis, pos = get_mouse_position(data)
                    if axis == 'x' and pos !=0:
                        value_pos +=pos
                        value_pos=value_pos%4
                        if value_pos==1:
                            gray_value=(gray_value+pos)%256
                            logging.info(f"左右移动: {pos}，当前显示灰阶为：{gray_value}")
                            showGray(gray_value,gray_value,gray_value)      
                    # elif axis == 'y':
                    #     logging.info(f"上下移动: {pos}")                            

def getKeyValue():
    try:
        result = subprocess.run("cat /proc/chenfeng_adckey/chenfeng_adckey", shell=True, capture_output=True, text=True)
        time.sleep(0.1)
        return result.stdout.strip().replace(" ", "")
    except subprocess.SubprocessError as e:
        logging.error(f"子进程错误: {str(e)}")
        return ""

def key_fun(image_paths: List[str]):
    logging.info("开始按键功能...")
    try:
        os.system("/vismm/fbshow/fbShowPattern \"255255255\"")
        forward, backward = "04", "03"
        index, last_key_time, last_key_value = 0, 0, ""
        debounce_time = 0.2
        num_files = len(image_paths)        
        if num_files == 0:
            logging.info("目录中未找到 BMP 文件。")
            return        
        while True:
            keyValue = getKeyValue()
            current_time = time.time()            
            if keyValue != last_key_value and current_time - last_key_time > debounce_time:
                if keyValue == forward:
                    index = (index + 1) % num_files
                    logging.info(f"key[v-] {keyValue}")
                    update_BMP(image_paths[index])
                elif keyValue == backward:
                    index = (index - 1) % num_files
                    logging.info(f"key[v+] {keyValue}")
                    update_BMP(image_paths[index])
                last_key_time, last_key_value = current_time, keyValue
    except Exception as e:
        logging.error(f"错误: {str(e)}")

# 预定义的一组用于显示固定灰阶画面的字符串列表
gray_values_str = ['255255255',"191000000", '127127127', '064064064', '032032032', '000000000']
# 预定义的一组用于预设DBV值的数值列表
dbv_values = [10, 100, 356, 389, 500, 1123, 3567]
# 循环迭代
gray_values_str_iter = itertools.cycle(gray_values_str)
dbv_values_iter = itertools.cycle(dbv_values)
class DisplayConfig:
    def __init__(self):
        self.screen_width = 0
        self.screen_height = 0
        self.fb_path = '/dev/fb0'

display_config = DisplayConfig()
def main():
    cmd = "cat /sys/class/graphics/fb0/virtual_size"
    result = subprocess.run(cmd, shell=True, check=True, stdout=subprocess.PIPE, universal_newlines=True)
    display_config.screen_width, display_config.screen_height = map(int, result.stdout.strip().split(','))
    logging.info(f"屏幕分辨率: {display_config.screen_width}x{display_config.screen_height}")
    
    current_devices = get_usb_devices()    
    for index, device in enumerate(current_devices):
        mount_device(device, BASE_MOUNT_POINT + (str(index + 1) if index > 0 else ""))
    image_directory = Path(BASE_MOUNT_POINT)/"bmp_online"   #BASE_MOUNT_POINT + "/bmp_online/"
    if not os.path.exists(image_directory):
        logging.info(f"USB设备{image_directory}读取异常")
        image_directory = "/vismm/fbshow/bmp_online/"
    logging.info(f"图片目录: {image_directory}")        
    image_paths = get_image_paths(image_directory)
    if image_paths:
        update_BMP(image_paths[0])

    mouse_device_paths = find_mouse_devices()
    if not mouse_device_paths:
        logging.info("未找到任何鼠标设备。")
    else:
        for mouse_device_path in mouse_device_paths:
            logging.info(f"找到鼠标设备: {mouse_device_path}")
            try:
                mouse_thread = threading.Thread(target=mouse_scroll_fun, args=(mouse_device_path, image_paths))
                mouse_thread.start()
            except FileNotFoundError:
                logging.error(f"鼠标设备文件未找到: {mouse_device_path}")
            except Exception as e:
                logging.error(f"读取鼠标数据时出错: {e}")
    #按键控制图片usb或内存图片切换    
    key_fun(image_paths)
    
if __name__ == "__main__":    
    main()
#注意,sd卡在读卡器里面插入电脑后需要格式化为FAT32格式
#读卡器/u盘插入8K平台后，使用"fdisk -l" 查看是否显示 /dev/sda1,2,3  或者/dev/sdb1,2,3
#如果有多个usb 磁盘,则需要保证图片存在第一个磁盘中
#上述代码执行过程中被强行终止退出后可能会导致： 
# root@ubuntu2004: ls /mnt/usbsd# 
# ls: cannot access 'bmp_online': Input/output error
# 通过rm删除的时候rm: cannot remove 'bmp_online': Read-only file system 
# 但是，此时usb里面图片文件在电脑端可能还可以读取的,但是文件属性可能无法修改。需要先修复，无法修复就格式化
