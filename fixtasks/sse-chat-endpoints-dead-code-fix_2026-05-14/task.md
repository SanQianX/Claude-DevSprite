# SSE 聊天端点死代码 - POST /api/chat/send 和 GET /api/chat/stream

- **Review ID**: 275
- **严重程度**: warning
- **文件**: src/worker/routes/teams.ts
- **行号**: 145
- **分类**: dead-code

## 问题描述
teams.ts 中定义了 SSE (Server-Sent Events) 聊天端点 POST /api/chat/send 和 GET /api/chat/stream，但前端完全使用 WebSocket 进行通信，从不调用这些端点。设计文档明确标记为遗留端点。

## 修复建议
删除 teams.ts 第 145-206 行的 SSE 相关端点，或标记为 @deprecated。