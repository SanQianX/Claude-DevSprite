# 未路由组件：LogsView.vue

- **Review ID**: 311
- **严重程度**: info
- **文件**: web/src/views/LogsView.vue
- **行号**: 1
- **分类**: dead-code

## 问题描述
LogsView.vue 文件存在但 /logs 路由已移除，日志功能已迁移到 ConsolePanel

## 修复建议
确认无引用后可删除 LogsView.vue