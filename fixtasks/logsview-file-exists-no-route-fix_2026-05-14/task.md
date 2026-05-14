# LogsView.vue 文件存在但无路由映射

- **Review ID**: 259
- **严重程度**: warning
- **文件**: web/src/views/LogsView.vue
- **行号**: 1
- **分类**: dead-code

## 问题描述
LogsView.vue 文件存在且功能完整（包含日志工具栏、级别过滤、自动刷新、SSE连接状态等），但前端路由配置 (web/src/router/index.ts) 中不存在 /logs 路径。根据设计文档 FUNCTIONAL-LOGIC-ANALYSIS.md Module 6 的描述，/logs 路由已被移除，日志功能已迁移到首页底部的 ConsolePanel 组件。

## 修复建议
方案B（推荐）：删除 LogsView.vue 文件及清理相关依赖。方案A：恢复 /logs 路由（如果 LogsView 功能仍需独立页面）。