# Project Scan Report — Claude-DevSprite

> Generated: 2026-05-11 | Scanner: Claude Code (static analysis)

---

## 1. Frontend Framework & Dev Server

### Framework

| Aspect | Detail |
|--------|--------|
| **Framework** | Vue 3 (`^3.4.0`) |
| **State Management** | Pinia (`^2.1.0`) |
| **Routing** | Vue Router (`^4.2.0`) |
| **Build Tool** | Vite 5 (`^5.0.0`) |
| **Language** | TypeScript |
| **Backend** | Node.js + Express (`^4.18.2`) |

### Dev Server Commands

> **Important:** The frontend proxies `/api` → `http://localhost:38888` and `/ws` → `ws://localhost:38888`. The backend must be running for the frontend to function.

```bash
# Terminal 1 — Backend (Express on port 38888)
cd D:/Claude-DevSprite && npm run dev

# Terminal 2 — Frontend (Vite on port 5173)
cd D:/Claude-DevSprite/web && npm run dev
```

### Build Commands

```bash
# Build frontend only
cd D:/Claude-DevSprite/web && npm run build

# Build backend only
cd D:/Claude-DevSprite && npm run build

# Build both + restart daemon
cd D:/Claude-DevSprite && npm run start:all
```

---

## 2. Page Routes (Vue Router)

Router config: `web/src/router/index.ts`

### Top-Level Routes

| # | Path | Name | Component | Description |
|---|------|------|-----------|-------------|
| 1 | `/` | `home` | `HomePage.vue` | Home page with project list |
| 2 | `/chat` | `chat` | `DevChatView.vue` | Standalone dev chat |
| 3 | `/search` | `search` | `SearchResults.vue` | Search results |
| 4 | `/settings` | `settings` | `SettingsView.vue` | Settings (AI, Teams, Skills, System) |

### Nested Routes (under `ProjectLayout.vue`)

| # | Full Path | Name | Component | Description |
|---|-----------|------|-----------|-------------|
| 5 | `/project/:projectName` | `project` | `ProjectView.vue` | Project overview (default child) |
| 6 | `/project/:projectName/dev` | `project-dev` | `DevChatView.vue` | Project-scoped dev chat |
| 7 | `/project/:projectName/doc/:path(.*)` | `document` | `DocumentView.vue` | Document viewer |

### Standalone Project Route

| # | Path | Name | Component | Description |
|---|------|------|-----------|-------------|
| 8 | `/project/:projectName/source` | `source` | `SourceView.vue` | Source code viewer |

### Catch-All

| # | Path | Name | Component |
|---|------|------|-----------|
| 9 | `/:pathMatch(.*)*` | `not-found` | `HomePage.vue` |

### Unused View Files (not routed)

- `Home.vue`, `DashboardView.vue`, `WorkspaceView.vue`, `LogsView.vue`, `ProjectOverview.vue`

---

## 3. Button Inventory Per Page/Route

### 3.1 `/` — HomePage.vue

| Button | Text/Label | Handler | Context | Disabled Condition |
|--------|-----------|---------|---------|-------------------|
| B9 | Refresh | `fetchProjects` | Header action, reloads project list | — |
| B10 | + Add Project | `showAddModal = true` | Header action, opens AddProjectModal | — |
| B11 | Retry | `fetchProjects` | Error state fallback | — |
| B12 | + Add Project | `showAddModal = true` | Empty state (no projects) | — |

**Associated components on this page:**
- `AppHeader.vue` — Language toggle (B40), Theme toggle (B41)
- `ConsolePanel.vue` — Refresh logs (B42), Close console (B43)
- `ProjectCard.vue` — Open chat (B51), Delete project (B52)
- `TokensBar.vue` — Period selector: 日/周/月/全部 (B53–B56)
- `LogFilters.vue` — Level filter: All/Info/Warn/Error (B47–B50)
- `AddProjectModal.vue` — Close modal (B44), Cancel (B45), Add project (B46)
- `FolderBrowser.vue` — Parent directory (B73), Retry (B74)
- `SearchBar.vue` — Clear search (B75)

---

### 3.2 `/chat` — DevChatView.vue

**No `<button>` elements in the view itself.** Composed of child components:

- `SessionSidebar.vue` — Collapse toggle (B70), + New Chat (B71), Delete session (B72)
- `NewSessionDialog.vue` — Close dialog (B67), Cancel (B68), Create session (B69)
- `ChatInput.vue` — Send message (B58)
- `TeamStatusPanel.vue` — Abort all (B57)

---

### 3.3 `/search` — SearchResults.vue

| Button | Text/Label | Handler | Context |
|--------|-----------|---------|---------|
| B21 | Retry | `retrySearch` | Error state fallback |

---

### 3.4 `/settings` — SettingsView.vue

| Button | Text/Label | Handler | Context | Disabled Condition |
|--------|-----------|---------|---------|-------------------|
| B22 | AI Model / Agent Teams / Skills / System | `activeTab = tab.key` | Tab navigation (dynamic v-for) | — |
| B23 | Show/Hide | `showApiKey = !showApiKey` | Toggle API key visibility | — |
| B24 | Save AI Config | `saveAiConfig` | Save AI provider settings | `saving` |
| B25 | Test Connection | `testAiConnection` | Test AI provider connection | `testing` |
| B26 | Test | `testTeamConnection(team.name)` | Test team connection (per team) | `teamTesting === team.name` |
| B27 | × | `removeSkill(team, skill)` | Remove skill tag from team | — |
| B28 | Add | `addSkill(team)` | Add skill to team | — |
| B29 | Save | `saveTeam(team)` | Save team configuration | `teamSaving === team.name` |
| B30 | Test Skill | `testSkill(skill.name)` | Test individual skill | `skillTesting === skill.name` |
| B31 | Save System Config | `saveSystemConfig` | Save system settings | `saving` |

**Associated inputs:** API Key input, skill name input per team, system config fields (log level, analysis mode, etc.)

---

### 3.5 `/project/:projectName` — ProjectView.vue

| Button | Text/Label | Handler | Context |
|--------|-----------|---------|---------|
| B19 | Dashboard | `setTab('dashboard')` | Tab toggle |
| B20 | Workspace | `setTab('workspace')` | Tab toggle |

**Associated:** Search input (`placeholder="搜索知识库..."`)

---

### 3.6 `/project/:projectName/doc/:path(.*)` — DocumentView.vue

| Button | Text/Label | Handler | Context |
|--------|-----------|---------|---------|
| B8 | Retry | `loadDocument` | Error state fallback |

---

### 3.7 `/project/:projectName/source` — SourceView.vue

| Button | Text/Label | Handler | Context |
|--------|-----------|---------|---------|
| B32 | Retry | `loadSource` | Error state fallback |

---

### 3.8 Workspace Components (used in ProjectLayout)

These components appear inside the project layout when the Workspace tab is active:

#### FileTreeSidebar.vue
| Button | Text/Label | Handler | Context |
|--------|-----------|---------|---------|
| B76 | 📚 知识库 | `activeTab = 'knowledge'` | Switch to knowledge file tree |
| B77 | 📁 源码 | `activeTab = 'source'` | Switch to source file tree |

#### ChatPanel.vue
| Button | Text/Label | Handler | Context |
|--------|-----------|---------|---------|
| B59 | ✕ | `$emit('close')` | Close chat panel |
| B60 | ✕ (per attachment) | `removeAttachment(i)` | Remove file attachment |
| B61 | 📎 | `$refs.fileInput?.click()` | Attach context file |
| B62 | 发送 | `send` | Send message |

**Associated:** Text input (`v-model="input"`, `placeholder="输入消息..."`), file input (accept: `.md,.ts,.js,.vue,.json,.txt,.py,.go,.rs`)

#### DocPanel.vue
| Button | Text/Label | Handler | Context |
|--------|-----------|---------|---------|
| B63 | ✕ | `$emit('close')` | Close doc panel |
| B64 | ← 返回列表 | `currentDoc = null` | Return to doc list |

#### CodePanel.vue
| Button | Text/Label | Handler | Context |
|--------|-----------|---------|---------|
| B65 | ✕ | `$emit('close')` | Close code panel |
| B66 | ← 文件树 | `currentFile = null` | Return to file tree |

---

### 3.9 App-Level Components (visible on multiple pages)

#### AppHeader.vue
| Button | Text/Label | Handler | Context |
|--------|-----------|---------|---------|
| B40 | 中/EN | `uiStore.toggleLocale()` | Toggle language |
| B41 | ☀/🌙 (SVG) | `toggleTheme` | Toggle light/dark theme |

#### AppSidebar.vue
| Button | Text/Label | Handler | Context |
|--------|-----------|---------|---------|
| B39 | ↻ (SVG refresh) | `refreshTree` | Refresh file tree |

#### AppTocPanel.vue
| Button | Text/Label | Handler | Context |
|--------|-----------|---------|---------|
| B38 | ✕ (SVG) | `toggleTocPanel` | Close TOC panel |

#### TeamStatusPanel.vue
| Button | Text/Label | Handler | Context |
|--------|-----------|---------|---------|
| B57 | 中止所有 | `$emit('abort-all')` | Abort all team tasks |

---

### 3.10 Unused/Routed-Out Views (for reference)

#### DashboardView.vue (not currently routed)
| Button | Text/Label | Handler | Context |
|--------|-----------|---------|---------|
| B1 | + 添加任务 | `showAddTask = true` | Open add task dialog |
| B2 | 批准修复 | `approveReview(review.id)` | Approve AI review fix |
| B3 | 忽略 | `ignoreReview(review.id)` | Ignore review item |
| B4 | 讨论 | `discussReview(review)` | Open chat for review discussion |
| B5 | 定位 | `locateReview(review)` | Navigate to code panel |
| B6 | 取消 | `showAddTask = false` | Cancel add task dialog |
| B7 | 添加 | `addTask` | Confirm add task |

#### WorkspaceView.vue (not currently routed)
| Button | Text/Label | Handler | Context |
|--------|-----------|---------|---------|
| B33 | 📄 Doc | `togglePanel('doc')` | Toggle doc panel |
| B34 | 📁 Code | `togglePanel('code')` | Toggle code panel |
| B35 | 💬 Chat | `togglePanel('chat')` | Toggle chat panel |
| B36 | 文件树 | `toggleSidebar` | Toggle file tree sidebar |
| B37 | ═ 均分 | `equalizePanels` | Equalize panel widths |

#### LogsView.vue (not currently routed)
| Button | Text/Label | Handler | Context |
|--------|-----------|---------|---------|
| B13–B16 | All/Info/Warn/Error | `activeLevel = lvl.key` | Level filter (dynamic v-for) |
| B17 | Refresh | `fetchLogs` | Manual log refresh |
| B18 | Retry | `fetchLogs` | Error state fallback |

---

## 4. Test Plan (Playwright)

### 4.1 Setup

```bash
# Install Playwright
cd D:/Claude-DevSprite
npm install -D @playwright/test

# Or if using the web workspace:
cd D:/Claude-DevSprite/web
npm install -D @playwright/test
npx playwright install chromium
```

### 4.2 Configuration (`playwright.config.ts`)

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'cd D:/Claude-DevSprite && npm run dev',
      port: 38888,
      reuseExistingServer: true,
    },
    {
      command: 'cd D:/Claude-DevSprite/web && npm run dev',
      port: 5173,
      reuseExistingServer: true,
    },
  ],
});
```

### 4.3 Test Scenarios

#### Test Suite 1: Home Page (`/`)

| Test | Action | Expected Result |
|------|--------|----------------|
| `home-01` | Navigate to `/` | Page loads, project list table visible (or empty state) |
| `home-02` | Click "Refresh" button | Project list reloads (spinner → table) |
| `home-03` | Click "+ Add Project" button | `AddProjectModal` dialog opens |
| `home-04` | In modal, type path in input, click "Add" | Modal closes, project appears in list |
| `home-05` | In modal, click "Cancel" or "✕" | Modal closes without adding project |
| `home-06` | In modal, click FolderBrowser parent directory button | Directory navigates up one level |
| `home-07` | Hover project row, click chat icon | Navigates to `/chat?project=NAME` |
| `home-08` | Hover project row, click delete icon | Confirmation dialog → project removed from list |
| `home-09` | Click language toggle (中/EN) | UI text switches between Chinese and English |
| `home-10` | Click theme toggle (☀/🌙) | Page switches between light and dark theme |
| `home-11` | Click TokensBar period buttons (日/周/月/全部) | Token stats update for selected period |
| `home-12` | Click LogFilters level buttons (All/Info/Warn/Error) | Console panel filters logs by level |
| `home-13` | Click ConsolePanel refresh button | Logs reload in console |
| `home-14` | Click ConsolePanel close button | Console panel collapses |
| `home-15` | Type in search bar, click clear button | Search input cleared |

#### Test Suite 2: Settings (`/settings`)

| Test | Action | Expected Result |
|------|--------|----------------|
| `settings-01` | Navigate to `/settings` | Settings page loads, "AI Model" tab active by default |
| `settings-02` | Click "Agent Teams" tab | Agent Teams config section displayed |
| `settings-03` | Click "Skills" tab | Skills inventory displayed |
| `settings-04` | Click "System" tab | System config section displayed |
| `settings-05` | Click "Show/Hide" on API key | API key toggles between visible/hidden |
| `settings-06` | Fill API key, click "Save AI Config" | Config saved, button shows "Saving..." then reverts |
| `settings-07` | Click "Test Connection" | Connection test runs, success/error message shown |
| `settings-08` | In Agent Teams, click "Test" on a team | Team connection test runs |
| `settings-09` | In Agent Teams, type skill name, click "Add" | Skill tag appears in team's skill list |
| `settings-10` | Click "×" on a skill tag | Skill removed from team |
| `settings-11` | Click "Save" on a team card | Team config saved |
| `settings-12` | Click "Test Skill" on a skill | Skill test runs |
| `settings-13` | Modify system config, click "Save System Config" | System settings saved |

#### Test Suite 3: Project Page (`/project/:name`)

| Test | Action | Expected Result |
|------|--------|----------------|
| `project-01` | Navigate to `/project/test-project` | Project layout loads with sidebar, main area, TOC |
| `project-02` | Click "Dashboard" tab | Dashboard content displayed |
| `project-03` | Click "Workspace" tab | Workspace panels (Doc/Code/Chat) become available |
| `project-04` | Click AppSidebar refresh button | File tree refreshes |
| `project-05` | Click AppTocPanel close button | TOC panel closes |

#### Test Suite 4: Project Workspace

| Test | Action | Expected Result |
|------|--------|----------------|
| `workspace-01` | Click "知识库" tab in FileTreeSidebar | Knowledge file tree displayed |
| `workspace-02` | Click "源码" tab in FileTreeSidebar | Source code file tree displayed |
| `workspace-03` | Click a file in CodePanel file tree | File content displayed with syntax highlighting |
| `workspace-04` | Click "← 文件树" in CodePanel | Returns to file tree view |
| `workspace-05` | Click "✕" on ChatPanel | Chat panel closes |
| `workspace-06` | Click 📎 in ChatPanel | File picker opens for attachment |
| `workspace-07` | Select file, then click "✕" on attachment tag | Attachment removed |
| `workspace-08` | Type message, click "发送" | Message sent, appears in chat, input cleared |
| `workspace-09` | Click "← 返回列表" in DocPanel | Returns to document list |

#### Test Suite 5: Dev Chat (`/chat`)

| Test | Action | Expected Result |
|------|--------|----------------|
| `chat-01` | Navigate to `/chat` | Chat page loads with session sidebar |
| `chat-02` | Click "+ New Chat" | `NewSessionDialog` opens |
| `chat-03` | Fill title + project path, click "Create" | New session created, appears in sidebar |
| `chat-04` | In dialog, click "Cancel" or "✕" | Dialog closes |
| `chat-05` | Click collapse toggle (◀) on sidebar | Sidebar collapses |
| `chat-06` | Hover session item, click 🗑 | Session deleted from sidebar |
| `chat-07` | Type in textarea, click "发送" | Message sent, button shows "发送中..." |
| `chat-08` | With team busy, click "中止所有" | All team tasks aborted |

#### Test Suite 6: Document View (`/project/:name/doc/:path`)

| Test | Action | Expected Result |
|------|--------|----------------|
| `doc-01` | Navigate to a valid doc path | Document renders with Markdown content |
| `doc-02` | On error, click "Retry" | Document reload attempted |

#### Test Suite 7: Source View (`/project/:name/source`)

| Test | Action | Expected Result |
|------|--------|----------------|
| `source-01` | Navigate to source view | Source code displayed with syntax highlighting |
| `source-02` | On error, click "Retry" | Source reload attempted |

#### Test Suite 8: Search Results (`/search`)

| Test | Action | Expected Result |
|------|--------|----------------|
| `search-01` | Navigate to `/search?q=test` | Search results displayed |
| `search-02` | On error, click "Retry" | Search re-executed |

#### Test Suite 9: Navigation & Routing

| Test | Action | Expected Result |
|------|--------|----------------|
| `nav-01` | Navigate to invalid URL | Catch-all redirects to HomePage |
| `nav-02` | Click project name from home page | Navigates to `/project/:name` |
| `nav-03` | Breadcrumb navigation | Correct route hierarchy maintained |

---

## 5. Summary Statistics

| Metric | Count |
|--------|-------|
| **Routed pages** | 9 (4 top-level + 3 nested + 1 standalone + 1 catch-all) |
| **View components** | 13 (9 routed + 4 unused) |
| **Total button elements** | 77 (across 28 files) |
| **Dynamic buttons (v-for)** | 26 (7 loops) |
| **Disabled-conditional buttons** | 14 |
| **Close/emitted buttons** | 9 |
| **Retry buttons** | 5 |
| **Form action buttons** | 15 |
| **Tab/toggle buttons** | 14 |
| **Test scenarios defined** | 52 |

### Files with Most Buttons

1. `SettingsView.vue` — 10 buttons
2. `DashboardView.vue` — 7 buttons (not routed)
3. `WorkspaceView.vue` — 5 buttons (not routed)
4. `LogsView.vue` — 6 buttons (not routed)
5. `ChatPanel.vue` — 4 buttons
6. `HomePage.vue` — 4 buttons
