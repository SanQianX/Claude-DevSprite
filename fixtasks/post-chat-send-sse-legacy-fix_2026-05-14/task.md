# POST /api/chat/send SSE 端点是遗留代码

- **Review ID**: 262
- **严重程度**: warning
- **文件**: src/worker/routes/teams.ts
- **行号**: 147
- **分类**: dead-code

## 问题描述
src/worker/routes/teams.ts 定义了 POST /api/chat/send 端点，这是一个基于 SSE (Server-Send Events) 的聊天接口。但根据设计文档说明，前端完全使用 WebSocket 通信，此 SSE 端点从未被前端调用。实际的聊天功能使用 WebSocket (web/src/api/websocket.ts)，前端通过 wsHandler.ts 进行双向实时通信。

## 修复建议
方案A（推荐）：移除 SSE 端点 (POST /api/chat/send) 并更新相关文档。方案B：保留作为后备方案但添加注释说明。