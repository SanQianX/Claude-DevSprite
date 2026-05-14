# 功能缺失: 审查修复不会自动创建/同步任务

- **Review ID**: 297
- **严重程度**: warning
- **文件**: web/src/stores/dashboard.ts
- **行号**: 89
- **分类**: missing-impl

## 问题描述
设计意图是审查批准修复后自动创建任务或更新任务状态，但实际上审查修复不会自动创建任务。dashboardStore.fixReview 调用了 fetchTasks 只是刷新不是自动创建

## 修复建议
在 fixReview 中添加自动创建关联任务的逻辑