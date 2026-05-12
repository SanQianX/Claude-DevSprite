# 04. 根本原因分析

## 问题本质

三个问题的根本原因相同：**后端 API 已实现，但前端 UI 层断裂** — API 客户端缺少方法定义，或方法已定义但没有组件调用。

## 详细分析

### 问题 1: 审查扫描 — API 客户端缺失

```
后端: POST /api/projects/:name/reviews/scan  ✅ 已实现
         ↓
前端 API: dashboard.ts                       ❌ 无 triggerScan()
         ↓
前端 Store: dashboard.ts                     ❌ 无 triggerScan()
         ↓
前端 UI: DashboardView.vue                   ❌ 无扫描按钮
```

**断裂点**: `dashboard.ts` API 客户端没有定义 `triggerScan()` 方法。

**为什么没发现**: 扫描功能是后来添加的后端端点，但前端没有同步更新。开发时可能只通过 curl 测试了后端。

### 问题 2: 批准修复 — 错误的 API 调用

```
用户点击 [批准修复]
         ↓
DashboardView.approveReview(id)
         ↓
dashboardStore.approveReview(projectName, id)
         ↓
dashboardApi.updateReview(projectName, id, { status: 'approved' })
         ↓
PUT /api/projects/:name/reviews/:id  ← 只更新 status 字段
         ↓
❌ 没有调用 POST /api/reviews/:id/fix
```

**断裂点**: `approveReview` 函数名暗示"批准并修复"，但实际只做了"批准"(更新状态)。

**为什么没发现**:
1. 函数名 `approveReview` 具有误导性 — 开发者可能以为批准就是修复
2. 后端有两个独立端点: `PUT /:id/approve` (只设状态) 和 `POST /:id/fix` (实际修复)
3. 前端调用了错误的端点

### 问题 3: 项目分析 — API 已定义但未使用

```
后端: POST /api/projects/:name/analyze/full   ✅ 已实现
         ↓
前端 API: analysis.ts                          ✅ triggerFullAnalysis() 已定义
         ↓
前端组件: ❌ 没有任何组件调用 triggerFullAnalysis()
```

**断裂点**: API 方法已定义，但没有 UI 入口调用它。

**为什么没发现**:
1. 分析功能可能通过其他方式触发 (如 CLI 或 curl)
2. ProjectCard 显示分析状态 (从 SSE 读取)，但没有触发按钮
3. 开发者可能认为分析是后台自动运行的，不需要手动触发

## 架构层面的问题

```
┌─────────────────────────────────────────────────────────────────────┐
│                        断裂模式分析                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                 │
│  模式 1: 后端实现 → 前端 API 缺失 (审查扫描)                       │
│  ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐                   │
│  │ 后端 │───→│ API  │ ✗  │ Store│    │  UI  │                   │
│  │ 端点 │    │ 客户端│    │      │    │      │                   │
│  └──────┘    └──────┘    └──────┘    └──────┘                   │
│                                                                 │
│  模式 2: 前端调用错误端点 (批准修复)                               │
│  ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐                   │
│  │  UI  │───→│Store │───→│ API  │───→│ PUT  │ ← 应该调 POST     │
│  │ 按钮 │    │      │    │      │    │ /fix │                   │
│  └──────┘    └──────┘    └──────┘    └──────┘                   │
│                                                                 │
│  模式 3: API 已定义但无调用者 (项目分析)                           │
│  ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐                   │
│  │ 后端 │───→│ API  │    │Store │    │  UI  │                   │
│  │ 端点 │    │ 已定义│ ✗  │      │    │ 无按钮│                   │
│  └──────┘    └──────┘    └──────┘    └──────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

## 为什么代码审查没有发现

1. **后端测试覆盖**: 后端端点有单元测试，但只测试 API 响应，不测试前端调用链
2. **前端测试缺失**: 没有 E2E 测试验证"点击按钮 → API 调用 → 结果显示"的完整流程
3. **代码审查盲区**: 审查时关注单个文件的正确性，忽略了跨层的调用链完整性

## 修复策略

| 问题 | 修复方式 | 涉及文件 |
|------|----------|----------|
| 审查扫描 | 添加 API 方法 + Store 方法 + UI 按钮 | dashboard.ts, DashboardView.vue |
| 批准修复 | 添加 fixReview API + 修改 store 逻辑 | dashboard.ts, DashboardView.vue |
| 项目分析 | 添加 UI 按钮调用已有 API | DashboardView.vue |
