# 审查修复任务同步未实现

- **Review ID**: 289
- **严重程度**: warning
- **文件**: src/worker/routes/reviews.ts
- **行号**: 304
- **分类**: missing-impl

## 问题描述
设计意图是审查项批准修复后自动创建任务并同步状态。但 POST /api/reviews/:id/fix 端点不会创建任务，任务状态不会自动更新

## 修复建议
在 fix 流程中添加任务创建逻辑，或在 fixReview 前端调用后添加任务同步