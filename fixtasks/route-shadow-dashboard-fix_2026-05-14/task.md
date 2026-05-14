# 路由遮蔽：dashboard.ts 遮蔽 reviews.ts

- **Review ID**: 309
- **严重程度**: warning
- **文件**: src/worker/routes/index.ts
- **行号**: 36
- **分类**: api-mismatch

## 问题描述
Express 路由注册顺序导致 dashboard.ts 的 /api/projects/:name/reviews 先匹配，遮蔽 reviews.ts 中支持 ?status 过滤的版本

## 修复建议
调整 index.ts 中路由注册顺序，使 reviews.ts 先注册，或合并两者的逻辑