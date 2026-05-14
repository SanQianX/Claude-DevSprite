# 路由重复 - dashboard.ts 和 reviews.ts 各自实现了相同的 /api/projects/:name/reviews 端点

- **Review ID**: 266
- **严重程度**: warning
- **文件**: src/worker/routes/dashboard.ts
- **行号**: 110
- **分类**: api-mismatch

## 问题描述
存在两个实现相同功能的 API 路由：dashboard.ts:110 和 reviews.ts:149 都定义了 GET /api/projects/:name/reviews 端点。由于 registerDashboardRoutes 在 registerReviewRoutes 之前被调用，dashboard 路由会先匹配，导致 reviews.ts 中的实现实际上永远不会被访问到。

## 修复建议
删除 dashboard.ts 中的重复 reviews 端点（第 106-118 行），保留 reviews.ts 中的实现因为它返回更完整的响应格式 { reviews }