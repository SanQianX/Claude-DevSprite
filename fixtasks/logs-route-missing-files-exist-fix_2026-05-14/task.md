# 前端路由缺失：/logs 相关文件存在但未被路由使用

- **Review ID**: 258
- **严重程度**: warning
- **文件**: web/src/router/index.ts
- **行号**: 1
- **分类**: dead-code

## 问题描述
根据设计决策 /logs 路由已被移除，但 web/src/views/LogsView.vue、web/src/api/logs.ts、web/src/stores/logs.ts 等文件仍存在且未被任何地方引用。

## 修复建议
如果日志功能不再需要，删除 LogsView.vue、logs.ts API、logs.ts store 和后端 logs.ts 路由。如果需要，将日志组件集成到其他位置。