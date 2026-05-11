# Claude-DevSprite

> Git Commit 自动监听 + AI 分析驱动的结构化知识库生成器，配备 Web Dashboard 可视化浏览与多 Agent 开发团队系统。

## 项目简介

Claude-DevSprite 是一个 **Claude Code Skill 插件**，围绕以下核心环节构成完整闭环：

```
git commit → 检测器捕获 → AI 分析 → 生成文档 → Web Dashboard 展示
```

1. **自动监听** — 三级 Git Commit 检测策略（Post-Commit Hook → .git 目录监控 → Reflog 轮询），自动降级，零配置即可工作
2. **AI 分析** — 复用 Claude Code 模型配置（Anthropic SDK 直连 + Claude CLI 子进程双模式），将代码 Diff 转化为高质量文档
3. **生成/更新** — 以 `knowledge/` 目录为载体，产出带 YAML Frontmatter 的结构化 Markdown 文档，支持增量更新与全量重建
4. **可视化浏览** — Vue 3 + Vite Web Dashboard（默认 `localhost:38888`），提供文档树、Markdown 渲染、源码预览、全文搜索、TOC 导航、实时分析进度推送
5. **多 Agent 团队** — Lead / Dev / Test 三角色 Agent 协作系统，支持实时聊天与任务执行
6. **系统配置** — 可视化配置 AI 模型、Agent Teams、Skills 及系统参数

---

## 功能特性

### Git 检测

- 三级自动降级检测策略，确保在所有环境下工作
- **Post-Commit Hook**（实时，零延迟）
- **.git 目录 chokidar 监控**（毫秒级延迟）
- **Reflog 轮询**（秒级间隔，兜底方案）
- 自动去重窗口，防止重复触发

### AI 分析引擎

- 7 步流水线：Diff 收集 → 上下文构建 → 模式决策 → Prompt 构建 → AI 调用 → 响应解析 → 文档生成
- 增量/全量分析自动切换（基于变更比例、行数、文件类型等启发式规则）
- 支持 Anthropic SDK 直连和 Claude CLI 子进程两种调用模式
- 可配置重试策略和 Token 限制

### 知识库管理

- 结构化 Markdown 文档 + YAML Frontmatter
- 文档类型：概览、架构、模块、技术栈、变更日志等
- 增量更新，随项目演进自动丰富
- 可纳入 Git 版本控制，随代码一起分发
- 文档间链接索引与关系图谱

### 多 Agent 团队系统

- **三角色架构**：Lead（架构决策）、Dev（代码实现）、Test（质量验证）
- **实时聊天**：WebSocket 双向通信，支持会话管理与消息持久化
- **技能系统**：Agent 可配置 Skills（如 Playwright 自动化测试）
- **工具权限控制**：每个 Agent 独立的 allowed/disallowed tools 列表
- **任务队列**：支持多项目并行执行
- **会话管理**：创建/切换/删除会话，消息历史持久化
- **思考过程展示**：实时展示 Agent 思考过程，支持折叠/展开
- **工具调用卡片**：ToolCard 组件可视化展示工具调用结果

### Web Dashboard

| 功能 | 说明 |
|------|------|
| 首页 | 项目表格列表，显示仓库类型、文档数、更新时间、分析状态 |
| 文档浏览 | 文件树导航 + Markdown 渲染 + 目录跳转 + 源码预览 |
| 全文搜索 | 跨文档关键词搜索，结果高亮显示 |
| 实时进度 | SSE 推送分析进度，表格行内状态指示器 |
| 控制台面板 | 首页底部可折叠日志面板，支持级别过滤与自动刷新 |
| 开发聊天 | 项目页面内 FAB 按钮，进入 Agent 团队协作聊天 |
| 系统设置 | AI 模型配置、Agent Teams 管理、Skills 管理、系统参数 |

### 安全特性

- Path traversal 路径穿越防护
- DOMPurify XSS 防护（Markdown 渲染）
- asyncHandler 统一异步错误处理
- CORS 中间件保护
- 敏感配置键值过滤（apiKey、password 等不可通过 API 写入）

---

## 快速开始

### 前置要求

- Node.js >= 18
- Git
- Claude Code（或设置 `ANTHROPIC_API_KEY` 环境变量）

### 安装

```bash
# 克隆仓库
git clone https://github.com/SanQianX/Claude-DevSprite.git
cd Claude-DevSprite

# 安装后端依赖
npm install

# 安装前端依赖
cd web && npm install && cd ..

# 构建后端
npm run build

# 构建前端
cd web && npm run build && cd ..
```

### 配置 AI

设置环境变量（任选一种）：

```bash
# 方式一：Anthropic API Key（SDK 直连模式）
export ANTHROPIC_API_KEY="sk-ant-..."

# 方式二：自定义 API 端点（兼容其他 Claude API 提供商）
export ANTHROPIC_API_KEY="your-key"
export ANTHROPIC_BASE_URL="https://your-api-endpoint"

# 方式三：在 worker-env.json 中配置
# 编辑 dev-scripts/worker-env.json 文件

# 方式四：通过 Web Dashboard 设置页面配置
# 启动后访问 http://localhost:38888/settings
```

### 启动

```bash
# 一键构建前端+后端并启动（推荐）
npm run start:all
```

启动后打开浏览器访问 `http://localhost:38888`。

#### 常用命令

```bash
npm run start:all       # 构建全部 + 启动守护进程
npm run daemon:start    # 仅启动守护进程（需先构建）
npm run daemon:stop     # 停止守护进程
npm run daemon:restart  # 重启守护进程
npm run daemon:status   # 查看运行状态
npm run build:all       # 仅构建前端+后端，不启动
npm run build:web       # 仅构建前端
npm run build           # 仅构建后端
```

#### 前端开发模式

```bash
cd web
npm run dev
# Vite 开发服务器运行在 http://localhost:5173
# API 请求自动代理到后端 38888 端口
```

---

## 项目结构

```
Claude-DevSprite/
├── src/
│   ├── analyzer/               # AI 分析引擎
│   │   ├── aiProvider.ts       # Claude AI 调用（SDK + CLI 双模式）
│   │   ├── pipeline.ts         # 7 步分析流水线
│   │   ├── diffCollector.ts    # Git Diff 收集器
│   │   ├── contextBuilder.ts   # 分析上下文构建
│   │   ├── modeDecider.ts      # 增量/全量模式决策
│   │   ├── promptBuilder.ts    # Prompt 模板构建
│   │   ├── promptTemplates.ts  # Prompt 模板库
│   │   ├── responseParser.ts   # AI 响应解析器
│   │   ├── documentGenerator.ts # 文档生成器
│   │   └── types.ts            # 类型定义
│   ├── detectors/              # Git Commit 检测器
│   │   ├── postCommitHook.ts   # Post-Commit Hook 检测
│   │   ├── dotGitWatcher.ts    # .git 目录监控
│   │   ├── reflogPoller.ts     # Reflog 轮询
│   │   └── detectorFactory.ts  # 三级降级工厂
│   ├── hooks/                  # Claude Code 生命周期钩子
│   │   ├── sessionStart.ts     # 会话启动：初始化数据库、启动 Worker
│   │   ├── userPromptSubmit.ts # 用户输入：拦截 /kb 命令
│   │   ├── postToolUse.ts      # 工具调用后：跟踪文件修改
│   │   └── sessionEnd.ts       # 会话结束：清理资源
│   ├── knowledge/              # 知识库管理
│   │   ├── storageManager.ts   # 文件读写管理
│   │   ├── documentWriter.ts   # 文档写入器
│   │   ├── relationEngine.ts   # 文档关系引擎
│   │   ├── linkIndexer.ts      # 链接索引器
│   │   ├── gitSyncManager.ts   # Git 同步管理
│   │   ├── conflictResolver.ts # 冲突解决器
│   │   └── types.ts            # 类型定义
│   ├── teams/                  # 多 Agent 团队系统
│   │   ├── teamManager.ts      # 团队管理器
│   │   ├── teamExecutor.ts     # 团队执行器
│   │   ├── teamConfig.ts       # 团队配置管理
│   │   ├── fileProtocol.ts     # 文件协议通信
│   │   ├── types.ts            # 类型定义（TeamConfig, Skill 等）
│   │   └── index.ts            # 模块入口
│   ├── services/               # 业务服务
│   │   └── projectDiscovery.ts # 项目自动发现
│   ├── worker/                 # Express HTTP Server + WebSocket
│   │   ├── server.ts           # 服务入口（HTTP + WebSocket）
│   │   ├── index.ts            # Worker 启动
│   │   ├── wsServer.ts         # WebSocket 服务器
│   │   ├── wsHandler.ts        # WebSocket 消息处理器
│   │   ├── sessionManager.ts   # 会话管理器
│   │   ├── db.ts               # SQLite 数据库
│   │   ├── taskQueue.ts        # 任务队列
│   │   ├── sseBroadcaster.ts   # SSE 实时推送
│   │   ├── analysisTracker.ts  # 分析进度追踪
│   │   ├── detectorRegistry.ts # 检测器注册
│   │   ├── routes/             # API 路由模块
│   │   │   ├── index.ts        # 路由注册
│   │   │   ├── projects.ts     # 项目管理 API + 文件系统浏览
│   │   │   ├── sessions.ts     # 会话 REST API
│   │   │   ├── files.ts        # 文件操作 API
│   │   │   ├── search.ts       # 搜索 API
│   │   │   ├── git.ts          # Git 操作 API
│   │   │   ├── analysis.ts     # 分析 API
│   │   │   ├── relations.ts    # 关系 API
│   │   │   ├── config.ts       # 配置 API
│   │   │   ├── logs.ts         # 日志 API
│   │   │   ├── teams.ts        # 团队 API
│   │   │   └── internal.ts     # 内部 API
│   │   └── middleware/         # 中间件
│   │       ├── cors.ts         # CORS 处理
│   │       ├── errorHandler.ts # 错误处理
│   │       └── logger.ts       # 请求日志
│   ├── utils/                  # 工具函数
│   │   ├── fs.ts               # 文件系统（含路径安全检查）
│   │   ├── git.ts              # Git 操作封装
│   │   ├── logger.ts           # 日志工具
│   │   ├── markdown.ts         # Markdown 解析
│   │   └── path.ts             # 路径工具
│   ├── config.ts               # 核心配置定义
│   └── index.ts                # 主入口
├── web/                        # Vue 3 前端
│   ├── src/
│   │   ├── api/                # API 客户端
│   │   │   ├── client.ts       # HTTP 客户端封装（含 unwrap 工具函数）
│   │   │   ├── websocket.ts    # WebSocket 客户端（自动重连、心跳、消息队列）
│   │   │   ├── projects.ts     # 项目 API
│   │   │   ├── files.ts        # 文件 API
│   │   │   ├── search.ts       # 搜索 API
│   │   │   ├── analysis.ts     # 分析 API
│   │   │   ├── logs.ts         # 日志 API
│   │   │   ├── teams.ts        # 团队 API
│   │   │   └── config.ts       # 配置 API
│   │   ├── views/              # 页面组件
│   │   │   ├── HomePage.vue    # 首页（项目表格 + 控制台面板）
│   │   │   ├── ProjectLayout.vue # 项目布局（三栏 + FAB 聊天按钮）
│   │   │   ├── ProjectOverview.vue # 项目概览
│   │   │   ├── DocumentView.vue # 文档浏览
│   │   │   ├── SourceView.vue  # 源码预览
│   │   │   ├── SearchResults.vue # 搜索结果
│   │   │   ├── DevChatView.vue # 开发聊天（WebSocket + 会话管理）
│   │   │   ├── SettingsView.vue # 系统设置
│   │   │   └── LogsView.vue    # 日志页面（旧版，已废弃）
│   │   ├── components/         # UI 组件
│   │   │   ├── layout/         # 布局组件
│   │   │   │   ├── AppHeader.vue   # 全局头部
│   │   │   │   ├── AppSidebar.vue  # 文件树侧栏
│   │   │   │   └── AppTocPanel.vue # TOC 目录面板
│   │   │   ├── home/           # 首页组件
│   │   │   │   ├── ProjectList.vue  # 项目表格
│   │   │   │   ├── ProjectCard.vue  # 项目行（含状态指示）
│   │   │   │   ├── AddProjectModal.vue # 添加项目弹窗（含文件夹浏览器）
│   │   │   │   ├── ConsolePanel.vue # 控制台面板
│   │   │   │   ├── LogFilters.vue   # 日志级别过滤
│   │   │   │   └── LogOutput.vue    # 日志输出区
│   │   │   ├── chat/           # 聊天组件
│   │   │   │   ├── ChatInput.vue    # 聊天输入
│   │   │   │   ├── ChatMessage.vue  # 消息气泡
│   │   │   │   ├── ChatMessageList.vue # 消息列表（含思考状态）
│   │   │   │   └── ToolCard.vue     # 工具调用结果卡片
│   │   │   ├── session/        # 会话组件
│   │   │   │   ├── SessionSidebar.vue # 会话侧边栏
│   │   │   │   └── NewSessionDialog.vue # 新建会话对话框
│   │   │   ├── teams/          # 团队组件
│   │   │   │   └── TeamStatusPanel.vue # 团队状态面板
│   │   │   ├── common/         # 通用组件
│   │   │   │   ├── SearchBar.vue  # 搜索框
│   │   │   │   ├── Breadcrumb.vue # 面包屑
│   │   │   │   ├── LoadingSpinner.vue # 加载动画
│   │   │   │   ├── EmptyState.vue  # 空状态
│   │   │   │   └── FolderBrowser.vue # 文件夹浏览器
│   │   │   ├── tree/           # 文件树组件
│   │   │   │   ├── FileTree.vue
│   │   │   │   └── FileTreeNode.vue
│   │   │   └── viewer/         # 查看器组件
│   │   │       ├── MarkdownViewer.vue # Markdown 渲染
│   │   │       └── SourceViewer.vue   # 源码高亮
│   │   ├── stores/             # Pinia 状态管理
│   │   │   ├── projects.ts     # 项目状态
│   │   │   ├── knowledge.ts    # 知识库状态
│   │   │   ├── search.ts       # 搜索状态
│   │   │   ├── analysis.ts     # 分析进度 + SSE 连接
│   │   │   ├── logs.ts         # 日志状态 + 解析 + 过滤
│   │   │   ├── teams.ts        # 团队配置与状态
│   │   │   ├── chat.ts         # 聊天消息（WebSocket 通信 + 会话管理）
│   │   │   └── ui.ts           # UI 偏好
│   │   ├── composables/        # Vue 组合式函数
│   │   │   ├── useBreadcrumb.ts
│   │   │   ├── useDocument.ts
│   │   │   ├── useFileTree.ts
│   │   │   ├── useProjectList.ts
│   │   │   └── useToc.ts
│   │   ├── router/             # Vue Router
│   │   │   └── index.ts
│   │   └── types/              # TypeScript 类型定义
│   │       ├── index.ts
│   │       └── session.ts      # 会话与消息类型
│   └── vite.config.ts          # Vite 配置
├── knowledge/                  # 生成的知识库文档
├── tests/                      # 后端测试
├── web/tests/                  # 前端测试
├── docs/                       # 项目文档
│   ├── designs/                # 设计文档
│   ├── api-teams.md            # Teams API 文档
│   └── user-manual-teams.md    # 用户手册
├── dev-scripts/                # 开发脚本
│   ├── daemon.js               # 守护进程管理器
│   └── worker-env.json         # Worker 环境变量
└── .claude/                    # Claude Code 配置
    ├── skills/                 # Skill 定义
    └── hooks/                  # 钩子配置
```

---

## API 端点

### 基础服务

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/stream` | SSE 实时推送（分析进度） |
| WS | `ws://localhost:38888/ws` | WebSocket 实时通信（聊天、会话） |

### 项目管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects` | 项目列表 |
| GET | `/api/projects/:name` | 项目详情 |
| GET | `/api/projects/:name/analysis-status` | 分析状态 |
| POST | `/api/projects/:name/analyze` | 触发全量分析 |
| GET | `/api/projects/:name/tree` | 项目文件树 |

### 文件系统浏览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/filesystem/drives` | 获取系统磁盘列表 |
| GET | `/api/filesystem/browse?path=` | 浏览本地目录 |

### 文件与文档

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/:name/files` | 文件列表 |
| GET | `/api/projects/:name/files/*` | 读取文件/文档内容 |
| GET | `/api/projects/:name/source` | 读取源码文件 |

### 搜索

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/search` | 全文搜索 |
| GET | `/api/projects/:name/search` | 项目内搜索 |

### 团队系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/teams` | 获取所有团队配置 |
| GET | `/api/teams/:name` | 获取单个团队配置 |
| PUT | `/api/teams/:name` | 更新团队配置 |
| GET | `/api/teams/:name/status` | 获取团队状态 |
| GET | `/api/teams/status/all` | 获取所有团队状态 |
| POST | `/api/teams/:name/test` | 测试团队连通性 |
| POST | `/api/teams/:name/abort` | 中止团队执行 |
| POST | `/api/teams/abort-all` | 中止所有团队 |

### 会话管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions?projectPath=` | 获取会话列表 |
| POST | `/api/sessions` | 创建新会话 |
| GET | `/api/sessions/:id` | 获取会话详情（含消息历史） |
| DELETE | `/api/sessions/:id` | 删除会话 |
| POST | `/api/sessions/:id/messages` | 向会话发送消息 |

### 聊天（WebSocket）

实时通信通过 WebSocket 连接 `ws://localhost:38888/ws` 实现，支持：

- 认证握手（`auth` / `auth.result`）
- 会话消息收发（`session.create` / `session.send` / `session.message`）
- 会话列表同步（`session.list`）
- Agent 思考状态推送（`thinking` / `thinking_delta`）
- 工具调用结果推送（`tool_call` / `tool_result`）

### 系统管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/config` | 获取系统配置 |
| PATCH | `/api/config` | 部分更新配置 |
| PUT | `/api/config` | 替换配置 |
| GET | `/api/logs` | 获取运行日志 |

---

## 技术栈

### 后端

| 技术 | 用途 |
|------|------|
| TypeScript + Node.js | 运行时与语言 |
| Express | HTTP Server |
| ws | WebSocket 实时通信 |
| sql.js | SQLite WASM，零原生编译依赖 |
| simple-git | Git 操作封装 |
| chokidar | 文件系统监控 |
| @anthropic-ai/sdk | Anthropic AI API |

### 前端

| 技术 | 用途 |
|------|------|
| Vue 3 + Composition API | 前端框架 |
| Vite | 构建工具 |
| Pinia | 状态管理 |
| Vue Router | 路由管理 |
| marked | Markdown 解析 |
| highlight.js | 代码语法高亮（按需加载） |
| DOMPurify | XSS 防护 |

---

## 默认配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `server.port` | `38888` | Worker HTTP 端口 |
| `knowledge.directoryName` | `knowledge` | 知识库目录名 |
| `knowledge.autoCommit` | `false` | 自动提交知识库变更 |
| `analysis.mode` | `incremental` | 默认分析模式 |
| `analysis.fullAnalysisIntervalDays` | `30` | 全量分析间隔（天） |
| `analysis.diffMaxTokens` | `8000` | Diff 最大 Token 数 |
| `analysis.maxRetries` | `3` | AI 调用重试次数 |
| `detection.preferredStrategy` | `hook` | 优先检测策略 |
| `detection.pollerIntervalMs` | `5000` | 轮询间隔（毫秒） |
| `logging.level` | `info` | 日志级别 |
| `projectDiscovery.autoDiscover` | `true` | 自动发现项目 |
| `projectDiscovery.maxDepth` | `3` | 项目扫描最大深度 |

---

## 多 Agent 团队系统

### 架构

```
用户请求 → WebSocket → SessionManager → TeamExecutor → Claude CLI
                ↓              ↓                ↓
           会话管理        消息持久化       子进程执行
                ↓              ↓                ↓
           状态追踪        实时推送        stream-json
```

### 团队角色

| 角色 | 职责 | 默认工具 |
|------|------|----------|
| **Lead** | 架构决策、任务分解 | Read, Glob, Grep, WebSearch |
| **Dev** | 代码实现、文件修改 | Read, Write, Edit, Bash(npm/npx/git) |
| **Test** | 质量验证、自动化测试 | Read, Glob, Grep, Bash(test/vitest/playwright) |

### 配置文件

团队配置存储在项目目录 `.Claude-DevSprite/teams/{teamName}/config.json`：

```json
{
  "name": "dev",
  "displayName": "开发",
  "model": "claude-sonnet-4-20250514",
  "maxTurns": 30,
  "allowedTools": ["Read", "Write", "Edit", "Bash(npm:*)"],
  "disallowedTools": ["Bash(rm *)"],
  "timeout": 300000,
  "skills": []
}
```

---

## 作为 Claude Code Skill 使用

Claude-DevSprite 通过四个生命周期钩子与 Claude Code 集成：

| 钩子 | 触发时机 | 功能 |
|------|----------|------|
| `SessionStart` | 会话启动 | 初始化数据库、启动 Worker、触发项目发现 |
| `UserPromptSubmit` | 用户输入 | 拦截 `/kb` 命令，提供状态查询和手动分析 |
| `PostToolUse` | 工具调用后 | 跟踪文件修改操作 |
| `SessionEnd` | 会话结束 | 停止检测器、关闭数据库、清理资源 |

---

## 测试

```bash
# 后端测试
npm test

# 前端组件测试
cd web && npx vitest run tests/components/
```

---

## License

MIT
