# 路由冲突：dashboard.ts 遮蔽 reviews.ts 的 GET /reviews

- **Review ID**: 300
- **严重程度**: warning
- **文件**: src/worker/routes/dashboard.ts + reviews.ts
- **行号**: 110
- **分类**: api-mismatch

## 问题描述
两个文件都定义了 GET /api/projects/:name/reviews，Express first-match 导致 dashboard.ts 版本遮蔽 reviews.ts 版本

## 修复建议
移除 dashboard.ts 中的重复 reviews 路由，或调整注册顺序让 reviews.ts 先注册