# reviews.ts 路由被 dashboard.ts 遮蔽

- **Review ID**: 312
- **严重程度**: warning
- **文件**: src/worker/routes/reviews.ts
- **行号**: 137
- **分类**: api-mismatch

## 问题描述
reviews.ts 中定义的 GET /api/projects/:name/reviews 路由被 dashboard.ts 中相同路径的路由遮蔽。Express 按顺序匹配，dashboard.ts 先注册，导致 reviews.ts 中的路由永远无法被访问。

## 修复建议
删除 dashboard.ts 中的重复路由，保留 reviews.ts 支持 status 过滤的版本。