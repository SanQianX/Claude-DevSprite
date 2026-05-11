# 05. 修复实现过程

## 实现架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        修复后架构                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  前端                                                          │
│  ├─ TokensBar.vue ─────────→ 预加载所有周期数据                  │
│  └─ TokenDetailModal.vue ──→ 详细数据表格                        │
│          │                                                      │
│          ↓                                                      │
│  API 层                                                         │
│  └─ tokens.ts ─────────────→ GET/POST /api/tokens              │
│          │                                                      │
│          ↓                                                      │
│  后端                                                          │
│  ├─ routes/tokens.ts ──────→ 路由处理 + 缓存控制                │
│  └─ ccusage.ts ────────────→ ccusage CLI 调用 + 内存缓存        │
│          │                                                      │
│          ↓                                                      │
│  外部工具                                                       │
│  └─ ccusage CLI ───────────→ 读取 ~/.claude/projects/ 日志      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 实现步骤

### Step 1: 创建 ccusage 服务层

文件: `src/worker/ccusage.ts`

```typescript
// 核心功能
1. executeCcusage() - 执行 ccusage CLI 命令
2. getCachedOrFetch() - 带 TTL 的内存缓存
3. getTokensData() - 获取指定周期的数据
4. aggregateStats() - 聚合 token 统计
5. mapToDailyTokens() - 数据格式转换
```

关键代码:
```typescript
async function executeCcusage(command: string, args: string[] = []): Promise<Record<string, unknown>> {
  const fullArgs = [...args, '--json', '--offline'].join(' ')
  const cmd = `ccusage ${command} ${fullArgs}`
  const { stdout } = await execAsync(cmd, { timeout: 30000 })
  return JSON.parse(stdout)
}
```

### Step 2: 更新后端路由

文件: `src/worker/routes/tokens.ts`

```typescript
// 新增端点
GET  /api/tokens?period=week   → 调用 getTokensData()
POST /api/tokens/refresh       → 清除缓存 + 刷新
GET  /api/tokens/status        → 检查 ccusage 可用性
```

### Step 3: 更新前端 API

文件: `web/src/api/tokens.ts`

```typescript
export const tokensApi = {
  async getStats(period: string): Promise<TokensResponse> { ... }
  async refresh(): Promise<...> { ... }      // 新增
  async status(): Promise<...> { ... }       // 新增
}
```

### Step 4: 创建详情弹窗

文件: `web/src/components/home/TokenDetailModal.vue`

功能:
- 每日各模型的详细消耗表格
- 汇总统计
- 周期切换
- 手动刷新

### Step 5: 优化 TokensBar 组件

文件: `web/src/components/home/TokensBar.vue`

改进:
1. **预加载**: 页面加载时并行获取所有周期数据
2. **瞬间切换**: 切换周期时从内存读取，无网络请求
3. **详情按钮**: 点击打开 TokenDetailModal
4. **成本显示**: 显示 USD 费用
5. **相对时间**: 显示"X 分钟前"

## 缓存策略

```
┌─────────────────────────────────────────────────────────────────┐
│                        缓存流程                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  首次请求 GET /api/tokens?period=week                           │
│      ↓                                                          │
│  检查内存缓存 Map                                               │
│      ↓ (缓存未命中)                                             │
│  执行 ccusage weekly --json --offline                           │
│      ↓                                                          │
│  解析 JSON → 聚合统计 → 存入缓存 (TTL=5min)                     │
│      ↓                                                          │
│  返回数据                                                       │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  5 分钟内再次请求                                                │
│      ↓                                                          │
│  检查内存缓存                                                   │
│      ↓ (缓存命中)                                               │
│  直接返回缓存数据 (无 CLI 调用)                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 数据转换

### ccusage 输出 → 前端格式

```typescript
// 输入 (ccusage)
{
  "date": "2026-05-12",
  "inputTokens": 268726,
  "outputTokens": 16309,
  "cacheCreationTokens": 0,
  "cacheReadTokens": 7007488,
  "totalTokens": 7292523,
  "totalCost": 0,
  "modelsUsed": ["mimo-v2.5"]
}

// 输出 (前端)
{
  "date": "2026-05-12",
  "input": 268726,
  "output": 16309,
  "cache": 7007488,
  "total": 7292523,
  "cost": 0,
  "models": ["mimo-v2.5"]
}
```

## 预加载优化

### 优化前
```
用户点击 [周] → 请求 API (1-3s) → 显示数据
用户点击 [月] → 请求 API (1-3s) → 显示数据
用户点击 [日] → 请求 API (1-3s) → 显示数据
总耗时: 3-9 秒
```

### 优化后
```
页面加载 → 并行请求 4 个周期 (3-5s) → 数据存入内存
用户点击 [周] → 读取内存 (< 1ms) → 显示数据
用户点击 [月] → 读取内存 (< 1ms) → 显示数据
用户点击 [日] → 读取内存 (< 1ms) → 显示数据
总耗时: 3-5 秒 (一次性)
```

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/worker/ccusage.ts` | 新增 | ccusage 服务层 |
| `src/worker/routes/tokens.ts` | 重写 | 使用真实数据 |
| `web/src/api/tokens.ts` | 更新 | 新增 refresh/status 方法 |
| `web/src/components/home/TokensBar.vue` | 重写 | 预加载 + 详情按钮 |
| `web/src/components/home/TokenDetailModal.vue` | 新增 | 详情弹窗组件 |
