# 审查修复 → 任务创建未实现

- **Review ID**: 304
- **严重程度**: warning
- **文件**: src/worker/routes/reviews.ts
- **行号**: 304
- **分类**: missing-impl

## 问题描述
审查项批准修复后，不会自动创建任务。设计意图是修复完成后自动同步到任务列表

## 修复建议
在 POST /reviews/:id/fix 成功后调用创建任务 API