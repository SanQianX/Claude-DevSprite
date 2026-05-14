# LogsView.vue 文件存在但 /logs 路由已移除

- **Review ID**: 315
- **严重程度**: info
- **文件**: web/src/views/LogsView.vue
- **行号**: 1
- **分类**: dead-code

## 问题描述
LogsView.vue 文件存在于 web/src/views/ 目录，但 /logs 路由已从路由配置中移除。根据设计文档，日志功能现在通过首页底部的 ConsolePanel 组件提供。

## 修复建议
删除无引用的 LogsView.vue 文件。