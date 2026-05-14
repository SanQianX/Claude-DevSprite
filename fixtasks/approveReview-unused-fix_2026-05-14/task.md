# 未使用的 dashboardStore.approveReview

- **Review ID**: 308
- **严重程度**: warning
- **文件**: web/src/stores/dashboard.ts
- **行号**: 79
- **分类**: dead-code

## 问题描述
dashboardStore 中定义了 approveReview() 函数，但从未被 DashboardView.vue 调用

## 修复建议
删除未使用的 approveReview 函数