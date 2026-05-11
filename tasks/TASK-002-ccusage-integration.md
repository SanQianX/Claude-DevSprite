# TASK-002: ccusage 集成实现真实 Token 消耗追踪

## 状态: ✅ 已完成

## 完成时间
2026-05-12

## 实现内容

### 1. 后端服务 (`src/worker/ccusage.ts`)
- **ccusage CLI 集成**: 通过子进程调用 `ccusage` 命令获取真实数据
- **内存缓存层**: 5 分钟 TTL 缓存，避免频繁调用 CLI
- **数据映射**: 将 ccusage JSON 格式转换为前端期望的格式
- **多维度支持**: daily/weekly/monthly 聚合统计

### 2. API 路由 (`src/worker/routes/tokens.ts`)
- `GET /api/tokens?period=week` - 获取指定时间段的 token 消耗
- `POST /api/tokens/refresh` - 强制刷新缓存
- `GET /api/tokens/status` - 检查 ccusage 可用性

### 3. 前端 API (`web/src/api/tokens.ts`)
- 新增 `refresh()` 方法调用刷新接口
- 新增 `status()` 方法检查服务状态

### 4. 前端组件 (`web/src/components/home/TokensBar.vue`)
- **刷新按钮**: 手动触发数据刷新，带旋转动画
- **成本显示**: 显示 USD 成本（如果模型有定价）
- **相对时间**: 显示"X 分钟前"更新时间
- **智能格式化**: 大数字自动转换为 K/M 格式
- **工具提示**: 图表柱状图显示详细信息

## 数据流程

```
用户访问首页
    ↓
TokensBar.vue → GET /api/tokens?period=week
    ↓
tokens.ts 路由 → ccusage.ts 服务
    ↓
检查缓存 (5分钟 TTL)
    ↓ (缓存过期)
执行 ccusage daily --json --offline
    ↓
解析 JSON → 聚合统计 → 缓存结果
    ↓
返回数据到前端
```

## 验证结果

```bash
# 测试 API 返回真实数据
curl http://127.0.0.1:38888/api/tokens?period=week
# 返回: {"stats":{"total":208675407,...},"daily":[...],"lastUpdated":"..."}

# 测试刷新端点
curl -X POST http://127.0.0.1:38888/api/tokens/refresh
# 返回: {"success":true,"message":"Cache cleared and data refreshed"}

# 测试状态端点
curl http://127.0.0.1:38888/api/tokens/status
# 返回: {"ccusageAvailable":true,"cacheTTL":"5 minutes"}
```

## 缓存策略

| 场景 | 行为 |
|------|------|
| 首次请求 | 调用 ccusage，缓存 5 分钟 |
| 5 分钟内重复请求 | 返回缓存数据 |
| 缓存过期后请求 | 重新调用 ccusage |
| 手动刷新 | 清除缓存，获取最新数据 |

## 支持的 ccusage 命令

- `daily` - 按日统计
- `weekly` - 按周统计
- `monthly` - 按月统计
- `session` - 按会话统计（已实现但未使用）

## 注意事项

1. **离线模式**: 使用 `--offline` 参数，使用本地缓存的定价数据
2. **模型定价**: 部分模型（如 MiniMax、GLM）可能没有定价信息，cost 显示为 0
3. **超时设置**: CLI 调用超时 30 秒，缓冲区 10MB
4. **错误处理**: API 失败时返回空数据，前端保持默认显示

## 更新内容 (v2)

### 1. 详情弹窗 (`TokenDetailModal.vue`)
- 点击 `</>` 按钮打开详细消耗视图
- 显示每日各模型的详细消耗表格
- 支持日/周/月/全部周期切换
- 汇总统计（总 Token、输入、输出、缓存、费用）
- 模型名称智能缩写（Sonnet 4, Opus 4, Mimo 2.5 等）

### 2. 预加载优化 (`TokensBar.vue`)
- 页面加载时**并行获取所有周期数据**（日/周/月/全部）
- 切换周期时**瞬间响应**，无网络请求
- 数据存储在内存中，切换延迟 < 1ms

### 性能对比

| 操作 | 优化前 | 优化后 |
|------|--------|--------|
| 切换周期 | 1-3 秒（调用 ccusage） | < 1ms（内存读取） |
| 首次加载 | 1-3 秒 | 3-5 秒（并行加载 4 个周期） |
| 刷新数据 | 1-3 秒 | 3-5 秒（并行刷新） |

## API 端点

```
GET  /api/tokens?period=day    → 日维度数据
GET  /api/tokens?period=week   → 周维度数据
GET  /api/tokens?period=month  → 月维度数据
GET  /api/tokens?period=all    → 全部数据
POST /api/tokens/refresh       → 强制刷新缓存
GET  /api/tokens/status        → 检查 ccusage 可用性
```
