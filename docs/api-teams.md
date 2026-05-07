# Teams API Documentation

> 多 Agent Team 协作系统 API 参考文档
> 最后更新: 2026-05-03

## 概述

Teams API 提供多 Agent 团队的配置管理、状态查询、实时聊天和任务控制功能。所有端点均以 `/api` 为前缀，返回 JSON 格式数据。

---

## 团队配置

### 获取所有团队配置

```
GET /api/teams
```

**查询参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectPath | string | 否 | 项目路径，默认 `process.cwd()` |

**响应示例:**
```json
[
  {
    "name": "lead",
    "model": "claude-sonnet-4-20250514",
    "role": "Team Lead",
    "systemPrompt": "你是团队的领导...",
    "tools": ["Read", "Edit", "Bash"]
  },
  {
    "name": "dev",
    "model": "claude-sonnet-4-20250514",
    "role": "Developer",
    "systemPrompt": "你是开发工程师...",
    "tools": ["Read", "Edit", "Bash", "Write"]
  },
  {
    "name": "test",
    "model": "claude-sonnet-4-20250514",
    "role": "Test Engineer",
    "systemPrompt": "你是测试工程师...",
    "tools": ["Read", "Bash"]
  }
]
```

---

### 获取单个团队配置

```
GET /api/teams/:name
```

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| name | string | 团队名称: `lead`, `dev`, `test` |

**查询参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectPath | string | 否 | 项目路径 |

**响应:** 单个团队配置对象

---

### 更新团队配置

```
PUT /api/teams/:name
```

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| name | string | 团队名称 |

**请求体:**
```json
{
  "model": "claude-opus-4-20250514",
  "systemPrompt": "自定义系统提示..."
}
```

**响应:** 更新后的完整配置对象

---

### 测试团队配置

```
POST /api/teams/:name/test
```

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| name | string | 团队名称 |

**请求体:**
```json
{
  "projectPath": "D:/my-project"
}
```

**响应:**
```json
{
  "success": true,
  "team": "lead",
  "model": "claude-sonnet-4-20250514",
  "message": "Team configuration loaded successfully"
}
```

---

## 团队状态

### 获取单个团队状态

```
GET /api/teams/:name/status
```

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| name | string | 团队名称 |

**查询参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectPath | string | 否 | 项目路径 |

**响应:**
```json
{
  "team": "dev",
  "status": "busy",
  "currentTask": "task-001",
  "startedAt": "2026-05-03T01:00:00Z"
}
```

状态值: `idle` | `busy` | `error` | `offline`

---

### 获取所有团队状态

```
GET /api/teams/status/all
```

**查询参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectPath | string | 否 | 项目路径 |

**响应:**
```json
[
  { "team": "lead", "status": "idle" },
  { "team": "dev", "status": "busy", "currentTask": "task-001" },
  { "team": "test", "status": "idle" }
]
```

---

## 实时聊天

### 发送消息 (SSE 流)

```
POST /api/chat/send
```

**请求体:**
```json
{
  "message": "请帮我实现用户登录功能",
  "projectPath": "D:/my-project"
}
```

**响应:** `text/event-stream` (SSE)

每个事件格式:
```
data: {"team":"lead","content":"收到任务，正在分配...","type":"agent_message"}

data: {"team":"dev","content":"开始实现登录模块","type":"agent_message"}

data: {"team":"dev","content":"已完成 auth.ts 的编写","type":"tool_result"}
```

**事件类型:**

| type | 说明 |
|------|------|
| agent_message | Agent 文本消息 |
| tool_result | 工具执行结果 |
| task_update | 任务状态更新 |
| error | 错误信息 |
| done | 流结束标记 |

---

### 实时事件流

```
GET /api/chat/stream
```

**响应:** `text/event-stream` (SSE)

建立持久 SSE 连接，接收所有团队活动的实时推送。

初始事件:
```
data: {"type":"connected","timestamp":1683072000000}
```

后续事件由 `sseBroadcaster` 推送，包括:
- 团队状态变更
- 分析进度更新
- 聊天消息广播

---

## 任务控制

### 中止单个团队

```
POST /api/teams/:name/abort
```

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| name | string | 团队名称 |

**请求体:**
```json
{
  "projectPath": "D:/my-project"
}
```

**响应:**
```json
{
  "success": true,
  "message": "Team dev aborted"
}
```

---

### 中止所有团队

```
POST /api/teams/abort-all
```

**请求体:**
```json
{
  "projectPath": "D:/my-project"
}
```

**响应:**
```json
{
  "success": true,
  "message": "All teams aborted"
}
```

---

## 错误响应

所有端点在出错时返回统一格式:

```json
{
  "error": "错误描述信息"
}
```

**常见状态码:**

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 使用示例

### JavaScript (fetch)

```javascript
// 发送聊天消息并监听 SSE 流
const response = await fetch('/api/chat/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: '请帮我实现用户登录功能',
    projectPath: 'D:/my-project'
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value);
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const event = JSON.parse(line.slice(6));
      console.log(`[${event.team}] ${event.content}`);
    }
  }
}
```

### EventSource (SSE 监听)

```javascript
const events = new EventSource('/api/chat/stream');

events.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data);
};

events.onerror = () => {
  console.error('SSE connection error');
};
```

### cURL

```bash
# 获取所有团队配置
curl http://localhost:3000/api/teams

# 测试团队配置
curl -X POST http://localhost:3000/api/teams/dev/test \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "D:/my-project"}'

# 中止所有团队
curl -X POST http://localhost:3000/api/teams/abort-all \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "D:/my-project"}'
```

---

## 架构说明

- **TeamManager**: 核心调度器，管理团队生命周期和任务分配
- **TeamConfigManager**: 配置管理器，读写 `.claude/teams/*.yml` 配置文件
- **TeamExecutor**: CLI 执行器，通过 `child_process.spawn` 调用 Claude CLI
- **FileProtocol**: 文件通信协议，基于 inbox/outbox 的团队间通信
- **SSEBroadcaster**: 事件广播器，向所有连接的客户端推送实时事件
