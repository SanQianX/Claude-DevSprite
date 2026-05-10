# Claude-DevSprite Chat System Redesign - System Design Specification

## Document Information

- **Version**: 1.0.0
- **Date**: 2026-05-08
- **Author**: Design Agent
- **Status**: Draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Analysis](#2-current-architecture-analysis)
3. [Target Architecture Overview](#3-target-architecture-overview)
4. [Module Design](#4-module-design)
5. [WebSocket Message Protocol](#5-websocket-message-protocol)
6. [Database Schema](#6-database-schema)
7. [Frontend Component Design](#7-frontend-component-design)
8. [State Management Design](#8-state-management-design)
9. [API Interface Design](#9-api-interface-design)
10. [Technical Trade-offs](#10-technical-trade-offs)
11. [Risk Assessment & Mitigation](#11-risk-assessment--mitigation)
12. [Implementation Roadmap](#12-implementation-roadmap)

---

## 1. Executive Summary

### 1.1 Background

The current Claude-DevSprite chat system uses SSE (Server-Sent Events) for one-way server-to-client communication. This design has several limitations:

- **No bidirectional communication**: Client cannot send structured messages (e.g., tool approval responses) over the same channel
- **No session management**: Chat history exists only in browser memory (Pinia store), lost on page refresh
- **No tool approval workflow**: Tool calls execute immediately without user consent
- **No conversation persistence**: No database storage for chat sessions

### 1.2 Design Goals

1. **WebSocket Gateway**: Replace SSE with WebSocket for full-duplex communication
2. **Session Management**: CRUD operations for chat sessions with persistence
3. **Tool Approval**: Display tool calls and require user approval before execution
4. **Terminal-style UI**: Redesigned chat interface with terminal aesthetics
5. **State Management**: New Pinia stores for gateway and session state

### 1.3 Scope

| In Scope | Out of Scope |
|----------|-------------|
| WebSocket server implementation | Claude CLI internal changes |
| Session CRUD + SQLite persistence | Multi-user authentication |
| Tool approval workflow | File upload/download via WebSocket |
| New frontend components | Mobile responsive design |
| Gateway state store | Performance optimization beyond basics |

---

## 2. Current Architecture Analysis

### 2.1 System Components

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (Vue 3)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ ChatView │  │ ChatStore│  │  TeamsStore       │  │
│  │          │  │ (Pinia)  │  │  (Polling 5s)     │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │              │                  │             │
│       │         EventSource(SSE)    fetch()          │
└───────┼──────────────┼──────────────────┼────────────┘
        │              │                  │
        ▼              ▼                  ▼
┌─────────────────────────────────────────────────────┐
│              Express.js Server (port 38888)           │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ POST     │  │ GET          │  │ REST API      │  │
│  │ /chat/   │  │ /chat/stream │  │ /teams/*      │  │
│  │ send     │  │ (SSE)        │  │               │  │
│  └────┬─────┘  └──────┬───────┘  └───────┬───────┘  │
│       │               │                   │          │
│       ▼               ▼                   ▼          │
│  ┌──────────────────────────────────────────────┐   │
│  │            SSEBroadcaster (Singleton)          │   │
│  └──────────────────────────────────────────────┘   │
│       │                                              │
│       ▼                                              │
│  ┌──────────────────────────────────────────────┐   │
│  │            TeamManager (Singleton)             │   │
│  │  ┌─────────┐  ┌───────────┐  ┌────────────┐  │   │
│  │  │  Lead   │  │    Dev    │  │    Test    │  │   │
│  │  │Executor │  │ Executor  │  │  Executor  │  │   │
│  │  └────┬────┘  └─────┬─────┘  └─────┬──────┘  │   │
│  └───────┼──────────────┼──────────────┼─────────┘   │
│          │              │              │              │
│          ▼              ▼              ▼              │
│     Claude CLI     Claude CLI     Claude CLI         │
│    (subprocess)    (subprocess)   (subprocess)        │
└─────────────────────────────────────────────────────┘
```

### 2.2 Current Data Flow

1. **User sends message**: `POST /api/chat/send` with message body
2. **Server processes**: `TeamManager.handleChat()` spawns Claude CLI subprocesses
3. **Events streamed**: CLI outputs JSON lines → parsed into `AgentEvent` → mapped to `ChatEvent`
4. **SSE broadcast**: `SSEBroadcaster.broadcast()` pushes to all connected `EventSource` clients
5. **Frontend receives**: `chatStore.handleChatEvent()` adds to `messages` ref

### 2.3 Key Issues

| Issue | Impact | Severity |
|-------|--------|----------|
| SSE is one-way | Cannot send tool approval responses | High |
| No session persistence | History lost on refresh | High |
| No tool approval | Security concern, no user control | High |
| Polling for team status | Unnecessary network traffic | Medium |
| No message ordering | Race conditions possible | Medium |
| Single TeamManager instance | No multi-project support | Low |

### 2.4 Existing Type Definitions

```typescript
// src/teams/types.ts - Current types (to be extended)
interface AgentEvent {
  type: 'agent_message' | 'tool_call' | 'tool_result' | 'file_change' | 'error' | 'completed';
  team: TeamName;  // 'lead' | 'dev' | 'test'
  content: string;
  metadata?: {
    toolName?: string;
    toolArgs?: Record<string, any>;
    filePath?: string;
    fileAction?: 'created' | 'modified' | 'deleted';
    duration?: number;
    tokenUsage?: { prompt: number; completion: number };
  };
}

interface ChatEvent {
  type: ChatEventType;
  team: TeamName;
  content: string;
  taskId?: string;
  metadata?: Record<string, any>;
}
```

---

## 3. Target Architecture Overview

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Vue 3)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ GatewayChat  │  │ GatewayStore │  │  SessionStore    │  │
│  │   View       │  │  (WebSocket) │  │  (CRUD + Cache)  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │             │
│         │            WebSocket              fetch()          │
│         │          (ws://host:port)         (REST API)       │
└─────────┼─────────────────┼──────────────────┼──────────────┘
          │                 │                  │
          ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                Express.js + ws Server (port 38888)           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ REST API     │  │  WebSocket   │  │   Session        │  │
│  │ /sessions/*  │  │  Gateway     │  │   Manager        │  │
│  │ /teams/*     │  │  /ws         │  │   (SQLite)       │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │             │
│         ▼                 ▼                    ▼             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              WebSocket Gateway (Singleton)             │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │   │
│  │  │ Connection │  │  Message   │  │  Tool Approval │  │   │
│  │  │  Manager   │  │  Router    │  │    Queue       │  │   │
│  │  └────────────┘  └────────────┘  └────────────────┘  │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                             │                                │
│  ┌──────────────────────────▼───────────────────────────┐   │
│  │              TeamManager (Enhanced)                    │   │
│  │  ┌─────────┐  ┌───────────┐  ┌────────────────────┐  │   │
│  │  │  Lead   │  │    Dev    │  │       Test         │  │   │
│  │  │Executor │  │ Executor  │  │     Executor       │  │   │
│  │  └────┬────┘  └─────┬─────┘  └─────────┬──────────┘  │   │
│  └───────┼──────────────┼──────────────────┼─────────────┘   │
│          │              │                  │                  │
│     Claude CLI     Claude CLI         Claude CLI              │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────┐
│   SQLite Database        │
│  ┌───────────────────┐  │
│  │ sessions table    │  │
│  │ messages table    │  │
│  │ tool_calls table  │  │
│  └───────────────────┘  │
└─────────────────────────┘
```

### 3.2 Design Principles

1. **Incremental Migration**: Keep SSE endpoints functional during transition
2. **Single Responsibility**: Each module handles one concern
3. **Event-Driven**: Use EventEmitter for internal communication
4. **Fail-Safe**: WebSocket reconnection with exponential backoff
5. **Backward Compatible**: Existing TeamManager API preserved

---

## 4. Module Design

### 4.1 WebSocket Gateway Module

**Location**: `src/worker/gateway/`

#### 4.1.1 WebSocketServer

```typescript
// src/worker/gateway/webSocketServer.ts

/**
 * @brief WebSocket server that upgrades HTTP connections and manages client sessions
 * @param httpServer The Express HTTP server to attach to
 * @param sessionManager Session persistence manager
 */
export class WebSocketGateway extends EventEmitter {
  private wss: WebSocket.Server;
  private connections: Map<string, WebSocketConnection>;
  private messageRouter: MessageRouter;
  private approvalQueue: ToolApprovalQueue;

  constructor(httpServer: http.Server, sessionManager: SessionManager);

  /**
   * @brief Initialize WebSocket server with path-based routing
   */
  initialize(): void;

  /**
   * @brief Handle new WebSocket connection
   * @param ws Raw WebSocket connection
   * @param request HTTP upgrade request
   */
  private handleConnection(ws: WebSocket, request: http.IncomingMessage): void;

  /**
   * @brief Broadcast message to all connected clients in a session
   * @param sessionId Target session ID
   * @param message Message to broadcast
   */
  broadcastToSession(sessionId: string, message: WsMessage): void;

  /**
   * @brief Send message to specific client
   * @param clientId Target client ID
   * @param message Message to send
   */
  sendToClient(clientId: string, message: WsMessage): void;

  /**
   * @brief Get count of active connections
   */
  getConnectionCount(): number;
}
```

**Design Decisions**:
- Use `ws` library (not `socket.io`) for minimal overhead and standard WebSocket protocol
- Each connection gets a unique `clientId` (UUID v4)
- Connections are grouped by `sessionId` for targeted broadcasting
- EventEmitter pattern for decoupled internal communication

#### 4.1.2 MessageRouter

```typescript
// src/worker/gateway/messageRouter.ts

/**
 * @brief Routes incoming WebSocket messages to appropriate handlers
 */
export class MessageRouter {
  private handlers: Map<WsMessageType, MessageHandler>;

  constructor(teamManager: TeamManager, sessionManager: SessionManager);

  /**
   * @brief Register message handler for a specific message type
   * @param type Message type identifier
   * @param handler Handler function
   */
  register(type: WsMessageType, handler: MessageHandler): void;

  /**
   * @brief Route incoming message to appropriate handler
   * @param connection Source WebSocket connection
   * @param message Parsed message
   */
  async route(connection: WebSocketConnection, message: WsMessage): Promise<void>;
}
```

#### 4.1.3 ToolApprovalQueue

```typescript
// src/worker/gateway/toolApprovalQueue.ts

/**
 * @brief Manages pending tool approval requests
 * Holds tool calls that require user approval before execution
 */
export class ToolApprovalQueue {
  private pending: Map<string, PendingToolCall>;
  private timeouts: Map<string, NodeJS.Timeout>;

  /**
   * @brief Add a tool call to the pending queue
   * @param toolCall Tool call details
   * @param timeoutMs Approval timeout in milliseconds (default: 60000)
   * @returns Promise that resolves with approval decision
   */
  enqueue(toolCall: PendingToolCall, timeoutMs?: number): Promise<ApprovalDecision>;

  /**
   * @brief Process approval response from user
   * @param approvalId Approval request ID
   * @param decision User's decision (approve/reject)
   * @param reason Optional reason for rejection
   */
  approve(approvalId: string, decision: 'approve' | 'reject', reason?: string): void;

  /**
   * @brief Get all pending approvals for a session
   * @param sessionId Session ID
   */
  getPendingForSession(sessionId: string): PendingToolCall[];
}
```

**Design Decisions**:
- Approval queue uses Promise-based API for clean async flow
- Default 60-second timeout with configurable per-tool override
- Auto-reject on timeout with notification to user
- Queue is in-memory (no persistence needed - approvals are transient)

#### 4.1.4 WebSocketConnection

```typescript
// src/worker/gateway/types.ts

/**
 * @brief Represents a single WebSocket client connection
 */
export interface WebSocketConnection {
  id: string;                    // UUID v4
  ws: WebSocket;
  sessionId: string | null;      // Currently joined session
  connectedAt: Date;
  lastHeartbeat: Date;
  metadata: {
    userAgent?: string;
    remoteAddress?: string;
  };
}
```

### 4.2 Session Management Module

**Location**: `src/worker/session/`

#### 4.2.1 SessionManager

```typescript
// src/worker/session/sessionManager.ts

/**
 * @brief Manages chat session lifecycle with SQLite persistence
 * @param dbPath Path to SQLite database file
 */
export class SessionManager {
  private db: Database;

  constructor(dbPath: string);

  /**
   * @brief Initialize database schema and create tables if not exist
   */
  async initialize(): Promise<void>;

  /**
   * @brief Create a new chat session
   * @param params Session creation parameters
   * @returns Created session with generated ID
   */
  async createSession(params: CreateSessionParams): Promise<Session>;

  /**
   * @brief Get session by ID
   * @param sessionId Session identifier
   */
  async getSession(sessionId: string): Promise<Session | null>;

  /**
   * @brief List all sessions with pagination
   * @param params Pagination and filter parameters
   */
  async listSessions(params: ListSessionsParams): Promise<SessionList>;

  /**
   * @brief Update session metadata (title, project path)
   * @param sessionId Session identifier
   * @param updates Fields to update
   */
  async updateSession(sessionId: string, updates: UpdateSessionParams): Promise<Session>;

  /**
   * @brief Delete session and all associated messages
   * @param sessionId Session identifier
   */
  async deleteSession(sessionId: string): Promise<void>;

  /**
   * @brief Add message to session
   * @param sessionId Session identifier
   * @param message Message to add
   */
  async addMessage(sessionId: string, message: CreateMessageParams): Promise<Message>;

  /**
   * @brief Get messages for a session with pagination
   * @param sessionId Session identifier
   * @param params Pagination parameters
   */
  async getMessages(sessionId: string, params: PaginationParams): Promise<MessageList>;

  /**
   * @brief Add tool call record to database
   * @param sessionId Session identifier
   * @param toolCall Tool call details
   */
  async addToolCall(sessionId: string, toolCall: CreateToolCallParams): Promise<ToolCall>;

  /**
   * @brief Update tool call approval status
   * @param toolCallId Tool call identifier
   * @param status New approval status
   */
  async updateToolCallStatus(toolCallId: string, status: ApprovalStatus): Promise<void>;

  /**
   * @brief Close database connection
   */
  async close(): Promise<void>;
}
```

**Design Decisions**:
- Use `sql.js` (already in dependencies) for SQLite without native bindings
- Single database file at `~/.claude/claude-dev-sprite/data/chat.db`
- Separate from existing `dev-sprite.db` to avoid coupling
- Async API throughout for non-blocking I/O

### 4.3 Enhanced TeamManager

**Location**: `src/teams/teamManager.ts` (modify existing)

#### 4.3.1 Changes Required

```typescript
// Additions to existing TeamManager class

export class TeamManager extends EventEmitter {
  // NEW: Reference to approval queue
  private approvalQueue: ToolApprovalQueue;

  /**
   * @brief Set the tool approval queue for interactive tool calls
   * @param queue Tool approval queue instance
   */
  setApprovalQueue(queue: ToolApprovalQueue): void;

  /**
   * @brief Enhanced handleChat with session support and tool approval
   * @param userMessage User's message
   * @param sessionId Current session ID
   * @param options Chat options including approval settings
   */
  async *handleChat(
    userMessage: string,
    sessionId?: string,
    options?: ChatOptions
  ): AsyncGenerator<ChatEvent>;

  /**
   * @brief Check if a tool call requires approval
   * @param toolName Tool name
   * @param toolArgs Tool arguments
   * @param teamName Team requesting the tool
   */
  private requiresApproval(toolName: string, toolArgs: any, teamName: TeamName): boolean;
}
```

**Approval Rules**:
- **Always require approval**: `Write`, `Edit`, `Bash` (destructive operations)
- **Never require approval**: `Read`, `Glob`, `Grep` (read-only operations)
- **Configurable**: Per-team approval rules in `TeamConfig`

---

## 5. WebSocket Message Protocol

### 5.1 Message Format

All WebSocket messages use JSON format with a common envelope:

```typescript
// src/worker/gateway/types.ts

/**
 * @brief Common WebSocket message envelope
 */
interface WsMessage {
  /** Message type identifier */
  type: WsMessageType;
  /** Unique message ID for request-response correlation */
  id: string;
  /** Target session ID (required for session-scoped messages) */
  sessionId?: string;
  /** Message payload */
  payload: any;
  /** Server timestamp (added by server) */
  timestamp?: number;
}
```

### 5.2 Message Types

#### Client → Server Messages

| Type | Description | Payload |
|------|-------------|---------|
| `chat.send` | Send a chat message | `{ content: string, sessionId: string }` |
| `chat.approve` | Approve/reject tool call | `{ approvalId: string, decision: 'approve' \| 'reject', reason?: string }` |
| `session.create` | Create new session | `{ title?: string, projectPath?: string }` |
| `session.join` | Join a session (receive events) | `{ sessionId: string }` |
| `session.leave` | Leave a session | `{ sessionId: string }` |
| `session.delete` | Delete a session | `{ sessionId: string }` |
| `session.list` | List sessions | `{ page?: number, limit?: number }` |
| `heartbeat` | Client heartbeat | `{}` |
| `abort` | Abort current execution | `{ sessionId: string }` |

#### Server → Client Messages

| Type | Description | Payload |
|------|-------------|---------|
| `chat.message` | Agent message | `{ sessionId, message: Message }` |
| `chat.tool_call` | Tool call notification | `{ sessionId, toolCall: ToolCall }` |
| `chat.tool_result` | Tool result | `{ sessionId, toolCallId, result: string }` |
| `chat.approval_request` | Request tool approval | `{ sessionId, approvalId, toolCall: ToolCall, timeoutMs }` |
| `chat.approval_timeout` | Approval timed out | `{ sessionId, approvalId }` |
| `chat.completed` | Chat response complete | `{ sessionId, tokenUsage? }` |
| `chat.error` | Error occurred | `{ sessionId, error: string }` |
| `session.created` | Session created confirmation | `{ session: Session }` |
| `session.list` | Session list response | `{ sessions: Session[], total: number }` |
| `session.deleted` | Session deleted confirmation | `{ sessionId: string }` |
| `team.status` | Team status update | `{ team: TeamName, status: TeamStatus }` |
| `connected` | Connection established | `{ clientId: string }` |
| `error` | Generic error | `{ code: string, message: string }` |

### 5.3 Message Flow Examples

#### 5.3.1 Send Chat Message

```
Client                          Server
  │                               │
  │─── chat.send ────────────────▶│
  │    { content, sessionId }     │
  │                               │── TeamManager.handleChat()
  │                               │
  │◀── chat.message ─────────────│
  │    { type: 'agent_message',   │
  │      team: 'lead',            │
  │      content: '分析中...' }    │
  │                               │
  │◀── chat.tool_call ───────────│
  │    { toolName: 'Write',       │
  │      toolArgs: { ... } }      │
  │                               │
  │◀── chat.approval_request ────│
  │    { approvalId: 'xxx',       │
  │      timeoutMs: 60000 }       │
  │                               │
  │─── chat.approve ─────────────▶│
  │    { approvalId: 'xxx',       │── ToolApprovalQueue.approve()
  │      decision: 'approve' }    │
  │                               │
  │◀── chat.tool_result ─────────│
  │    { result: 'File written' } │
  │                               │
  │◀── chat.completed ───────────│
  │    { tokenUsage: { ... } }    │
```

#### 5.3.2 Tool Approval Timeout

```
Client                          Server
  │                               │
  │◀── chat.approval_request ────│
  │    { approvalId: 'xxx',       │
  │      timeoutMs: 60000 }       │
  │                               │
  │   (60 seconds pass...)        │
  │                               │── ToolApprovalQueue timeout
  │                               │
  │◀── chat.approval_timeout ────│
  │    { approvalId: 'xxx' }      │
  │                               │
  │◀── chat.tool_result ─────────│
  │    { result: 'Rejected:       │
  │      timeout' }               │
```

### 5.4 Error Codes

| Code | Description |
|------|-------------|
| `INVALID_MESSAGE` | Malformed message |
| `SESSION_NOT_FOUND` | Session does not exist |
| `SESSION_FULL` | Too many messages in session |
| `APPROVAL_NOT_FOUND` | Approval ID not found |
| `APPROVAL_EXPIRED` | Approval timed out |
| `TEAM_BUSY` | Team is currently executing |
| `INTERNAL_ERROR` | Server internal error |

---

## 6. Database Schema

### 6.1 Technology Choice

**Selected**: `sql.js` (pure JavaScript SQLite)

**Rationale**:
- Already in project dependencies (`"sql.js": "^1.11.0"`)
- No native bindings required (works on all platforms)
- Synchronous API wrapped in async for non-blocking usage
- Single file database for easy backup/migration

**Trade-offs**:
- Slightly slower than native `better-sqlite3` for large datasets
- No WAL mode support (acceptable for single-user application)
- Memory usage slightly higher for large databases

### 6.2 Schema Definition

```sql
-- sessions table: Chat session metadata
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                    -- UUID v4
  title TEXT NOT NULL DEFAULT 'New Chat', -- User-editable title
  project_path TEXT,                      -- Associated project path
  team_config TEXT,                       -- JSON: team configuration snapshot
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'archived' | 'deleted'
  created_at TEXT NOT NULL,               -- ISO 8601 timestamp
  updated_at TEXT NOT NULL,               -- ISO 8601 timestamp
  message_count INTEGER NOT NULL DEFAULT 0,
  token_usage INTEGER NOT NULL DEFAULT 0  -- Total tokens used
);

-- messages table: Chat messages within sessions
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,                    -- UUID v4
  session_id TEXT NOT NULL,               -- FK to sessions.id
  type TEXT NOT NULL,                     -- 'user' | 'agent' | 'tool' | 'system' | 'error'
  team TEXT,                              -- 'lead' | 'dev' | 'test' (null for user/system)
  content TEXT NOT NULL,                  -- Message content (markdown)
  metadata TEXT,                          -- JSON: additional metadata
  created_at TEXT NOT NULL,               -- ISO 8601 timestamp
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- tool_calls table: Tool call details and approval status
CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY,                    -- UUID v4
  session_id TEXT NOT NULL,               -- FK to sessions.id
  message_id TEXT,                        -- FK to messages.id (parent message)
  team TEXT NOT NULL,                     -- Team that made the call
  tool_name TEXT NOT NULL,                -- Tool name (e.g., 'Write', 'Bash')
  tool_args TEXT,                         -- JSON: tool arguments
  tool_result TEXT,                       -- Tool execution result
  approval_status TEXT NOT NULL DEFAULT 'auto_approved',
                                          -- 'pending' | 'approved' | 'rejected' | 'auto_approved' | 'timeout'
  approval_id TEXT,                       -- Approval request ID
  approved_by TEXT,                       -- 'user' | 'auto' | 'timeout'
  approved_at TEXT,                       -- When approval was granted
  duration_ms INTEGER,                    -- Execution duration in milliseconds
  created_at TEXT NOT NULL,               -- ISO 8601 timestamp
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tool_calls_session_id ON tool_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_approval ON tool_calls(approval_status);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);
```

### 6.3 Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   sessions   │       │    messages       │       │   tool_calls     │
├──────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)      │──┐    │ id (PK)          │──┐    │ id (PK)          │
│ title        │  │    │ session_id (FK)  │◀─┤    │ session_id (FK)  │◀──┐
│ project_path │  │    │ type             │  │    │ message_id (FK)  │◀──┤
│ team_config  │  └───▶│ team             │  └───▶│ team             │   │
│ status       │       │ content          │       │ tool_name        │   │
│ created_at   │       │ metadata         │       │ tool_args        │   │
│ updated_at   │       │ created_at       │       │ tool_result      │   │
│ message_count│       └──────────────────┘       │ approval_status  │   │
│ token_usage  │                                  │ approval_id      │   │
└──────────────┘                                  │ approved_by      │   │
                                                  │ approved_at      │   │
                                                  │ duration_ms      │   │
                                                  │ created_at       │   │
                                                  └──────────────────┘   │
                                                         ▲               │
                                                         │               │
                                                         └───────────────┘
                                                    (session_id FK chain)
```

---

## 7. Frontend Component Design

### 7.1 Component Hierarchy

```
DevChatView.vue (refactored)
├── SessionSidebar.vue (NEW)
│   ├── SessionList.vue (NEW)
│   │   └── SessionItem.vue (NEW)
│   └── NewSessionButton.vue (NEW)
├── GatewayChat.vue (NEW - replaces ChatMessageList + ChatInput)
│   ├── GatewayChatMessage.vue (NEW - replaces ChatMessage)
│   │   ├── AgentMessage.vue (NEW)
│   │   ├── ToolCallMessage.vue (NEW)
│   │   │   └── ToolCard.vue (NEW)
│   │   └── SystemMessage.vue (NEW)
│   └── GatewayChatInput.vue (NEW - replaces ChatInput)
│       └── ApprovalBar.vue (NEW)
└── TeamStatusPanel.vue (existing, enhanced)
```

### 7.2 Component Specifications

#### 7.2.1 SessionSidebar.vue

```vue
<!--
  @brief Left sidebar displaying session list and controls
  @props sessions - Array of session objects
  @props activeSessionId - Currently active session ID
  @emits select - When a session is selected
  @emits create - When new session button is clicked
  @emits delete - When a session is deleted
-->
```

**Responsibilities**:
- Display list of chat sessions sorted by `updated_at` DESC
- Show session title, last message preview, message count
- Highlight active session
- "New Chat" button at top
- Right-click context menu for delete/rename
- Collapsible on mobile (future)

#### 7.2.2 GatewayChat.vue

```vue
<!--
  @brief Main chat area with message list and input
  @props sessionId - Current session ID
  @props messages - Array of messages for current session
  @props pendingApprovals - Array of pending tool approvals
  @emits send - When user sends a message
  @emits approve - When user approves/rejects a tool call
-->
```

**Responsibilities**:
- Render scrollable message list
- Auto-scroll to bottom on new messages
- Show typing indicator when agent is processing
- Display pending approval requests prominently
- Handle empty state (no session selected)

#### 7.2.3 ToolCard.vue

```vue
<!--
  @brief Displays a tool call with arguments and approval controls
  @props toolCall - Tool call object
  @props approvalStatus - Current approval status
  @emits approve - When user approves
  @emits reject - When user rejects
-->
```

**Visual Design**:
```
┌─────────────────────────────────────────────────┐
│ 🔧 Write                                    ▼  │
│─────────────────────────────────────────────────│
│ File: src/components/NewComponent.vue           │
│                                                   │
│ ┌─ Arguments ──────────────────────────────────┐ │
│ │ {                                             │ │
│ │   "file_path": "src/components/New.vue",      │ │
│ │   "content": "<template>..."                  │ │
│ │ }                                             │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ [Approve]  [Reject]              45s remaining   │
└─────────────────────────────────────────────────┘
```

**States**:
- `pending`: Yellow border, approval buttons visible
- `approved`: Green checkmark, collapsed
- `rejected`: Red X, shows rejection reason
- `auto_approved`: Gray checkmark, collapsed
- `executing`: Spinner, "Executing..."
- `completed`: Green checkmark with result preview

#### 7.2.4 GatewayChatInput.vue

```vue
<!--
  @brief Chat input with send button and status indicators
  @props disabled - Whether input is disabled
  @props isProcessing - Whether agent is processing
  @emits send - When message is submitted
-->
```

**Features**:
- Multi-line textarea with Shift+Enter for newlines
- Enter to send
- Disabled state during processing
- Character count indicator
- Paste handling (future: file paste)

#### 7.2.5 ApprovalBar.vue

```vue
<!--
  @brief Floating bar showing pending approval count
  @props pendingCount - Number of pending approvals
  @emits scrollToApproval - Scroll to next pending approval
-->
```

**Visual Design**:
```
┌─────────────────────────────────────────────────┐
│ ⏳ 2 tool calls awaiting approval    [Review ▼] │
└─────────────────────────────────────────────────┘
```

### 7.3 File Structure

```
web/src/
├── components/
│   └── chat/
│       ├── GatewayChat.vue          (NEW)
│       ├── GatewayChatMessage.vue   (NEW)
│       ├── GatewayChatInput.vue     (NEW)
│       ├── SessionSidebar.vue       (NEW)
│       ├── SessionItem.vue          (NEW)
│       ├── ToolCard.vue             (NEW)
│       ├── ApprovalBar.vue          (NEW)
│       ├── AgentMessage.vue         (NEW)
│       ├── ToolCallMessage.vue      (NEW)
│       ├── SystemMessage.vue        (NEW)
│       ├── ChatMessage.vue          (KEEP - backward compat)
│       ├── ChatMessageList.vue      (KEEP - backward compat)
│       └── ChatInput.vue            (KEEP - backward compat)
├── stores/
│   ├── gateway.ts                   (NEW)
│   ├── session.ts                   (NEW)
│   ├── chat.ts                      (KEEP - will be deprecated)
│   └── teams.ts                     (KEEP - enhanced)
├── api/
│   ├── gateway.ts                   (NEW - WebSocket client)
│   ├── sessions.ts                  (NEW - REST API for sessions)
│   └── teams.ts                     (KEEP)
└── views/
    └── DevChatView.vue              (REFACTOR)
```

---

## 8. State Management Design

### 8.1 Gateway Store

```typescript
// web/src/stores/gateway.ts

/**
 * @brief WebSocket gateway connection state and message handling
 */
export const useGatewayStore = defineStore('gateway', () => {
  // ===== State =====
  const ws = ref<WebSocket | null>(null);
  const clientId = ref<string | null>(null);
  const connectionState = ref<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>('disconnected');
  const reconnectAttempts = ref(0);
  const lastHeartbeat = ref<Date | null>(null);
  const pendingRequests = ref<Map<string, PendingRequest>>(new Map());

  // ===== Computed =====
  const isConnected = computed(() => connectionState.value === 'connected');

  // ===== Actions =====

  /**
   * @brief Connect to WebSocket server
   * @param url WebSocket server URL (default: ws://localhost:38888/ws)
   */
  function connect(url?: string): void;

  /**
   * @brief Disconnect from WebSocket server
   */
  function disconnect(): void;

  /**
   * @brief Send message to server
   * @param message Message to send
   * @returns Promise that resolves with server response
   */
  async send<T>(message: WsMessage): Promise<T>;

  /**
   * @brief Register message handler for a specific type
   * @param type Message type to handle
   * @param handler Handler function
   * @returns Unsubscribe function
   */
  function onMessage(type: string, handler: (payload: any) => void): () => void;

  /**
   * @brief Start heartbeat interval
   */
  private function startHeartbeat(): void;

  /**
   * @brief Handle reconnection with exponential backoff
   */
  private function reconnect(): void;

  return {
    // State
    ws, clientId, connectionState, reconnectAttempts, lastHeartbeat,
    // Computed
    isConnected,
    // Actions
    connect, disconnect, send, onMessage,
  };
});
```

**Reconnection Strategy**:
- Initial delay: 1 second
- Max delay: 30 seconds
- Backoff multiplier: 2x
- Max attempts: 10
- Jitter: +/- 500ms to prevent thundering herd

### 8.2 Session Store

```typescript
// web/src/stores/session.ts

/**
 * @brief Session state management with local cache
 */
export const useSessionStore = defineStore('session', () => {
  // ===== State =====
  const sessions = ref<Session[]>([]);
  const activeSessionId = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Message cache: sessionId -> messages[]
  const messageCache = ref<Map<string, Message[]>>(new Map());

  // Pending tool approvals
  const pendingApprovals = ref<Map<string, PendingToolCall>>(new Map());

  // ===== Computed =====
  const activeSession = computed(() =>
    sessions.value.find(s => s.id === activeSessionId.value)
  );

  const activeMessages = computed(() =>
    messageCache.value.get(activeSessionId.value || '') || []
  );

  const sortedSessions = computed(() =>
    [...sessions.value].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  );

  // ===== Actions =====

  /**
   * @brief Fetch all sessions from server
   */
  async function fetchSessions(): Promise<void>;

  /**
   * @brief Create a new session
   * @param params Session creation parameters
   */
  async function createSession(params?: CreateSessionParams): Promise<Session>;

  /**
   * @brief Switch to a different session
   * @param sessionId Target session ID
   */
  async function switchSession(sessionId: string): Promise<void>;

  /**
   * @brief Delete a session
   * @param sessionId Session to delete
   */
  async function deleteSession(sessionId: string): Promise<void>;

  /**
   * @brief Load messages for a session
   * @param sessionId Session ID
   * @param page Page number (for pagination)
   */
  async function loadMessages(sessionId: string, page?: number): Promise<void>;

  /**
   * @brief Add message to local cache (optimistic update)
   * @param sessionId Session ID
   * @param message Message to add
   */
  function addMessage(sessionId: string, message: Message): void;

  /**
   * @brief Handle incoming tool call approval request
   * @param approval Pending approval details
   */
  function addPendingApproval(approval: PendingToolCall): void;

  /**
   * @brief Resolve a pending approval
   * @param approvalId Approval ID
   * @param decision User's decision
   */
  function resolveApproval(approvalId: string, decision: ApprovalDecision): void;

  return {
    // State
    sessions, activeSessionId, loading, error, messageCache, pendingApprovals,
    // Computed
    activeSession, activeMessages, sortedSessions,
    // Actions
    fetchSessions, createSession, switchSession, deleteSession,
    loadMessages, addMessage, addPendingApproval, resolveApproval,
  };
});
```

### 8.3 Store Interaction Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Vue Components                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ GatewayChat  │  │ SessionSide  │  │  ToolCard    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                  │           │
└─────────┼─────────────────┼──────────────────┼───────────┘
          │                 │                  │
          ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                     Pinia Stores                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │gatewayStore  │  │sessionStore  │  │ teamsStore   │  │
│  │              │  │              │  │              │  │
│  │ - ws         │  │ - sessions   │  │ - teams      │  │
│  │ - connection │  │ - messages   │  │ - statuses   │  │
│  │ - send()     │  │ - approvals  │  │ - polling    │  │
│  │ - onMessage()│  │ - CRUD       │  │              │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                  │           │
└─────────┼─────────────────┼──────────────────┼───────────┘
          │                 │                  │
          ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                    API Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ gateway.ts   │  │ sessions.ts  │  │  teams.ts    │  │
│  │ (WebSocket)  │  │ (REST)       │  │  (REST)      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 9. API Interface Design

### 9.1 REST API Endpoints (Session Management)

#### Create Session

```
POST /api/sessions
Content-Type: application/json

Request:
{
  "title": "Fix login bug",           // optional, defaults to "New Chat"
  "projectPath": "D:/Code/my-app"     // optional, defaults to cwd
}

Response (201):
{
  "id": "sess-uuid-123",
  "title": "Fix login bug",
  "projectPath": "D:/Code/my-app",
  "status": "active",
  "createdAt": "2026-05-08T10:00:00Z",
  "updatedAt": "2026-05-08T10:00:00Z",
  "messageCount": 0,
  "tokenUsage": 0
}
```

#### List Sessions

```
GET /api/sessions?page=1&limit=20&status=active

Response (200):
{
  "sessions": [
    {
      "id": "sess-uuid-123",
      "title": "Fix login bug",
      "projectPath": "D:/Code/my-app",
      "status": "active",
      "createdAt": "2026-05-08T10:00:00Z",
      "updatedAt": "2026-05-08T10:05:00Z",
      "messageCount": 12,
      "tokenUsage": 15000,
      "lastMessage": "I've fixed the login bug..."
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

#### Get Session

```
GET /api/sessions/:id

Response (200):
{
  "id": "sess-uuid-123",
  "title": "Fix login bug",
  "projectPath": "D:/Code/my-app",
  "teamConfig": { ... },
  "status": "active",
  "createdAt": "2026-05-08T10:00:00Z",
  "updatedAt": "2026-05-08T10:05:00Z",
  "messageCount": 12,
  "tokenUsage": 15000
}
```

#### Update Session

```
PATCH /api/sessions/:id
Content-Type: application/json

Request:
{
  "title": "Fix login bug - RESOLVED"
}

Response (200): Updated session object
```

#### Delete Session

```
DELETE /api/sessions/:id

Response (204): No content
```

#### Get Session Messages

```
GET /api/sessions/:id/messages?page=1&limit=50

Response (200):
{
  "messages": [
    {
      "id": "msg-uuid-456",
      "sessionId": "sess-uuid-123",
      "type": "user",
      "team": null,
      "content": "Fix the login bug",
      "createdAt": "2026-05-08T10:00:00Z"
    },
    {
      "id": "msg-uuid-789",
      "sessionId": "sess-uuid-123",
      "type": "agent",
      "team": "lead",
      "content": "Analyzing the login flow...",
      "createdAt": "2026-05-08T10:00:05Z"
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 50
}
```

### 9.2 REST API Endpoints (Team Management - Existing)

Existing endpoints preserved as-is:
- `GET /api/teams` - List team configs
- `GET /api/teams/:name` - Get team config
- `PUT /api/teams/:name` - Update team config
- `GET /api/teams/:name/status` - Get team status
- `GET /api/teams/status/all` - Get all statuses
- `POST /api/teams/:name/test` - Test connectivity
- `POST /api/teams/:name/abort` - Abort team
- `POST /api/teams/abort-all` - Abort all

### 9.3 WebSocket Endpoint

```
ws://localhost:38888/ws
```

**Connection Handshake**:
```
Client: WebSocket upgrade request
Server: 101 Switching Protocols
Server → Client: { type: "connected", clientId: "uuid", timestamp: 1234567890 }
Client → Server: { type: "session.join", id: "msg-uuid", sessionId: "sess-uuid" }
```

---

## 10. Technical Trade-offs

### 10.1 WebSocket Library: `ws` vs `socket.io`

| Criteria | `ws` | `socket.io` |
|----------|------|-------------|
| Bundle size | ~50KB | ~200KB |
| Protocol | Standard WebSocket | Custom protocol |
| Browser support | All modern | All modern + fallback |
| Reconnection | Manual implementation | Built-in |
| Rooms/namespaces | Manual implementation | Built-in |
| Learning curve | Low | Medium |

**Decision**: Use `ws`

**Rationale**:
- Standard WebSocket protocol, no vendor lock-in
- Smaller bundle size
- We need fine-grained control over reconnection logic
- No need for polling fallback (modern browsers all support WebSocket)
- `socket.io` adds unnecessary abstraction for our use case

**Trade-off**: Need to implement reconnection and room management manually. Acceptable because:
- Reconnection logic is straightforward (exponential backoff)
- Room management is simple (group by sessionId)

### 10.2 Database: `sql.js` vs `better-sqlite3` vs `JSON files`

| Criteria | `sql.js` | `better-sqlite3` | JSON files |
|----------|----------|-------------------|------------|
| Native bindings | No | Yes | No |
| Performance | Good | Excellent | Poor at scale |
| Setup complexity | Low | Medium (node-gyp) | Low |
| Already in deps | Yes | No | N/A |
| Query capability | Full SQL | Full SQL | None |

**Decision**: Use `sql.js`

**Rationale**:
- Already in project dependencies
- No native bindings (works on all platforms without compilation)
- Full SQL query capability for complex queries
- Acceptable performance for single-user chat application

**Trade-off**: Slightly slower than `better-sqlite3`. Mitigation:
- Wrap synchronous calls in `setImmediate` for non-blocking
- Use prepared statements for repeated queries
- Index frequently queried columns

### 10.3 Session Storage: Separate DB vs Same DB

**Decision**: Separate database file (`chat.db` vs existing `dev-sprite.db`)

**Rationale**:
- Separation of concerns (chat data vs analysis data)
- Independent backup/migration
- No risk of schema conflicts
- Easier to add chat feature to existing installations

**Trade-off**: Two database connections to manage. Mitigation:
- Singleton pattern for each database connection
- Clean shutdown closes both connections

### 10.4 Tool Approval: Sync vs Async

**Decision**: Async with Promise-based queue

**Rationale**:
- Tool execution is inherently async (subprocess)
- Promise-based API integrates cleanly with async generators
- Timeout handling is natural with `Promise.race`

**Trade-off**: More complex flow control. Mitigation:
- `ToolApprovalQueue` encapsulates all complexity
- Clear state machine: pending → approved/rejected/timeout

### 10.5 Frontend: New Components vs Modify Existing

**Decision**: Create new components alongside existing ones

**Rationale**:
- Existing components remain functional during migration
- Can switch between old and new UI via feature flag
- Reduces risk of breaking existing functionality

**Trade-off**: Temporary code duplication. Mitigation:
- Old components marked as deprecated
- Removal planned after migration complete

### 10.6 SSE Deprecation Strategy

**Decision**: Keep SSE endpoints functional, add deprecation warnings

**Rationale**:
- Existing clients may depend on SSE
- Gradual migration reduces risk
- SSE can serve as fallback if WebSocket fails

**Timeline**:
1. Phase 1: WebSocket + SSE both active
2. Phase 2: SSE marked deprecated, logging warnings
3. Phase 3: SSE removed (after 2 release cycles)

---

## 11. Risk Assessment & Mitigation

### 11.1 Risk Matrix

| Risk | Probability | Impact | Severity | Mitigation |
|------|-------------|--------|----------|------------|
| WebSocket connection instability | Medium | High | High | Exponential backoff, SSE fallback |
| Tool approval blocks execution | Medium | Medium | Medium | Configurable timeout, auto-reject |
| SQLite lock contention | Low | Medium | Low | Single writer, WAL mode (future) |
| Large message history performance | Medium | Medium | Medium | Pagination, message virtualization |
| Memory leak in approval queue | Low | High | Medium | Timeout cleanup, periodic GC |
| Breaking existing API | Low | High | High | Comprehensive integration tests |

### 11.2 Detailed Mitigations

#### 11.2.1 WebSocket Instability

```
Problem: WebSocket connections can drop due to network issues, server restarts, etc.

Mitigation:
1. Client-side reconnection with exponential backoff
   - Initial: 1s, Max: 30s, Multiplier: 2x
   - Jitter: +/- 500ms
2. Server-side heartbeat detection
   - Client sends heartbeat every 15s
   - Server expects heartbeat within 30s
   - Disconnect stale connections
3. SSE fallback (optional)
   - If WebSocket fails after 3 attempts, fall back to SSE
   - Log warning for monitoring
```

#### 11.2.2 Tool Approval Timeout

```
Problem: User may not respond to approval request, blocking execution.

Mitigation:
1. Configurable timeout (default: 60s)
2. Visual countdown timer in UI
3. Auto-reject on timeout with notification
4. "Approve All" button for trusted operations
5. Per-tool timeout configuration
   - Read operations: auto-approve
   - Write operations: 60s timeout
   - Bash operations: 120s timeout
```

#### 11.2.3 Memory Management

```
Problem: Approval queue and message cache can grow unbounded.

Mitigation:
1. Approval queue: auto-cleanup on timeout
2. Message cache: LRU cache with max 1000 messages per session
3. Periodic garbage collection for resolved approvals
4. Memory usage monitoring (log warning if > 100MB)
```

---

## 12. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

| Task | Priority | Dependencies | Estimated Effort |
|------|----------|-------------|------------------|
| Install `ws` dependency | P0 | None | 0.5h |
| Create database schema | P0 | None | 2h |
| Implement SessionManager | P0 | Schema | 4h |
| Implement WebSocketGateway | P0 | ws | 6h |
| Implement MessageRouter | P0 | Gateway | 3h |
| Create REST API for sessions | P0 | SessionManager | 3h |
| Write unit tests | P0 | All above | 4h |

### Phase 2: Tool Approval (Week 2-3)

| Task | Priority | Dependencies | Estimated Effort |
|------|----------|-------------|------------------|
| Implement ToolApprovalQueue | P0 | Gateway | 4h |
| Enhance TeamManager | P0 | ApprovalQueue | 4h |
| Add approval rules config | P1 | TeamManager | 2h |
| Write integration tests | P0 | All above | 3h |

### Phase 3: Frontend (Week 3-4)

| Task | Priority | Dependencies | Estimated Effort |
|------|----------|-------------|------------------|
| Create gateway store | P0 | Gateway | 3h |
| Create session store | P0 | SessionManager | 3h |
| Implement GatewayChat components | P0 | Stores | 6h |
| Implement ToolCard component | P0 | Stores | 3h |
| Implement SessionSidebar | P1 | Session store | 3h |
| Refactor DevChatView | P0 | All above | 2h |
| Write component tests | P1 | All above | 3h |

### Phase 4: Integration & Polish (Week 4-5)

| Task | Priority | Dependencies | Estimated Effort |
|------|----------|-------------|------------------|
| End-to-end testing | P0 | All above | 4h |
| SSE deprecation warnings | P1 | WebSocket stable | 1h |
| Documentation | P1 | All above | 2h |
| Performance testing | P2 | All above | 2h |

### Total Estimated Effort: ~60 hours

---

## Appendix A: Dependency Changes

### Backend (`package.json`)

```json
{
  "dependencies": {
    "ws": "^8.16.0"           // ADD: WebSocket server
  },
  "devDependencies": {
    "@types/ws": "^8.5.10"   // ADD: WebSocket types
  }
}
```

### Frontend (`web/package.json`)

No new dependencies required. WebSocket is a browser native API.

---

## Appendix B: Configuration Changes

### New Config Section

```typescript
// Add to src/config.ts

export interface WebSocketConfig {
  /** WebSocket server path */
  path: string;
  /** Heartbeat interval in milliseconds */
  heartbeatInterval: number;
  /** Heartbeat timeout in milliseconds */
  heartbeatTimeout: number;
  /** Maximum connections per session */
  maxConnectionsPerSession: number;
  /** Tool approval timeout in milliseconds */
  approvalTimeout: number;
}

// Add to Config interface
export interface Config {
  // ... existing fields
  websocket: WebSocketConfig;
}

// Default values
websocket: {
  path: '/ws',
  heartbeatInterval: 15000,
  heartbeatTimeout: 30000,
  maxConnectionsPerSession: 5,
  approvalTimeout: 60000,
}
```

---

## Appendix C: Migration Checklist

- [ ] Install `ws` and `@types/ws` dependencies
- [ ] Create `src/worker/gateway/` directory
- [ ] Implement `WebSocketGateway` class
- [ ] Implement `MessageRouter` class
- [ ] Implement `ToolApprovalQueue` class
- [ ] Create `src/worker/session/` directory
- [ ] Implement `SessionManager` class
- [ ] Create database migration script
- [ ] Add REST API routes for sessions
- [ ] Modify `server.ts` to attach WebSocket
- [ ] Modify `TeamManager` for approval support
- [ ] Create `web/src/stores/gateway.ts`
- [ ] Create `web/src/stores/session.ts`
- [ ] Create new chat components
- [ ] Refactor `DevChatView.vue`
- [ ] Add feature flag for new/old UI
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Update documentation
- [ ] Remove deprecated SSE code (Phase 3)

---

*End of Design Specification*
