# Claude-DevSprite Chat System Refactoring - Test Plan

## 1. Test Infrastructure Analysis

### 1.1 Current Setup
| Item | Value |
|------|-------|
| Test Framework | Vitest v1.4.0 |
| Test Environment | happy-dom |
| Vue Test Utils | @vue/test-utils v2.4.10 |
| Config File | `web/vitest.config.ts` |
| Test Pattern | `tests/**/*.test.ts` |
| Root Config | None (no `vitest.config.ts` at root) |
| State Management | Pinia v2.1.0 |

### 1.2 Existing Test Coverage
| File | Tests | Module |
|------|-------|--------|
| ChatInput.test.ts | 7 | Chat Component |
| ChatMessage.test.ts | 9 | Chat Component |
| TeamStatusPanel.test.ts | 6 | Team Component |
| ProjectCard.test.ts | 17 | Home Component |
| AddProjectModal.test.ts | 15 | Home Component |
| FolderBrowser.test.ts | 18+ | Common Component |
| **Total** | **72+** | |

### 1.3 Coverage Gaps (Critical)
- No Store unit tests (chat, teams, ui, projects, analysis)
- No API client tests (web/src/api/teams.ts)
- No ChatMessageList component test
- No backend unit tests (TeamManager, TeamExecutor, FileProtocol, SSEBroadcaster)
- No integration tests (API routes)
- No E2E tests for chat flow

---

## 2. Test Strategy

### 2.1 Test Pyramid

```
         /\
        /  \        E2E Tests (3-5 scenarios)
       /    \       - Full chat flow
      /------\      - Tool approval flow
     /        \     Integration Tests (10-15 cases)
    /          \    - API routes + middleware
   /------------\   - SSE stream lifecycle
  /              \  Unit Tests (60-80 cases)
 /                \ - Stores, Components, Utils, Backend classes
/------------------\
```

### 2.2 Priority Levels
- **P0 (Must Have)**: Chat Store, Chat API, TeamManager core flow
- **P1 (Should Have)**: Teams Store, SSEBroadcaster, FileProtocol, ChatMessageList
- **P2 (Nice to Have)**: UI Store, Analysis Store, E2E flows

---

## 3. Test Cases by Module

### 3.1 Chat Store (web/src/stores/chat.ts) - P0

```
File: web/tests/stores/chat.test.ts
```

| # | Test Case | Type | Priority |
|---|-----------|------|----------|
| 1 | should initialize with empty messages | State | P0 |
| 2 | should initialize with disconnected state | State | P0 |
| 3 | should add user message via sendMessage | Action | P0 |
| 4 | should set isSending during sendMessage | Action | P0 |
| 5 | should clear isSending after sendMessage completes | Action | P0 |
| 6 | should set error on sendMessage failure | Action | P0 |
| 7 | should not send empty message | Guard | P0 |
| 8 | should not send when already sending | Guard | P0 |
| 9 | should add system message via addSystemMessage | Action | P1 |
| 10 | should clear all messages via clearMessages | Action | P1 |
| 11 | should filter agent messages via agentMessages computed | Computed | P1 |
| 12 | should filter tool messages via toolMessages computed | Computed | P1 |
| 13 | should map event type agent_message to agent | Logic | P1 |
| 14 | should map event type tool_call to tool | Logic | P1 |
| 15 | should map event type error to error | Logic | P1 |
| 16 | should map unknown event type to system | Logic | P1 |
| 17 | should connect and set isConnected on open | SSE | P0 |
| 18 | should handle incoming SSE messages | SSE | P0 |
| 19 | should set error and reconnect on SSE error | SSE | P0 |
| 20 | should disconnect and reset state | SSE | P1 |
| 21 | should close existing connection on reconnect | SSE | P1 |

**Mock Strategy**:
- Mock `chatApi` module (`vi.mock('@/api/teams')`)
- Mock `EventSource` class
- Mock `document.querySelector` for scrollToBottom

### 3.2 Teams Store (web/src/stores/teams.ts) - P0

```
File: web/tests/stores/teams.test.ts
```

| # | Test Case | Type | Priority |
|---|-----------|------|----------|
| 1 | should initialize with empty teams | State | P0 |
| 2 | should fetch teams successfully | Action | P0 |
| 3 | should handle fetchTeams error | Action | P0 |
| 4 | should fetch statuses and update map | Action | P0 |
| 5 | should update team config | Action | P1 |
| 6 | should test team connectivity | Action | P1 |
| 7 | should abort single team | Action | P1 |
| 8 | should abort all teams | Action | P1 |
| 9 | should update status via updateStatus | Action | P1 |
| 10 | should compute leadStatus correctly | Computed | P1 |
| 11 | should compute isAnyBusy correctly | Computed | P1 |
| 12 | should start and stop polling | Lifecycle | P1 |
| 13 | should set loading during fetchTeams | State | P2 |

**Mock Strategy**:
- Mock `teamsApi` module
- Use `vi.useFakeTimers()` for polling tests

### 3.3 ChatMessageList Component (web/src/components/chat/ChatMessageList.vue) - P1

```
File: web/tests/components/ChatMessageList.test.ts
```

| # | Test Case | Type | Priority |
|---|-----------|------|----------|
| 1 | should render empty state when no messages | Render | P1 |
| 2 | should render messages list | Render | P1 |
| 3 | should render correct number of ChatMessage components | Render | P1 |
| 4 | should show empty state text | Content | P1 |
| 5 | should auto-scroll on new message | Behavior | P2 |

**Mock Strategy**:
- Mock `ChatMessage` child component
- Mock `containerRef` for scroll tests

### 3.4 Chat API Client (web/src/api/teams.ts) - P0

```
File: web/tests/api/teams.test.ts
```

| # | Test Case | Type | Priority |
|---|-----------|------|----------|
| 1 | should call GET /api/teams for getAll | API | P0 |
| 2 | should call GET /api/teams/:name for get | API | P0 |
| 3 | should call PUT /api/teams/:name for update | API | P0 |
| 4 | should call GET /api/teams/:name/status for getStatus | API | P1 |
| 5 | should call GET /api/teams/status/all for getAllStatuses | API | P1 |
| 6 | should call POST /api/teams/:name/test for test | API | P1 |
| 7 | should call POST /api/teams/:name/abort for abort | API | P1 |
| 8 | should call POST /api/teams/abort-all for abortAll | API | P1 |
| 9 | should throw error on non-ok response | Error | P0 |
| 10 | should create EventSource for chat stream | SSE | P0 |
| 11 | should POST to /api/chat/send | API | P0 |

**Mock Strategy**:
- Mock `global.fetch`
- Mock `global.EventSource`

### 3.5 TeamManager (src/teams/teamManager.ts) - P0

```
File: tests/teams/teamManager.test.ts
```

| # | Test Case | Type | Priority |
|---|-----------|------|----------|
| 1 | should initialize with three team statuses | Init | P0 |
| 2 | should initialize config and file protocol | Init | P0 |
| 3 | should return team status by name | Getter | P0 |
| 4 | should return offline for unknown team | Getter | P1 |
| 5 | should return all statuses | Getter | P1 |
| 6 | should abort single team | Action | P1 |
| 7 | should abort all teams | Action | P1 |
| 8 | should emit statusChange event | Event | P1 |
| 9 | should parse tasks from lead output | Logic | P0 |
| 10 | should extract task description | Logic | P1 |
| 11 | should build summary prompt | Logic | P1 |
| 12 | should extract changed files from events | Logic | P1 |
| 13 | should handle chat flow: lead -> dev/test -> summary | Integration | P0 |

**Mock Strategy**:
- Mock `TeamConfigManager`
- Mock `FileProtocol`
- Mock `TeamExecutor`
- Use `EventEmitter` pattern for event testing

### 3.6 TeamConfigManager (src/teams/teamConfig.ts) - P1

```
File: tests/teams/teamConfig.test.ts
```

| # | Test Case | Type | Priority |
|---|-----------|------|----------|
| 1 | should load config from file | IO | P1 |
| 2 | should return default config when file not found | Fallback | P1 |
| 3 | should validate required model field | Validation | P1 |
| 4 | should save config to file | IO | P1 |
| 5 | should initialize directory structure | Init | P1 |
| 6 | should load global settings | IO | P1 |
| 7 | should save global settings | IO | P1 |
| 8 | should return default global settings when not found | Fallback | P1 |

**Mock Strategy**:
- Mock `fs/promises` module
- Use temp directory for IO tests

### 3.7 FileProtocol (src/teams/fileProtocol.ts) - P1

```
File: tests/teams/fileProtocol.test.ts
```

| # | Test Case | Type | Priority |
|---|-----------|------|----------|
| 1 | should write task to team inbox | IO | P1 |
| 2 | should read tasks from team inbox | IO | P1 |
| 3 | should return empty array when inbox not found | Fallback | P1 |
| 4 | should write result to team outbox | IO | P1 |
| 5 | should read results from team outbox | IO | P1 |
| 6 | should clear inbox | IO | P2 |
| 7 | should clear outbox | IO | P2 |
| 8 | should convert task to markdown | Serialization | P1 |
| 9 | should parse task from markdown | Deserialization | P1 |
| 10 | should convert result to markdown | Serialization | P1 |
| 11 | should parse result from markdown | Deserialization | P1 |

**Mock Strategy**:
- Mock `fs/promises` module
- Use in-memory file system mock

### 3.8 SSEBroadcaster (src/worker/sseBroadcaster.ts) - P1

```
File: tests/worker/sseBroadcaster.test.ts
```

| # | Test Case | Type | Priority |
|---|-----------|------|----------|
| 1 | should add client and send connected event | Lifecycle | P1 |
| 2 | should remove client on close | Lifecycle | P1 |
| 3 | should broadcast event to all clients | Broadcast | P1 |
| 4 | should not broadcast when no clients | Guard | P1 |
| 5 | should remove client on write error | Error | P1 |
| 6 | should report correct client count | Getter | P2 |

**Mock Strategy**:
- Mock Express `Response` object
- Use `vi.fn()` for `write` and `on` methods

### 3.9 Team API Routes (src/worker/routes/teams.ts) - P1

```
File: tests/worker/routes/teams.test.ts
```

| # | Test Case | Type | Priority |
|---|-----------|------|----------|
| 1 | GET /api/teams should return all configs | Route | P1 |
| 2 | GET /api/teams/:name should return single config | Route | P1 |
| 3 | PUT /api/teams/:name should update config | Route | P1 |
| 4 | GET /api/teams/:name/status should return status | Route | P1 |
| 5 | GET /api/teams/status/all should return all statuses | Route | P1 |
| 6 | POST /api/teams/:name/test should test connectivity | Route | P1 |
| 7 | POST /api/chat/send should handle chat message | Route | P0 |
| 8 | POST /api/chat/send should return 400 for empty message | Validation | P0 |
| 9 | POST /api/teams/:name/abort should abort team | Route | P1 |
| 10 | POST /api/teams/abort-all should abort all | Route | P1 |

**Mock Strategy**:
- Use `supertest` or mock Express app
- Mock `TeamManager` and `TeamConfigManager`
- Mock `sseBroadcaster`

### 3.10 UI Store (web/src/stores/ui.ts) - P2

```
File: web/tests/stores/ui.test.ts
```

| # | Test Case | Type | Priority |
|---|-----------|------|----------|
| 1 | should toggle sidebar | Action | P2 |
| 2 | should set sidebar open/closed | Action | P2 |
| 3 | should toggle TOC panel | Action | P2 |
| 4 | should set theme | Action | P2 |
| 5 | should set locale | Action | P2 |
| 6 | should toggle locale between en and zh-CN | Action | P2 |

### 3.11 Projects Store (web/src/stores/projects.ts) - P2

```
File: web/tests/stores/projects.test.ts
```

| # | Test Case | Type | Priority |
|---|-----------|------|----------|
| 1 | should fetch projects | Action | P2 |
| 2 | should add project | Action | P2 |
| 3 | should remove project | Action | P2 |
| 4 | should get project by name | Getter | P2 |
| 5 | should clear currentProject when removing current | Logic | P2 |

---

## 4. Mock Strategy

### 4.1 Frontend Mocks

```typescript
// API Mock Pattern
vi.mock('@/api/teams', () => ({
  teamsApi: {
    getAll: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    getStatus: vi.fn(),
    getAllStatuses: vi.fn(),
    test: vi.fn(),
    abort: vi.fn(),
    abortAll: vi.fn(),
  },
  chatApi: {
    createStream: vi.fn(),
    send: vi.fn(),
  },
}))

// EventSource Mock
class MockEventSource {
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  close = vi.fn()
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2
}

// Pinia Mock Pattern
beforeEach(() => {
  setActivePinia(createPinia())
})
```

### 4.2 Backend Mocks

```typescript
// fs/promises Mock
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
  access: vi.fn(),
  unlink: vi.fn(),
}))

// Child Process Mock (for TeamExecutor)
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))
```

---

## 5. Test Data Preparation

### 5.1 Sample ChatMessage

```typescript
const sampleMessages = {
  user: {
    id: 'msg-user-1',
    type: 'user' as const,
    content: 'Add a login page',
    timestamp: new Date('2026-05-08T10:00:00Z'),
  },
  agent: {
    id: 'msg-agent-1',
    type: 'agent' as const,
    team: 'dev',
    content: 'I will create the login page',
    timestamp: new Date('2026-05-08T10:01:00Z'),
    taskId: 'task-001',
  },
  tool: {
    id: 'msg-tool-1',
    type: 'tool' as const,
    team: 'dev',
    content: 'Reading file src/login.ts',
    timestamp: new Date('2026-05-08T10:02:00Z'),
  },
  error: {
    id: 'msg-error-1',
    type: 'error' as const,
    content: 'Process crashed',
    timestamp: new Date('2026-05-08T10:03:00Z'),
  },
  system: {
    id: 'msg-sys-1',
    type: 'system' as const,
    content: 'Connected to server',
    timestamp: new Date('2026-05-08T10:04:00Z'),
  },
}
```

### 5.2 Sample TeamConfig

```typescript
const sampleTeamConfig = {
  name: 'dev' as const,
  displayName: 'Development Team',
  model: 'claude-sonnet-4-20250514',
  maxTurns: 20,
  allowedTools: ['Read', 'Write', 'Edit'],
  disallowedTools: ['Bash(rm *)'],
  timeout: 600000,
  skills: [],
}
```

### 5.3 Sample Task

```typescript
const sampleTask = {
  id: 'task-001',
  type: 'development' as const,
  priority: 'medium' as const,
  assignedTo: 'dev' as const,
  title: 'Create login page',
  description: 'Implement a login page with email and password fields',
  acceptanceCriteria: [
    'Page renders correctly',
    'Form validation works',
    'Submit triggers API call',
  ],
  createdAt: '2026-05-08T10:00:00Z',
  status: 'pending' as const,
}
```

### 5.4 Sample SSE Events

```typescript
const sampleSSEEvents = {
  connected: { type: 'connected', timestamp: Date.now() },
  agentMessage: {
    type: 'agent_message',
    team: 'lead',
    content: 'Analyzing requirements...',
  },
  toolCall: {
    type: 'tool_call',
    team: 'dev',
    content: 'Calling tool: Write',
    metadata: { toolName: 'Write', toolArgs: { file_path: 'src/login.ts' } },
  },
  completed: {
    type: 'completed',
    team: 'lead',
    content: 'All tasks completed',
  },
}
```

---

## 6. File Structure for New Tests

```
web/tests/
  stores/
    chat.test.ts
    teams.test.ts
    ui.test.ts
    projects.test.ts
  api/
    teams.test.ts
  components/
    ChatMessageList.test.ts

tests/
  teams/
    teamManager.test.ts
    teamConfig.test.ts
    fileProtocol.test.ts
  worker/
    sseBroadcaster.test.ts
    routes/
      teams.test.ts
```

---

## 7. Vitest Configuration Updates

### 7.1 Root vitest.config.ts (for backend tests)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

### 7.2 Updated web/vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/stores/**', 'src/api/**', 'src/components/chat/**'],
    },
  },
});
```

---

## 8. Execution Plan

### Phase 1: Store Unit Tests (P0)
1. Create `web/tests/stores/chat.test.ts`
2. Create `web/tests/stores/teams.test.ts`
3. Create `web/tests/api/teams.test.ts`

### Phase 2: Backend Unit Tests (P0-P1)
1. Create `tests/teams/teamManager.test.ts`
2. Create `tests/teams/teamConfig.test.ts`
3. Create `tests/teams/fileProtocol.test.ts`
4. Create `tests/worker/sseBroadcaster.test.ts`
5. Create root `vitest.config.ts`

### Phase 3: Component & Integration Tests (P1)
1. Create `web/tests/components/ChatMessageList.test.ts`
2. Create `tests/worker/routes/teams.test.ts`

### Phase 4: Additional Coverage (P2)
1. Create `web/tests/stores/ui.test.ts`
2. Create `web/tests/stores/projects.test.ts`

---

## 9. Coverage Targets

| Module | Target | Notes |
|--------|--------|-------|
| Chat Store | 90% | Core chat logic |
| Teams Store | 85% | Polling can be partial |
| Chat API | 80% | Network calls mocked |
| TeamManager | 85% | Complex flow logic |
| FileProtocol | 90% | IO serialization |
| SSEBroadcaster | 85% | Event broadcasting |
| ChatMessageList | 75% | Auto-scroll hard to test |
| Overall | 80% | Weighted average |

---

## 10. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| EventSource mock complexity | Medium | Create reusable MockEventSource class |
| Async generator testing | High | Use `for await...of` with mocked async iterables |
| File system mocking | Medium | Use `vi.mock('fs/promises')` consistently |
| Pinia store isolation | Low | Always call `setActivePinia(createPinia())` in beforeEach |
| SSE reconnection timing | Medium | Use `vi.useFakeTimers()` for timeout tests |
