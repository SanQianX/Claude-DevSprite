# 路由冲突: GET /reviews 被 dashboard.ts 版本遮蔽

- **Review ID**: 298
- **严重程度**: warning
- **文件**: src/worker/routes/dashboard.ts
- **行号**: null
- **分类**: api-mismatch

## 问题描述
两个路由文件都定义了 GET /api/projects/:name/reviews：dashboard.ts 和 reviews.ts。Express 按顺序匹配，dashboard.ts 先注册遮蔽了 reviews.ts 的版本

## 修复建议
合并路由或明确分工，将 reviews.ts 的 status 过滤功能合并