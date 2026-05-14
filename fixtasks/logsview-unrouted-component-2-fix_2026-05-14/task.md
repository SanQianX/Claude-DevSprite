# 未使用视图组件 - LogsView.vue

- **Review ID**: 269
- **严重程度**: info
- **文件**: web/src/views/LogsView.vue
- **行号**: null
- **分类**: dead-code

## 问题描述
LogsView.vue 文件存在但没有对应的路由。设计文档明确说明 /logs 路由已移除，日志功能通过 ConsolePanel 组件显示。

## 修复建议
如果 LogsView.vue 确实不再需要，可以删除该文件。