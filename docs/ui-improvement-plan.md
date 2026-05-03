# Big8K Tauri UI 改进方案

> 基于对 `src/App.tsx`, `styles.css`, `tabs/*.tsx`, `components/*.tsx` 的全面审查

---

## 一、布局结构问题

### 1.1 固定设计尺寸 + scale 缩放

**现状** (`App.tsx:28-30`):
```ts
const DESIGN_WIDTH = 1500;
const DESIGN_HEIGHT = 900;
const scale = Math.min(1, viewportWidth / DESIGN_WIDTH, viewportHeight / DESIGN_HEIGHT);
```

**问题**:
- 所有内容用 `transform: scale()` 缩放，导致字体模糊、交互坐标偏移
- 非等比缩放时上下留白浪费严重
- 如果用户显示器分辨率低于 1500px 宽，界面直接被压扁

**建议**:
- 改用响应式布局：flex + grid 自适应
- 关键断点：`xl:grid-cols-[180px_1fr_300px]` → `lg:grid-cols-[48px_1fr_280px]`（侧栏可折叠）
- 移除 scale 逻辑，让浏览器/窗口的原生布局引擎处理

### 1.2 侧栏宽度不合理

**现状**: 左侧栏 `w-48`（192px），右侧栏 `w-80`（320px）

**问题**:
- 左侧 192px 对于 6 个导航项来说太宽，大量空间浪费
- 右侧 320px 在连接面板内容较多时不够用

**建议**:
- 左侧栏: `w-44`（176px），折叠态缩为 `w-12`（仅显示图标）
- 右侧栏: `w-72` 或 `w-80` 保持不变，但内容排版需要更紧凑

---

## 二、导航栏改进

### 2.1 Tab 顺序不合理

**现状** (`tabs.ts`):
```
mipi → debug → fb → power → deploy → home
```

- `home` 总览页放在最后一位，不符合认知习惯
- 首次打开时默认 `mipi` 页，用户首先看到的是复杂配置，而不是概览

**建议**:
```
home → mipi → fb → debug → power → deploy
```
即：总览优先，按"配置 → 显示 → 调试 → 电源 → 部署"的工作流排序

### 2.2 导航样式缺乏层次

**现状**: 所有导航项外观一致，只有选中态的 "border-r-2" 区分

**建议**:
- 选中态：`bg-primary-50 + text-primary-700 + font-semibold + rounded-lg`（用圆角而不是右边框）
- hover态：`bg-gray-50` 微灰底
- 功能模块间加 `divider`（如 mipi 配置和电源读取之间）
- 添加 `section label` 标签（如 "调试工具"、"系统"）

---

## 三、Header 改进

### 3.1 标题行设计

**现状**:
```
[Monitor icon] Big8K OLED点屏调试-2026  [Moon/Sun 切换按钮]
```

**问题**:
- 标题太长，信息密度低
- 品牌感弱
- 没有展示连接状态等关键信息

**建议**:
```
[8K Logo] Big8K OLED Panel Debug [版本号]  |  [环境切换] [主题切换]
```
- Logo 使用 small badge 形式
- 右侧环境切换改为 segmented control（dev / test / prod）
- 连接状态用 dot indicator 实时显示

### 3.2 缺少面包屑导航

- 当深入子页面时没有位置提示
- 建议在 main content 顶部加入 `Home > 点屏配置` 的风格路径

---

## 四、颜色系统与主题过度

### 4.1 主色选择

**现状**: 默认 Tailwind blue (`primary: #2563eb`)

**问题**: 蓝色在调试工具中过于常见，缺乏品牌辨识度

**建议**: 改用 **teal / cyan** 作为主色，与"屏幕显示/面板调试"的行业调性更契合：

```js
// tailwind.config.js
colors: {
  primary: {
    50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0',
    400: '#34d399', 500: '#10b981', 600: '#059669',
    700: '#047857', 800: '#065f46', 900: '#064e3b',
  },
}
```

### 4.2 深色模式

**现状**: 使用 `dark:` 前缀做主题切换，基本可用但细节粗糙

**问题**:
- 部分组件在 dark mode 下对比度不足（如 `bg-gray-50` → `dark:bg-gray-900` 不够深）
- 面板边框在 dark 下几乎不可见

**建议**:
- Dark bg 使用 `gray-950` (#030712) 而不是 `gray-900`
- 边框使用 `gray-800` 以获得足够对比
- 在 tailwind.config 中定义 `darkBorder`, `darkBg` 等语义化变量

---

## 五、连接面板（右侧栏）重构

### 5.1 信息密度过高

**现状**: `ConnectionPanel.tsx` 包含 574 行超长组件：
- ADB 连接、SSH 连接、设备列表、TCP连接、日志面板、调试模式开关全部堆叠
- 连接状态以 toast 弹出，却用了 `position: static` 的方式与面板平铺

**建议**:
- 拆分 `ConnectionPanel` 为 `ConnectionStatusCompact`（紧凑状态）和 `ConnectionSettingsExpanded`（展开完整面板）
- 默认显示紧凑模式：仅显示设备名 + 连接状态 dot + 最近 1 条日志
- 点击展开进入完整设置

### 5.2 ADB/SSH 切换

**现状**: 两个按钮并排，选中态用 `bg-primary-600`

**建议**:
- 改为 **segmented control** 样式（类似 iOS 切换器）
- 选中项用白色底，未选中项灰色透明
- ADB 连上后自动禁用 SSH 切换（反之亦然）

### 5.3 日志面板

**现状**: 日志用 `rounded-lg border` 每一条包裹，条目间距较大

**建议**:
- 改为紧凑的 `monospace` 格式，类似终端输出
- 时间戳固定宽度左对齐，level badge 用 2px 小色块
- 添加 "auto-scroll toggle" 和 "filter by level"（info/warn/error 筛选）

---

## 六、HomeTab（总览页）改进

### 6.1 布局比例

**现状**: `grid-cols-12` + `col-span-8 / col-span-4` 的 8:4 分割

**问题**: 右侧连接摘要和 HomeTab 右侧的数据有重复，浪费空间

**建议**:
- 改为 9:3 分割
- 左侧主区域展示 4 个 metric cards（会话/CPU/温度/内存）再 + 屏幕信息表格
- 右侧仅显示 "快速操作"（sleep in/out/reset）和实时缩略日志

### 6.2 无数据状态

当未连接设备时，只显示 `"ADB 连接后自动读取..."` 文本

**建议**: 使用 inline skeleton loading 占位 + 可点击的"尝试连接"快捷按钮

---

## 七、统一组件规范

### 7.1 Border Radius 不一致

代码中混用：
| class | 用法 |
|---|---|
| `rounded-lg` | `panel`, `btn` |
| `rounded-xl` | 多处卡片 |
| `rounded-2xl` | HomeTab 中的 metric cards |

**建议**: 统一规范：
- 大卡片/面板: `rounded-xl` (12px)
- 按钮/输入框: `rounded-lg` (8px)
- Badge/tag: `rounded-full`

### 7.2 按钮样式不一致

**现状**:
- `btn-primary` → `bg-primary-600`
- `btn-secondary` → `bg-gray-200`
- MipiTab 中还有自定义的 `border-blue-200 bg-blue-50` 按钮

**建议**: 
- 统一到 4 种变体：`primary` / `secondary` / `ghost` / `danger`
- 所有按钮使用 Tailwind `@apply` 生成一致的 className
- 图标按钮统一 32x32 尺寸

### 7.3 间距规范

**现状**: 混用 `p-4`, `px-4 py-3`, `p-3`, `p-5` 等

**建议**: 定义间距 tokens：
- 面板内容内边距: `p-4` (16px)
- 面板 header: `px-4 py-3`
- 紧凑列表项: `px-3 py-2`
- 卡片组 gap: `gap-4` (16px) / `gap-3` (12px)

---

## 八、性能与交互

### 8.1 消除 scale 计算

移除 `App.tsx` 中 `DESIGN_WIDTH / DESIGN_HEIGHT / scale` 相关逻辑，改为纯 CSS 响应式布局。这可以结束每次 resize 事件触发全量重渲染的问题。

### 8.2 Loading 状态

很多操作（adb probing, ssh 连接）都没有 skeleton loading。

建议：
- 在所有异步请求期间显示 `min-h-[80px]` 的 skeleton（`bg-gray-100 animate-pulse`）
- 错误状态用 `rounded-lg border border-red-200 bg-red-50` 显示具体错误信息

### 8.3 日志性能

**现状**: `appendLog` 每次追加整个数组，使用 `setLogs(prev => [...prev, ...])`。当日志达到数百条时性能下降。

**建议**: 
- 限制最大日志条数（如 200 条），超过时丢弃最旧的
- 使用 `useRef<LogEntry[]>` + 定时 flush 到 state，减少 React 重渲染次数

---

## 九、具体文件修改建议

| 文件 | 优先级 | 修改内容 |
|---|---|---|
| `tailwind.config.js` | P1 | 更换主色为 teal，添加 dark 语义色 |
| `App.tsx` | P0 | 移除 scale 缩放逻辑，改为 flex 响应式布局 |
| `App.tsx` | P1 | Header 重新设计，添加 breadcrumb、环境切换 |
| `App.tsx` | P1 | 左侧栏折叠支持 |
| `src/tabs/tabs.ts` | P1 | 重新排序 tabs：home → mipi → fb → debug → power → deploy |
| `styles.css` | P1 | 统一 border-radius 和 spacing tokens，添加 skeleton 工具类 |
| `ConnectionPanel.tsx` | P0 | 拆分为 compact/expanded 两态，压缩日志样式 |
| `HomeTab.tsx` | P1 | 添加 skeleton loading、快捷连接按钮 |
| `MipiTab.tsx` | P2 | 统一按钮样式，使用 btn-primary/secondary 类 |
| 所有 tab 文件 | P2 | 用统一的 panel/card 组件替代零散样式 |

---

## 十、推荐实施路线

```
Phase 1 — 基础框架改造（半天）
├── tailwind.config 主色 + 语义色
├── App.tsx 移除 scale，改为响应式布局
├── styles.css 统一样式 tokens

Phase 2 — 导航与 Header 优化（半天）
├── Header 重新设计
├── 左侧栏折叠 + 导航排序

Phase 3 — 连接面板重构（1天）
├── 拆分 ConnectionPanel
├── 日志样式优化 + 性能优化

Phase 4 — 各 Tab 页打磨（1天）
├── HomeTab skeleton 加载态
├── MipiTab 按钮统一
├── 全局 loading/error 状态
```
