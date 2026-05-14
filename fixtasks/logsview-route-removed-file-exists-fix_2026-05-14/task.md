# LogsView.vue 已从路由中移除但文件仍存在

- **Review ID**: 271
- **严重程度**: warning
- **文件**: web/src/views/LogsView.vue
- **行号**: 1
- **分类**: dead-code

## 问题描述
LogsView.vue 文件存在于 web/src/views/ 目录中，但在 web/src/router/index.ts 中没有对应的路由。根据设计文档，/logs 路由已移除，日志功能通过首页底部的 ConsolePanel 组件显示。

## 修复建议
删除 LogsView.vue 文件，以及相关的 api/logs.ts、stores/logs.ts。如果日志功能需要保留为独立页面，则添加对应路由。