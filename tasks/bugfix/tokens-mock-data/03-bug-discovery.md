# 03. 问题发现过程

## 发现时间
2026-05-12

## 发现方式
代码审查 + API 测试

## 问题描述

用户在进行 UI 测试时，发现首页 Tokens 栏的数据显示异常：
- 数据看起来"太假"，像是随机生成的
- 每次刷新数据都不同，但没有规律
- 费用显示为 0，但 Token 数量却很大

## 排查步骤

### Step 1: 检查前端组件

文件: `web/src/components/home/TokensBar.vue`

```typescript
async function fetchStats() {
  try {
    const data = await tokensApi.getStats(activePeriod.value)
    stats.value = data.stats
    // ... 正常的数据绑定
  } catch {
    // Fallback to mock data
    stats.value = { total: 1284567, input: 823412, output: 461155, cache: 128456 }
    // ...
  }
}
```

**发现**: catch 块中有硬编码的 mock 数据作为 fallback。

### Step 2: 检查前端 API

文件: `web/src/api/tokens.ts`

```typescript
export const tokensApi = {
  async getStats(period: string = 'week'): Promise<TokensResponse> {
    return unwrap(apiClient.get<TokensResponse>(`/tokens?period=${period}`))
  }
}
```

**发现**: API 客户端正常，调用 `/api/tokens` 端点。

### Step 3: 检查后端路由

文件: `src/worker/routes/tokens.ts`

```typescript
function getTokenData(period: string) {
  const stats = { total: 1284567, input: 823412, output: 461155, cache: 128456 }

  // Generate 7 days of weekly data
  const weekly = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const base = 50000 + Math.floor(Math.random() * 100000)  // ← 随机数！
    // ...
  }

  return {
    stats: periodStats,
    weekly,
    trendDelta,
    trendPercent,
  }
}
```

**发现**:
1. `stats` 是硬编码的固定值
2. `weekly` 数据使用 `Math.random()` 生成
3. 趋势计算基于随机数据

### Step 4: 调用 API 验证

```bash
curl http://127.0.0.1:38888/api/tokens?period=week
```

返回:
```json
{
  "stats": { "total": 1284567, "input": 823412, "output": 461155, "cache": 128456 },
  "weekly": [
    { "date": "2026-05-06", "input": 89234, "output": 45123 },
    { "date": "2026-05-07", "input": 123456, "output": 67890 },
    // ... 随机数据
  ],
  "trendDelta": 89234,
  "trendPercent": 12
}
```

**确认**: 后端返回的是完全的 Mock 数据。

## 问题总结

| 层级 | 文件 | 问题 |
|------|------|------|
| 前端组件 | TokensBar.vue | catch 块有 mock fallback（正常） |
| 前端 API | tokens.ts | 正常，调用后端接口 |
| 后端路由 | tokens.ts | **纯 mock 数据，无真实采集** |
| 数据源 | 无 | **未连接到 Claude Code 日志** |

## 根本原因

**后端没有实现真实的数据采集逻辑**，而是使用硬编码 + 随机数生成 mock 数据。这在开发初期是正常的，但应该在某个时间点替换为真实实现。

## 影响范围

1. 用户看到的 Token 消耗数据完全不准确
2. 趋势分析毫无意义
3. 费用计算无法使用
4. 无法追踪实际的 Claude Code 使用量
