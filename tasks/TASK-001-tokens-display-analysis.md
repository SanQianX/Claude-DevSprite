# TASK-001: 首页 Tokens 消耗显示逻辑分析

## 概述

首页顶部的 Tokens 消耗栏是一个独立组件 `TokensBar`，显示当前项目的 Token 使用统计，包括总量、输入/输出/缓存分类、7 日趋势图和周期切换。

## 数据流

```
用户点击周期按钮 (日/周/月/全部)
        ↓
TokensBar.setPeriod(key)
        ↓
tokensApi.getStats(period)        ← web/src/api/tokens.ts
        ↓
GET /api/tokens?period=week       ← src/worker/routes/tokens.ts
        ↓
getTokenData(period)              ← 后端生成数据
        ↓
返回 { stats, weekly, trendDelta, trendPercent }
        ↓
前端渲染
```

## 前端组件结构

**文件**: `web/src/components/home/TokensBar.vue`

### 模板结构
```
tokens-bar
├── tokens-summary          ← 显示 "Tokens" 标签 + 总量数字
├── tokens-divider          ← 竖线分隔符
├── tokens-chips            ← 三个标签：Input / Output / Cache
│   ├── tokens-dot-in       ← 蓝色圆点 (#3b82f6)
│   ├── tokens-dot-out      ← 紫色圆点 (#8b5cf6)
│   └── tokens-dot-cache    ← 绿色圆点 (#22c55e)
├── tokens-mini-chart       ← 7 日迷你柱状图
│   └── tokens-mini-bar-group × 7
│       ├── tokens-mini-bar.in   ← 蓝色柱 (input)
│       └── tokens-mini-bar.out  ← 紫色半透明柱 (output)
├── tokens-trend            ← 趋势文本 (↑12% / ↓5% / --)
└── tokens-period           ← 周期切换按钮组
    └── button × 4          ← 日 / 周 / 月 / 全部
```

### 响应式状态
| 变量 | 类型 | 说明 |
|------|------|------|
| `activePeriod` | `ref('week')` | 当前选中的周期 |
| `stats` | `ref({total, input, output, cache})` | Token 统计数据 |
| `weeklyData` | `ref<Array>` | 7 日数据 + 计算后的柱高 |
| `trendDelta` | `ref(0)` | 趋势变化量 |
| `trendPercent` | `ref(0)` | 趋势百分比 |

### 计算属性
| 属性 | 逻辑 |
|------|------|
| `trendClass` | `>0` → `up`(绿), `<0` → `down`(红), `=0` → `neutral`(灰) |
| `trendText` | 格式: `+89,234 本周 ↑12%` 或 `--` |

### 关键函数
| 函数 | 说明 |
|------|------|
| `fetchStats()` | 调用 API 获取数据，失败时使用 mock 数据 |
| `setPeriod(key)` | 切换周期并重新获取数据 |
| `formatNumber(n)` | 数字格式化为 `1,284,567` |

## 后端接口

**文件**: `src/worker/routes/tokens.ts`

### GET /api/tokens?period=week

**参数**: `period` — `day` | `week` | `month` | `all`

**返回格式**:
```json
{
  "stats": {
    "total": 1284567,
    "input": 823412,
    "output": 461155,
    "cache": 128456
  },
  "weekly": [
    { "date": "2026-05-06", "input": 82341, "output": 46115 },
    ...
  ],
  "trendDelta": 89234,
  "trendPercent": 12
}
```

**当前实现**: 纯 mock 数据（`getTokenData` 函数），无真实数据源。

### Mock 数据逻辑
- 基础值: `total=1,284,567`, `input=823,412`, `output=461,155`, `cache=128,456`
- `day`: 基础值 × 5%
- `week`: 基础值 × 100%
- `month`: 基础值 × 400%
- `all`: 基础值 × 1200%
- 7 日数据: 随机生成 `50k~150k/天`，input 占比 60%~70%
- 趋势: 当前周 vs 上周（随机 ±5%~15%）

## API 层

**文件**: `web/src/api/tokens.ts`

```typescript
export const tokensApi = {
  async getStats(period: string = 'week'): Promise<TokensResponse> {
    return unwrap(apiClient.get<TokensResponse>(`/tokens?period=${period}`))
  },
}
```

- 使用 `apiClient`（axios 封装）
- `unwrap()` 解包响应

## 样式特点

- 水平 flex 布局，所有元素一行显示
- 迷你柱状图: 高度按比例缩放到 20px 最大
- 响应式: `@media (max-width: 1024px)` 隐藏迷你图和趋势
- 颜色方案: 蓝=Input, 紫=Output, 绿=Cache

## 待改进

1. **Mock 数据**: 后端返回纯随机数据，无真实 Token 追踪
2. **无数据库存储**: 没有 token_usage 表
3. **周期切换无动画**: 直接替换数据
4. **无项目维度**: 不区分不同项目的 Token 消耗
