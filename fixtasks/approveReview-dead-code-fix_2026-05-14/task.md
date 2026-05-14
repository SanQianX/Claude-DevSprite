# 死代码: dashboardStore.approveReview 函数未被调用

- **Review ID**: 299
- **严重程度**: warning
- **文件**: web/src/stores/dashboard.ts
- **行号**: 79
- **分类**: dead-code

## 问题描述
dashboardStore.approveReview() 函数已定义，但没有 Vue 组件调用此函数。前端实际使用 fixReview() 而非 approveReview()

## 修复建议
删除 approveReview 函数，或确认其设计意图后实现对它的调用