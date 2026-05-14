# approveReview 前端有定义但无 UI 触发

- **Review ID**: 301
- **严重程度**: warning
- **文件**: web/src/stores/dashboard.ts
- **行号**: 79
- **分类**: dead-code

## 问题描述
dashboardStore 中定义了 approveReview() 函数，但 DashboardView.vue 中无按钮调用它

## 修复建议
删除未使用的 approveReview 函数，或补充 UI 触发