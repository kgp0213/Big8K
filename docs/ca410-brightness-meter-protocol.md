# CA-VP410 亮度计速查

更新时间：2026-05-04

主文档见 `ca410_protocol.md`。本文件只保留现场速查信息。

## 1. 默认对象

本项目中：

```text
410 / CA410 / ca410 = CA-VP410 探头
```

除非明确写 `CA-DP40`、`CA-VP410A`、`CA-VP427A`、`CA-VP427C`，否则不要扩展解释。

## 2. 连接

当前项目只采用：

```text
USB -> 虚拟串口 / COM 口
```

接到 8K 平台时，同样按板端串口设备通信。

## 3. 串口参数

```text
baudrate = 921600
parity   = Even
bytesize = 7
stopbits = 1.5
timeout  = 0.5s
ending   = \r
```

不要使用 8N1。

## 4. 初始化

```text
SCS,0
SCS,4,60.00
FSC,1
MMS,0
MDS,0
FMS,0
MCH,0
LUS,1
ZRC
```

`ZRC` 是零校准，必须遮光。

## 5. 测量

发送：

```text
MES,1
```

返回：

```text
OK00,P1,0,Cx,Cy,Lv,...
```

解析：

```text
x  = parts[3]
y  = parts[4]
Lv = parts[5]
```

## 6. 推荐集成流程

```text
自动检测 COM -> 初始化 -> 显示指定画面 -> 等待稳定 -> MES,1 -> 记录 x/y/Lv
```

低亮扫描时可考虑：

- `FSC,3` AUTO。
- `FSC,0` SLOW。
- 多次平均。

