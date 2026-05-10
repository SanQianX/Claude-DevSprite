# Claude-DevSprite Chat System Refactoring - Final Design Document

> **Version**: 2.0 (Post-Critical Review)
> **Date**: 2026-05-08
> **Status**: Ready for User Confirmation

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-05-08 | Initial design |
| 2.0 | 2026-05-08 | Updated based on Developer critical review |

### Key Changes in v2.0

1. **Tool Approval**: Changed from "blocking approval" to "display-only" (CLI cannot be paused)
2. **Task Merging**: Merged A1+A2, moved A4 prototype to Week 1
3. **Component Reuse**: Reuse existing `chat/` components, no new `gateway/` directory
4. **Persistence**: Changed from `sql.js` to `better-sqlite3` or JSON files
5. **Session Scope**: Clarified `session.activate` is per-connection level
6. **Event Mapping**: Added `ChatEvent` → `SessionMessage` mapping
7. **Authentication**: Removed token auth for v1 (localhost local tool)

---

## Phase 1: Requirements Clarification (Final Decisions)

### Q1: WebSocket Implementation Strategy
**Decision**: Use `ws` for backend + native WebSocket API on frontend.

**Rationale**:
- Lightweight, no unnecessary features
- Current SSE already handles reconnection manually
- Consistent with existing codebase style

### Q2: Session Persistence
**Decision**: Use `better-sqlite3` (native Node.js SQLite binding) or JSON files.

**Rationale**:
- `sql.js` is WASM-based, has concurrency limitations
- `better-sqlite3` is faster and more reliable for Node.js
- JSON files as fallback if SQLite complexity is not needed

**Updated from v1.0**: Changed from `sql.js` to `better-sqlite3` or JSON files.

### Q3: Session Scope
**Decision**: Sessions scoped to `projectPath`. `session.activate` is per-connection level.

**Rationale**:
- Each WebSocket connection maintains its own active session
- Multiple browser tabs can have different active sessions
- Server broadcasts to all connections watching a session

**Updated from v1.0**: Clarified per-connection scope.

### Q4: Tool Approval Flow
**Decision**: v1 = Display-only (no approval). Show tool calls in UI but cannot block CLI.

**Rationale**:
- CLI processes cannot be paused mid-execution
- Attempting to pause would require complex IPC and timeout handling
- Display-only provides visibility without complexity

**Updated from v1.0**: Changed from "blocking approval" to "display-only".

### Q5: Tool Display Granularity
**Decision**: Display all tool calls with details (name, args, result).

**Rationale**:
- Users can see what agents are doing
- No approval overhead
- Foundation for future approval system

### Q6: Message Ordering and Deduplication
**Decision**: Monotonic `sequenceId` per session + REST sync endpoint.

**Rationale**:
- Reliable message ordering
- Simple deduplication on reconnection
- Consistent with existing patterns

### Q7: Binary Data Transfer
**Decision**: JSON only with references.

**Rationale**:
- Keeps WebSocket messages small and parseable
- Binary data stored on server, referenced by URL

### Q8: Concurrent Sessions
**Decision**: Multiple sessions allowed, per-connection active session.

**Rationale**:
- Each browser tab can watch different sessions
- Server tracks which connections are watching which sessions

### Q9: Graceful Degradation
**Decision**: Show disconnected state with manual reconnect button.

**Rationale**:
- No SSE fallback (adds complexity)
- Current SSE has issues (no ordering, no session context)

### Q10: Message Size Limits
**Decision**: 1MB per WebSocket frame.

**Rationale**:
- Large payloads use REST endpoint
- Keeps WebSocket responsive

### Q11: Authentication
**Decision**: v1 = No authentication (localhost only).

**Rationale**:
- Local development tool
- Runs on localhost only
- Can add auth in future version

**Updated from v1.0**: Removed token auth for v1.

### Q12: Agent Process Lifecycle
**Decision**: Configurable timeout (default 5 minutes).

**Rationale**:
- Prevents resource leaks
- Configurable for different use cases

---

## Phase 2: System Architecture Design

### 2.1 Module Decomposition (Updated)

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Vue 3)                        │
├─────────────────────────────────────────────────────────────┤
│  stores/gateway.ts      - WebSocket connection management    │
│  stores/sessions.ts     - Session state + message history    │
│  components/chat/       - REUSE existing components          │
│    ChatMessage.vue      - Modified for session messages      │
│    ChatInput.vue        - Reuse as-is                       │
│    ChatMessageList.vue  - Modified for session messages      │
│  components/chat/       - NEW components                     │
│    ToolCallCard.vue     - Tool call display (new)            │
│    SessionList.vue      - Session sidebar (new)              │
│    NewSessionDialog.vue - Create session dialog (new)        │
└────────────────────────┬────────────────────────────────────┘
                         │ WebSocket (ws://localhost:38888/ws)
┌────────────────────────┴────────────────────────────────────┐
│                    Backend (Express + WS)                     │
├─────────────────────────────────────────────────────────────┤
│  wsServer.ts        - WebSocket server setup                 │
│  wsHandler.ts       - Message routing (no auth)              │
│  sessionManager.ts  - Session CRUD + persistence             │
│  wsBroadcaster.ts   - Broadcast to connected clients         │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                  Core Team System (existing)                  │
├─────────────────────────────────────────────────────────────┤
│  teamManager.ts     - Modified to emit WS events             │
│  teamExecutor.ts    - CLI process management (unchanged)     │
│  teamConfig.ts      - Configuration loading (unchanged)      │
└─────────────────────────────────────────────────────────────┘
```

**Updated from v1.0**:
- Reuse existing `chat/` components instead of creating new `gateway/` directory
- Removed `toolApproval.ts` (no approval in v1)
- Removed auth from `wsHandler.ts`

### 2.2 Data Models (Updated)

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
    tokenUsage?: { prompt: number; completion: number };
  };
}
```

**Updated from v1.0**: Removed `approvalStatus` from metadata (no approval in v1).

#### ChatEvent → SessionMessage Mapping
```typescript
/**
 * Maps existing ChatEvent to new SessionMessage format
 * Ensures backward compatibility with existing chat system
 */
function mapChatEventToSessionMessage(event: ChatEvent, sessionId: string, sequenceId: number): SessionMessage {
  return {
    id: generateUUID(),
    sessionId,
    sequenceId,
    type: mapChatEventType(event.type),
    team: event.team as TeamName,
    content: event.content,
    timestamp: Date.now(),
    metadata: {
      toolName: event.metadata?.toolName,
      toolArgs: event.metadata?.toolArgs,
      tokenUsage: event.metadata?.tokenUsage,
    },
  };
}

function mapChatEventType(eventType: string): SessionMessage['type'] {
  switch (eventType) {
    case 'agent_message': return 'agent';
    case 'tool_call': return 'tool_call';
    case 'tool_result': return 'tool_result';
    case 'error': return 'error';
    case 'completed': return 'system';
    default: return 'system';
  }
}
```

**Updated from v1.0**: Added ChatEvent → SessionMessage mapping.

### 2.3 WebSocket Protocol (Updated)

#### Client → Server Messages
```typescript
// Create session
{ type: 'session.create', projectPath: string, title?: string }

// Switch active session (per-connection)
{ type: 'session.activate', sessionId: string }

// Send chat message
{ type: 'chat.send', sessionId: string, content: string }

// Request missed messages
{ type: 'session.sync', sessionId: string, lastSequenceId: number }

// Ping (keepalive)
{ type: 'ping' }
```

**Updated from v1.0**: Removed `auth` and `tool.approve` messages.

#### Server → Client Messages
```typescript
// Session created
{ type: 'session.created', session: Session }

// Session list
{ type: 'session.list', sessions: Session[] }

// Chat message (from agent)
{ type: 'chat.message', sessionId: string, message: SessionMessage }

// Tool call (display only, no approval)
{ type: 'tool.call', sessionId: string, message: SessionMessage }

// Tool result
{ type: 'tool.result', sessionId: string, message: SessionMessage }

// Sync response
{ type: 'session.sync.result', sessionId: string, messages: SessionMessage[] }

// Error
{ type: 'error', code: string, message: string }

// Pong
{ type: 'pong' }
```

**Updated from v1.0**: Removed `auth.result`, changed `tool.call` to display-only.

### 2.4 API Endpoints (REST)

```
GET    /api/sessions                    - List sessions for project
GET    /api/sessions/:id                - Get session details
GET    /api/sessions/:id/messages       - Get message history (paginated)
DELETE /api/sessions/:id                - Archive session
PATCH  /api/sessions/:id                - Update session (title, etc.)
GET    /api/sessions/:id/messages/:seq  - Get messages after sequenceId
```

### 2.5 Technical Decisions & Trade-offs (Updated)

| Decision | Choice | Trade-off | Rationale |
|----------|--------|-----------|-----------|
| WebSocket library | `ws` (backend) + native (frontend) | More manual work vs smaller bundle | Consistent with existing patterns |
| Session persistence | `better-sqlite3` or JSON files | Performance vs simplicity | Better than sql.js for Node.js |
| Tool display | Display-only (no approval) | Less control vs simpler | CLI cannot be paused |
| Message ordering | Sequence IDs + sync endpoint | Reliable vs slight complexity | Proven pattern |
| Auth | None (v1) | Less security vs simpler | Localhost only |
| Reconnection | Manual with exponential backoff | Reliable vs more code | Consistent with SSE |
| Component reuse | Extend existing chat/ | Less new code vs potential coupling | Reduces development time |

**Updated from v1.0**: Updated tool approval and auth decisions.

---

## Phase 3: Parallel Task Assignment (Updated)

### Task Group A: Backend Core (Development Agent)

**Task A1: WebSocket Server + Session Management (Merged)**
- Add `ws` dependency
- Create `src/worker/wsServer.ts` - WebSocket server attached to Express HTTP server
- Create `src/worker/wsHandler.ts` - Message routing (no auth)
- Create `src/worker/sessionManager.ts` - Session CRUD with `better-sqlite3` or JSON
- Create `src/worker/routes/sessions.ts` - REST endpoints for sessions
- Modify `src/worker/server.ts` to create HTTP server
- Implement message ordering with sequence IDs

**Task A2: Team Manager Integration + Prototype (Moved to Week 1)**
- Modify `src/teams/teamManager.ts` to emit WebSocket events
- Create event bridge between TeamManager and WebSocket broadcaster
- Add `ChatEvent` → `SessionMessage` mapping
- Prototype: Basic chat flow working end-to-end

**Task A3: Tool Display System**
- Create `src/worker/toolDisplay.ts` - Tool call display logic
- Modify event bridge to handle tool_call and tool_result events
- Ensure tool calls are properly captured and sent to clients

**Updated from v1.0**:
- Merged A1+A2 into single task
- Moved A4 prototype to Week 1 (now A2)
- Removed tool approval (replaced with display)

### Task Group B: Frontend Core (Design Agent)

**Task B1: Gateway Store**
- Create `web/src/stores/gateway.ts` - WebSocket connection management
- Create `web/src/stores/sessions.ts` - Session state and CRUD
- Implement reconnection logic with exponential backoff
- Implement message sync on reconnection

**Task B2: Chat UI Components (Reuse Existing)**
- Modify `web/src/components/chat/ChatMessage.vue` - Support session messages
- Modify `web/src/components/chat/ChatMessageList.vue` - Support session messages
- Reuse `web/src/components/chat/ChatInput.vue` as-is
- Create `web/src/components/chat/ToolCallCard.vue` - Tool call display (new)

**Task B3: Session Management UI**
- Create `web/src/components/chat/SessionList.vue` - Session sidebar
- Create `web/src/components/chat/NewSessionDialog.vue` - Create session
- Create `web/src/components/chat/SessionHeader.vue` - Session info bar
- Implement session switching with state preservation

**Task B4: Routing & Integration**
- Modify `web/src/views/DevChatView.vue` - Add session support
- Update `web/src/router/index.ts` - Add session routes
- Update navigation to include session list

**Updated from v1.0**:
- Reuse existing chat/ components
- Removed gateway/ directory
- Reduced number of new components

### Task Group C: Testing (Test Agent)

**Task C1: Backend Unit Tests**
- Test WebSocket server connection
- Test session CRUD operations
- Test message ordering and sync
- Test ChatEvent → SessionMessage mapping

**Task C2: Frontend Unit Tests**
- Test gateway store reconnection logic
- Test session store CRUD
- Test tool call component rendering
- Test message rendering

**Task C3: Integration Tests**
- Test full chat flow: user message → agent response → display
- Test tool call display: tool call → display in UI
- Test session persistence: create → restart → verify
- Test reconnection: disconnect → reconnect → sync

**Task C4: E2E Tests**
- Test complete user journey: create session → chat → view history
- Test concurrent sessions
- Test error handling and edge cases

**Updated from v1.0**: Removed tool approval tests, added tool display tests.

---

## Implementation Order (Updated)

### Week 1: Foundation + Prototype
- **Task A1**: WebSocket Server + Session Management (merged)
- **Task A2**: Team Manager Integration + Prototype
- **Task B1**: Gateway Store
- **Task C1**: Backend Unit Tests

**Goal**: Basic chat working end-to-end with sessions.

### Week 2: UI Enhancement
- **Task A3**: Tool Display System
- **Task B2**: Chat UI Components (reuse existing)
- **Task B3**: Session Management UI
- **Task C2**: Frontend Unit Tests

**Goal**: Full UI with tool call display and session management.

### Week 3: Integration & Polish
- **Task B4**: Routing & Integration
- **Task C3**: Integration Tests
- **Task C4**: E2E Tests

**Goal**: Production-ready system with full test coverage.

**Updated from v1.0**: Compressed from 4 weeks to 3 weeks.

---

## Risk Mitigation (Updated)

1. **WebSocket stability**: Implement heartbeat (ping/pong) every 30s, auto-reconnect with backoff
2. **Memory leaks**: Limit message history in memory, paginate from storage
3. **Agent process leaks**: Timeout after 5min of no connection, kill orphan processes
4. **Data corruption**: Use transactions for session operations (if using SQLite)
5. **UI performance**: Virtual scrolling for message list, lazy load old messages
6. **Component reuse**: Carefully extend existing components to avoid breaking changes

**Updated from v1.0**: Added component reuse risk.

---

## Appendix: File Changes Summary

### New Files
```
src/worker/wsServer.ts
src/worker/wsHandler.ts
src/worker/sessionManager.ts
src/worker/toolDisplay.ts
src/worker/routes/sessions.ts
web/src/stores/gateway.ts
web/src/stores/sessions.ts
web/src/components/chat/ToolCallCard.vue
web/src/components/chat/SessionList.vue
web/src/components/chat/NewSessionDialog.vue
web/src/components/chat/SessionHeader.vue
```

### Modified Files
```
src/worker/server.ts              - Create HTTP server for WS
src/teams/teamManager.ts          - Emit WS events
web/src/components/chat/ChatMessage.vue      - Support session messages
web/src/components/chat/ChatMessageList.vue  - Support session messages
web/src/views/DevChatView.vue     - Add session support
web/src/router/index.ts           - Add session routes
```

### Unchanged Files
```
src/teams/teamExecutor.ts         - CLI process management
src/teams/teamConfig.ts           - Configuration loading
web/src/components/chat/ChatInput.vue        - Reuse as-is
web/src/stores/chat.ts            - Keep for backward compatibility
web/src/api/teams.ts              - Keep for backward compatibility
```

---

## Success Criteria

1. ✅ WebSocket connection established and stable
2. ✅ Sessions can be created, listed, and switched
3. ✅ Chat messages sent and received via WebSocket
4. ✅ Tool calls displayed in real-time
5. ✅ Message history persisted across server restarts
6. ✅ Reconnection works with message sync
7. ✅ Existing chat functionality preserved (backward compatible)

---

## Open Questions for User Confirmation

1. **Storage choice**: `better-sqlite3` (more robust) or JSON files (simpler)?
2. **Session title**: Auto-generate from first message, or let user set?
3. **Tool call display**: Show in main chat flow, or separate panel?
4. **Session limit**: Maximum number of sessions per project?

---

*This document is ready for user confirmation. Please review and approve before implementation begins.*
