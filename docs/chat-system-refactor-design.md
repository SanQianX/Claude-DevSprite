# Claude-DevSprite Chat System Refactoring - System Design Document

## Phase 1: Requirements Clarification (10+ Exploratory Questions)

### Q1: WebSocket Implementation Strategy
**Question**: Should we use `ws` library directly or `socket.io`? `socket.io` provides automatic reconnection, rooms, namespaces, and fallback to polling, but adds ~50KB bundle size. `ws` is lightweight but requires manual implementation of reconnection and message framing.

**Recommendation**: Use `ws` for backend (lightweight, no unnecessary features) + native WebSocket API on frontend with manual reconnection logic. The current SSE already handles reconnection manually, so this is consistent.

### Q2: Session Persistence
**Question**: Where should sessions be persisted? Options:
- **File-based** (JSON/SQLite) - Simple, consistent with current file-based task protocol
- **In-memory only** - Fastest, but lost on server restart
- **Database** (PostgreSQL/SQLite) - Robust but adds dependency

**Recommendation**: SQLite via existing `sql.js` dependency. The project already uses `sql.js` for knowledge storage. Sessions should survive server restarts.

### Q3: Session Scope
**Question**: Is a session scoped to a project path, or global? If a user switches projects, should they see different session lists?

**Recommendation**: Sessions scoped to `(projectPath, userId)` pair. Since there's no auth currently, scope to `projectPath` only.

### Q4: Tool Approval Flow
**Question**: When a tool call requires approval, what happens to the agent's execution?
- **Option A**: Agent pauses and waits (blocking) - Simple but wastes API tokens if timeout
- **Option B**: Agent continues with other tasks, tool result injected later - Complex but efficient
- **Option C**: Tool call is queued, agent gets a "pending" response and can decide

**Recommendation**: Option A (blocking pause) for v1. This matches OpenClaw's behavior and is simpler to implement. The CLI process can be paused by not writing the tool result file.

### Q5: Tool Approval Granularity
**Question**: Should tool approval be per-call or per-tool-type? For example, auto-approve all `Read` tools but require approval for `Write` and `Bash`?

**Recommendation**: Per-tool-type with configurable policy:
- `auto_approve`: Tools that never need approval (Read, Glob, Grep)
- `always_ask`: Tools that always need approval (Bash, Write, Edit)
- `ask_once`: Approve once per session for that tool type

### Q6: Message Ordering and Deduplication
**Question**: With WebSocket, messages can arrive out of order or be duplicated during reconnection. How do we handle this?

**Recommendation**: Each message gets a monotonically increasing `sequenceId` per session. Client tracks last seen `sequenceId` and requests missing messages on reconnection via a REST endpoint.

### Q7: Binary Data Transfer
**Question**: Should the WebSocket carry binary data (e.g., file diffs, screenshots) or only JSON messages with references?

**Recommendation**: JSON only with references. Binary data stored on server, referenced by URL. This keeps WebSocket messages small and parseable.

### Q8: Concurrent Sessions
**Question**: Can a user have multiple active sessions for the same project? Or is it one active session at a time?

**Recommendation**: Multiple sessions allowed, but only one "active" session per project that receives real-time events. User can switch active session.

### Q9: Graceful Degradation
**Question**: If WebSocket connection fails, should we fall back to SSE? Or show a disconnected state?

**Recommendation**: Show disconnected state with manual reconnect button. SSE fallback adds complexity and the current SSE implementation has issues (no message ordering, no session context).

### Q10: Message Size Limits
**Question**: What's the maximum message size for WebSocket frames? Agent outputs can be very large (full file contents, long analyses).

**Recommendation**: 1MB per frame for WebSocket. For larger payloads (e.g., full file content), chunk the message or use a REST endpoint to fetch the full content.

### Q11: Authentication and Multi-tenancy
**Question**: Currently there's no auth. Should we add basic auth for WebSocket connections? How do we prevent unauthorized access?

**Recommendation**: For v1, use a simple token-based auth. Generate a random token on server start, require it for WebSocket handshake. Store in localStorage on client.

### Q12: Agent Process Lifecycle
**Question**: When a session is abandoned (user closes browser), what happens to running agent processes?

**Recommendation**: Agent processes should be terminated after a configurable timeout (default 5 minutes) of no WebSocket connection to that session. This prevents resource leaks.

---

## Phase 2: System Architecture Design

### 2.1 Module Decomposition

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Vue 3)                        │
├─────────────────────────────────────────────────────────────┤
│  gatewayStore.ts    - WebSocket connection + session state   │
│  sessionStore.ts    - Session CRUD + message history         │
│  GatewayChat.vue    - Main chat container                    │
│  ToolApprovalCard.vue - Tool call approval UI                │
│  SessionList.vue    - Session sidebar                        │
│  NewSessionDialog.vue - Create session dialog                │
└────────────────────────┬────────────────────────────────────┘
                         │ WebSocket (ws://localhost:38888/ws)
┌────────────────────────┴────────────────────────────────────┐
│                    Backend (Express + WS)                     │
├─────────────────────────────────────────────────────────────┤
│  wsServer.ts        - WebSocket server setup                 │
│  wsHandler.ts       - Message routing + auth                 │
│  sessionManager.ts  - Session CRUD + persistence             │
│  toolApproval.ts    - Approval queue + policy engine         │
│  wsBroadcaster.ts   - Broadcast to connected clients         │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                  Core Team System (existing)                  │
├─────────────────────────────────────────────────────────────┤
│  teamManager.ts     - Orchestration (modified for WS events) │
│  teamExecutor.ts    - CLI process management                  │
│  teamConfig.ts      - Configuration loading                   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Models

#### Session
```typescript
interface Session {
  id: string;                    // UUID
  projectPath: string;           // Scoped to project
  title: string;                 // Auto-generated or user-set
  createdAt: number;             // Unix timestamp
  updatedAt: number;             // Unix timestamp
  status: 'active' | 'archived' | 'deleted';
  metadata: {
    model?: string;              // AI model used
    teamConfig?: TeamName[];     // Teams involved
    messageCount: number;
  };
}
```

#### SessionMessage
```typescript
interface SessionMessage {
  id: string;                    // UUID
  sessionId: string;             // FK to Session
  sequenceId: number;            // Monotonic per session
  type: 'user' | 'agent' | 'tool_call' | 'tool_result' | 'system' | 'error';
  team?: TeamName;               // Which agent produced this
  content: string;               // Message content
  timestamp: number;             // Unix timestamp
  metadata?: {
    toolName?: string;
    toolArgs?: Record<string, any>;
    toolCallId?: string;         // For linking tool_result to tool_call
    approvalStatus?: 'pending' | 'approved' | 'rejected';
    tokenUsage?: { prompt: number; completion: number };
  };
}
```

#### ToolApprovalRequest
```typescript
interface ToolApprovalRequest {
  id: string;                    // UUID
  sessionId: string;
  messageId: string;             // The tool_call message
  toolName: string;
  toolArgs: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: number;
  respondedAt?: number;
  response?: {
    approved: boolean;
    modifiedArgs?: Record<string, any>;  // User can modify args before approval
    reason?: string;
  };
}
```

### 2.3 WebSocket Protocol

#### Client → Server Messages
```typescript
// Authenticate
{ type: 'auth', token: string }

// Create session
{ type: 'session.create', projectPath: string, title?: string }

// Switch active session
{ type: 'session.activate', sessionId: string }

// Send chat message
{ type: 'chat.send', sessionId: string, content: string }

// Tool approval response
{ type: 'tool.approve', requestId: string, approved: boolean, modifiedArgs?: any }

// Request missed messages
{ type: 'session.sync', sessionId: string, lastSequenceId: number }

// Ping (keepalive)
{ type: 'ping' }
```

#### Server → Client Messages
```typescript
// Auth result
{ type: 'auth.result', success: boolean, clientId: string }

// Session created
{ type: 'session.created', session: Session }

// Session list
{ type: 'session.list', sessions: Session[] }

// Chat message (from agent)
{ type: 'chat.message', sessionId: string, message: SessionMessage }

// Tool call requiring approval
{ type: 'tool.call', sessionId: string, request: ToolApprovalRequest }

// Tool result (after approval)
{ type: 'tool.result', sessionId: string, messageId: string, result: string }

// Sync response
{ type: 'session.sync.result', sessionId: string, messages: SessionMessage[] }

// Error
{ type: 'error', code: string, message: string }

// Pong
{ type: 'pong' }
```

### 2.4 API Endpoints (REST - for operations that don't need real-time)

```
GET    /api/sessions                    - List sessions for project
GET    /api/sessions/:id                - Get session details
GET    /api/sessions/:id/messages       - Get message history (paginated)
DELETE /api/sessions/:id                - Archive session
PATCH  /api/sessions/:id                - Update session (title, etc.)
GET    /api/sessions/:id/messages/:seq  - Get messages after sequenceId
```

### 2.5 Technical Decisions & Trade-offs

| Decision | Choice | Trade-off |
|----------|--------|-----------|
| WebSocket library | `ws` (backend) + native (frontend) | More manual work vs smaller bundle |
| Session persistence | SQLite via `sql.js` | Consistent with existing stack vs limited concurrency |
| Tool approval | Blocking pause | Simpler vs potential timeout waste |
| Message ordering | Sequence IDs + sync endpoint | Reliable vs slight complexity |
| Auth | Simple token | Easy vs not production-grade |
| Reconnection | Manual with exponential backoff | Reliable vs more code |

---

## Phase 3: Parallel Task Assignment

### Task Group A: Backend Core (Development Agent)

**Task A1: WebSocket Server Setup**
- Add `ws` dependency
- Create `src/worker/wsServer.ts` - WebSocket server attached to Express HTTP server
- Create `src/worker/wsHandler.ts` - Message routing and auth
- Modify `src/worker/server.ts` to create HTTP server (not just `app.listen`)
- Add token-based auth for WebSocket handshake

**Task A2: Session Management**
- Create `src/worker/sessionManager.ts` - Session CRUD with SQLite persistence
- Create `src/worker/routes/sessions.ts` - REST endpoints for sessions
- Create database schema for sessions and messages
- Implement message ordering with sequence IDs

**Task A3: Tool Approval System**
- Create `src/worker/toolApproval.ts` - Approval queue and policy engine
- Modify `src/teams/teamExecutor.ts` to pause on tool calls requiring approval
- Implement approval/rejection flow via WebSocket messages
- Add configurable tool approval policies

**Task A4: Team Manager Integration**
- Modify `src/teams/teamManager.ts` to emit WebSocket events instead of SSE
- Create event bridge between TeamManager and WebSocket broadcaster
- Handle session context in chat flow
- Implement graceful agent termination on session abandonment

### Task Group B: Frontend Core (Design Agent)

**Task B1: Gateway Store**
- Create `web/src/stores/gateway.ts` - WebSocket connection management
- Create `web/src/stores/sessions.ts` - Session state and CRUD
- Implement reconnection logic with exponential backoff
- Implement message sync on reconnection

**Task B2: Chat UI Components**
- Create `web/src/components/gateway/GatewayChat.vue` - Main chat container
- Create `web/src/components/gateway/ChatInput.vue` - Terminal-style input
- Create `web/src/components/gateway/AgentMessage.vue` - Agent message display
- Create `web/src/components/gateway/SystemMessage.vue` - System messages
- Redesign message display for terminal aesthetic

**Task B3: Tool Approval UI**
- Create `web/src/components/gateway/ToolApprovalCard.vue` - Tool call display
- Create `web/src/components/gateway/ToolArgsEditor.vue` - Args modification
- Implement approve/reject buttons with loading states
- Add tool call history view

**Task B4: Session Management UI**
- Create `web/src/components/gateway/SessionList.vue` - Session sidebar
- Create `web/src/components/gateway/NewSessionDialog.vue` - Create session
- Create `web/src/components/gateway/SessionHeader.vue` - Session info bar
- Implement session switching with state preservation

**Task B5: Routing & Integration**
- Create `web/src/views/GatewayView.vue` - New chat page
- Update `web/src/router/index.ts` - Add gateway route
- Migrate from old chat view to new gateway view
- Update navigation to include session list

### Task Group C: Testing (Test Agent)

**Task C1: Backend Unit Tests**
- Test WebSocket server connection and auth
- Test session CRUD operations
- Test tool approval flow
- Test message ordering and sync

**Task C2: Frontend Unit Tests**
- Test gateway store reconnection logic
- Test session store CRUD
- Test tool approval component interactions
- Test message rendering

**Task C3: Integration Tests**
- Test full chat flow: user message → agent response → display
- Test tool approval flow: tool call → approval → result
- Test session persistence: create → restart → verify
- Test reconnection: disconnect → reconnect → sync

**Task C4: E2E Tests**
- Test complete user journey: create session → chat → approve tool → view history
- Test concurrent sessions
- Test error handling and edge cases

---

## Implementation Order

1. **Week 1**: Task A1 (WS Server) + Task B1 (Gateway Store) + Task C1 (Backend Tests)
2. **Week 2**: Task A2 (Sessions) + Task B2 (Chat UI) + Task C2 (Frontend Tests)
3. **Week 3**: Task A3 (Tool Approval) + Task B3 (Approval UI) + Task C3 (Integration)
4. **Week 4**: Task A4 (Team Integration) + Task B4-B5 (Session UI + Routing) + Task C4 (E2E)

## Risk Mitigation

1. **WebSocket stability**: Implement heartbeat (ping/pong) every 30s, auto-reconnect with backoff
2. **Memory leaks**: Limit message history in memory, paginate from SQLite
3. **Agent process leaks**: Timeout after 5min of no connection, kill orphan processes
4. **Data corruption**: Use SQLite transactions for session operations
5. **UI performance**: Virtual scrolling for message list, lazy load old messages
