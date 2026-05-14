# POST /api/chat/send SSE 端点成为死代码

- **Review ID**: 278
- **严重程度**: warning
- **文件**: src/worker/routes/teams.ts
- **行号**: 147
- **分类**: dead-code

## 问题描述
POST /api/chat/send 端点实现了一个 SSE（Server-Sent Events）方式的聊天接口，但前端已经完全使用 WebSocket 方式进行聊天通信，不再使用这个 SSE 端点。该端点在 aiProvider.ts:103 被明确标记为 deprecated。

## 修复建议
如果确定不再需要 SSE 方案，可以删除 src/worker/routes/teams.ts 第144-183行的 POST /api/chat/send 路由；或保留作为备用但添加 DEPRECATED 标记。