# POST /api/chat/send SSE 端点未被使用

- **Review ID**: 284
- **严重程度**: warning
- **文件**: src/worker/routes/teams.ts
- **行号**: 145
- **分类**: dead-code

## 问题描述
teams.ts 第 145 行实现了 POST /api/chat/send SSE 端点，但前端完全使用 WebSocket 通信，从未调用此端点。aiProvider.ts 第 103 行注释说明这是 deprecated 遗留端点

## 修复建议
删除 teams.ts 中的 SSE 端点实现