# dashboardStore.approveReview 函数无 UI 调用

- **Review ID**: 261
- **严重程度**: warning
- **文件**: web/src/stores/dashboard.ts
- **行号**: 79
- **分类**: dead-code

## 问题描述
dashboardStore 中定义了 approveReview 函数，该函数调用 PUT /api/projects/:name/reviews/:id 将审查状态更新为 approved。但在 DashboardView.vue 或其他任何 UI 组件中，没有按钮或操作触发 approveReview。实际 UI 中，'批准修复' 按钮触发的是 fixReview，'忽略' 按钮触发的是 ignoreReview。

## 修复建议
方案A（推荐）：移除 approveReview 函数。方案C：保留但添加 @deprecated 注释说明此函数从未被 UI 调用。