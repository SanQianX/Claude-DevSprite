# 04. 根本原因分析

## 问题定位

```
┌─────────────────────────────────────────────────────────────────┐
│                        问题定位流程                               │
├─────────────────────────────────────────────────────────────────┤
│ 1. UI 显示异常 → 检查前端组件 → 绑定逻辑正常                      │
│ 2. 数据来源 → 检查 API 调用 → 接口正常                            │
│ 3. 后端实现 → 检查路由代码 → 发现 Mock 数据                       │
│ 4. 数据源 → 无真实数据采集 → 确认根本原因                          │
└─────────────────────────────────────────────────────────────────┘
```

## 技术分析

### 1. 前端层 (正常)

```typescript
// TokensBar.vue - 数据绑定正确
const data = await tokensApi.getStats(activePeriod.value)
stats.value = data.stats  // ✅ 正确接收后端数据
```

### 2. API 层 (正常)

```typescript
// tokens.ts - 接口调用正确
async getStats(period: string): Promise<TokensResponse> {
  return unwrap(apiClient.get<TokensResponse>(`/tokens?period=${period}`))
}
```

### 3. 后端层 (问题所在)

```typescript
// routes/tokens.ts - Mock 数据
function getTokenData(period: string) {
  const stats = { total: 1284567, input: 823412, output: 461155, cache: 128456 }  // ❌ 硬编码

  const weekly = []
  for (let i = 6; i >= 0; i--) {
    const base = 50000 + Math.floor(Math.random() * 100000)  // ❌ 随机数
    // ...
  }

  return { stats, weekly, trendDelta, trendPercent }  // ❌ 全是假数据
}
```

### 4. 数据源层 (缺失)

```
Claude Code 日志文件 (~/.claude/projects/)
    ↓
[未实现] JSONL 解析器
    ↓
[未实现] Token 聚合逻辑
    ↓
[未实现] 费用计算
```

## 原因总结

| 原因类型 | 描述 |
|----------|------|
| **直接原因** | 后端 `getTokenData()` 返回硬编码 + 随机数据 |
| **根本原因** | 未实现真实的数据采集管道 |
| **设计原因** | 开发初期使用 Mock 数据，但未规划替换时间点 |
| **依赖原因** | 未集成外部工具（如 ccusage）获取真实数据 |

## 解决方案评估

### 方案 A: 自己实现 JSONL 解析器

```
优点: 完全控制，无外部依赖
缺点: 工作量大，需要理解 Claude Code 日志格式
预估时间: 2-3 天
```

### 方案 B: 集成 ccusage CLI (采用)

```
优点: 即开即用，功能完整，支持多维度聚合
缺点: 需要安装 ccusage，有 CLI 调用开销
预估时间: 2-3 小时
```

### 方案 C: 使用 ccusage 作为库

```
优点: 无 CLI 开销，类型安全
缺点: 需要重构 ccusage 为可导入的库
预估时间: 1-2 天
```

## 最终决策

**选择方案 B: 集成 ccusage CLI**

理由:
1. ccusage 已经安装在系统中
2. 功能完整（daily/weekly/monthly/session）
3. 支持 JSON 输出，易于解析
4. 开发成本最低
5. 可以异步调用，不阻塞主线程
