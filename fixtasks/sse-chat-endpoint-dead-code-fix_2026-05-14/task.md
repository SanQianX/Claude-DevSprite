# 死代码端点：POST /api/chat/send (SSE)

- **Review ID**: 310
- **严重程度**: info
- **文件**: src/worker/routes/teams.ts
- **行号**: 147
- **分类**: dead-code

## 问题描述
后端存在 POST /api/chat/send SSE 端点，但前端完全使用 WebSocket 通信

## 修复建议
确认无引用后可删除此端点