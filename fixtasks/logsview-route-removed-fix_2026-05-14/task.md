# LogsView.vue 组件存在但路由已移除

- **Review ID**: 279
- **严重程度**: warning
- **文件**: web/src/views/LogsView.vue
- **行号**: null
- **分类**: dead-code

## 问题描述
web/src/views/LogsView.vue 文件存在（用于显示日志视图），但在前端路由配置 web/src/router/index.ts 中没有对应的 /logs 路由。根据 FUNCTIONAL-LOGIC-ANALYSIS.md 文档，/logs 路由已移除，日志功能通过首页底部的 ConsolePanel 组件显示。

## 修复建议
删除 web/src/views/LogsView.vue 文件，因为日志功能已通过 ConsolePanel 实现，不再需要独立的日志视图页面。