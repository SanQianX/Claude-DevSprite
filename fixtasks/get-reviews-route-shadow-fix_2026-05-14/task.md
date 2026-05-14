# GET /reviews 路由被遮蔽

- **Review ID**: 283
- **严重程度**: warning
- **文件**: src/worker/routes/dashboard.ts
- **行号**: 110
- **分类**: api-mismatch

## 问题描述
dashboard.ts 和 reviews.ts 都定义了 GET /api/projects/:name/reviews 路由。dashboard.ts 先注册，遮蔽了 reviews.ts 支持 ?status 过滤的版本

## 修复建议
将 reviews.ts 的 status 过滤功能合并到 dashboard.ts 版本，或调整路由注册顺序