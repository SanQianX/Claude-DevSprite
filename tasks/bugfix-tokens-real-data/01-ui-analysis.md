# 01. UI 控件分析

## TokensBar 组件结构

```
┌─────────────────────────────────────────────────────────────────────┐
│  Tokens  1,284,567  │  ● Input  823K  ● Output  461K  ● Cache 128K  │
│                      │  ▐▌▐▌▐▌▐▌▐▌▐▌▐▌  +89,234 本周 ↑12%  [日][周][月][全部]  │
└─────────────────────────────────────────────────────────────────────┘
```

## 控件清单

| 控件 | 类型 | 功能 | 位置 |
|------|------|------|------|
| `tokens-summary` | 文本 | 显示 Token 总数 | 左侧 |
| `tokens-cost` | 文本 | 显示 USD 费用 | 总数右侧 |
| `tokens-chips` | 标签组 | Input/Output/Cache 分类统计 | 中间 |
| `tokens-mini-chart` | 图表 | 7 天迷你柱状图 | 中间 |
| `tokens-trend` | 文本 | 趋势变化百分比 | 右侧 |
| `tokens-period` | 按钮组 | 日/周/月/全部 切换 | 右侧 |
| `tokens-detail-btn` | 按钮 | 打开详情弹窗 | 右侧 |
| `tokens-refresh-btn` | 按钮 | 手动刷新数据 | 右侧 |
| `tokens-updated` | 文本 | 最后更新时间 | 最右侧 |

## 数据流分析

```
组件挂载 (onMounted)
    ↓
preloadAllPeriods()
    ↓
并行调用 4 个 API
├─ GET /api/tokens?period=day
├─ GET /api/tokens?period=week
├─ GET /api/tokens?period=month
└─ GET /api/tokens?period=all
    ↓
响应存入 allPeriodData (ref)
    ↓
用户切换周期 → 从 allPeriodData 读取 → 瞬间显示
```

## 交互流程

### 1. 切换周期
```
用户点击 [日]/[周]/[月]/[全部]
    ↓
setPeriod(key) → activePeriod.value = key
    ↓
currentData computed 属性重新计算
    ↓
DOM 更新显示对应周期数据
```

### 2. 点击详情按钮
```
用户点击 </> 按钮
    ↓
showDetail.value = true
    ↓
TokenDetailModal 组件显示
    ↓
watch(visible) 触发 loadAllData()
    ↓
弹窗内显示详细表格
```

### 3. 手动刷新
```
用户点击刷新按钮
    ↓
isRefreshing.value = true (显示旋转动画)
    ↓
POST /api/tokens/refresh (清除后端缓存)
    ↓
preloadAllPeriods() (重新获取所有周期)
    ↓
isRefreshing.value = false
```

## 响应式设计

| 屏幕宽度 | 隐藏元素 |
|----------|----------|
| < 1024px | 迷你图表、趋势文本、更新时间 |
| < 768px | 缓存标签 |
| < 480px | 所有标签，只显示总数 |
