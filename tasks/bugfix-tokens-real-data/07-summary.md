# 07. 总结与改进

## 修复总结

### 问题
首页 Tokens 栏显示 Mock 数据，非真实 Claude Code token 消耗。

### 原因
后端 `getTokenData()` 使用硬编码 + 随机数生成假数据，未连接真实数据源。

### 解决方案
集成 ccusage CLI 获取真实数据，添加内存缓存和预加载优化。

### 结果
- ✅ 真实数据: 调用 ccusage 获取本地 Claude Code 日志
- ✅ 5 分钟缓存: 避免频繁 CLI 调用
- ✅ 瞬间切换: 预加载所有周期，切换延迟 < 10ms
- ✅ 详情弹窗: 显示每日各模型的详细消耗

## 关键技术点

### 1. ccusage CLI 集成

```typescript
// 子进程调用
const { stdout } = await execAsync('ccusage daily --json --offline', {
  timeout: 30000,
  maxBuffer: 10 * 1024 * 1024
})
```

### 2. 内存缓存

```typescript
const cache = new Map<string, CacheEntry<unknown>>()
const CACHE_TTL_MS = 5 * 60 * 1000  // 5 分钟

async function getCachedOrFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.data  // 缓存命中
  }
  const data = await fetcher()  // 重新获取
  cache.set(key, { data, timestamp: Date.now() })
  return data
}
```

### 3. 预加载优化

```typescript
// 页面加载时并行获取所有周期
async function preloadAllPeriods() {
  const periods = ['day', 'week', 'month', 'all']
  await Promise.all(periods.map(p => fetchPeriod(p)))
}
```

## 经验教训

### 1. Mock 数据管理
- Mock 数据应该有明确的标记和替换计划
- 使用环境变量控制是否使用 Mock 数据
- 在 README 中说明 Mock 数据的使用场景

### 2. 性能优化
- 对于频繁切换的数据，预加载比按需加载体验更好
- 内存缓存适合小数据量、高频访问的场景
- CLI 调用应该异步执行，避免阻塞主线程

### 3. 错误处理
- CLI 调用需要设置超时和缓冲区限制
- 网络请求失败应该有合理的 fallback
- 日志记录应该包含足够的调试信息

## 后续改进建议

### 短期 (1-2 周)

1. **成本计算优化**
   - 集成更完整的模型定价数据库
   - 支持自定义定价配置
   - 显示每个模型的费用 breakdown

2. **数据可视化增强**
   - 添加更详细的图表（折线图、饼图）
   - 支持自定义时间范围
   - 导出数据为 CSV/JSON

### 中期 (1-2 月)

1. **实时更新**
   - 使用 WebSocket 推送实时数据
   - 自动刷新间隔可配置
   - 后台持续采集数据

2. **多项目支持**
   - 按项目聚合数据
   - 项目间对比分析
   - 项目级别的费用追踪

### 长期 (3+ 月)

1. **智能分析**
   - 使用 AI 分析使用模式
   - 预测未来消耗趋势
   - 提供优化建议

2. **告警系统**
   - 费用超限告警
   - 异常使用检测
   - 邮件/推送通知

## 相关文件

| 文件 | 说明 |
|------|------|
| `src/worker/ccusage.ts` | ccusage 服务层 |
| `src/worker/routes/tokens.ts` | API 路由 |
| `web/src/api/tokens.ts` | 前端 API |
| `web/src/components/home/TokensBar.vue` | 主组件 |
| `web/src/components/home/TokenDetailModal.vue` | 详情弹窗 |
| `tasks/bugfix-tokens-real-data/` | 本文档目录 |
