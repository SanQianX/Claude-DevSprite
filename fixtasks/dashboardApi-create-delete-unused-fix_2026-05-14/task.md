# dashboardApi.createReview/deleteReview 无 UI 调用

- **Review ID**: 260
- **严重程度**: warning
- **文件**: web/src/api/dashboard.ts
- **行号**: 71
- **分类**: dead-code

## 问题描述
dashboardApi 中定义了 createReview 和 deleteReview 两个函数，后端 API 路由 dashboard.ts 也实现了对应的 POST 和 DELETE 端点，但在整个前端代码库中没有 UI 组件或 Store 调用这两个函数。审查项的创建由 AgentScanner（后台自动扫描）触发，不是用户手动创建。

## 修复建议
方案B（推荐中间方案）：在 dashboardApi 中为这两个函数添加 @deprecated 标记。方案C：移除死代码（删除前端 API 函数和后端路由）。