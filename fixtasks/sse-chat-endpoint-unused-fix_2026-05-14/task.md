# 死代码: POST /api/chat/send SSE 端点未被使用

- **Review ID**: 292
- **严重程度**: warning
- **文件**: src/worker/routes/teams.ts
- **行号**: null
- **分类**: dead-code

## 问题描述
后端 teams.ts 中存在 POST /api/chat/send SSE 端点，但前端完全使用 WebSocket 通信，从未调用此 SSE 端点

## 修复建议
删除 SSE 端点，保留 WebSocket 通信