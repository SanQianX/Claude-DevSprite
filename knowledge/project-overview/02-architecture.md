---
title: 系统架构
category: architecture
updatedAt: 2026-04-25
---

# 系统架构

## 总体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Claude-DevSprite 系统架构                       │
│                                                                      │
  ┌────────────────────────────────────────────────────────────────┐
  │                    1. 生命周期钩子层                             │
  │  SessionStart → UserPromptSubmit → PostToolUse → SessionEnd   │
  │       │              │                 │              │         │
  │  初始化 Worker   拦截 /kb 命令    检测文件变更    资源清理     │
  └────────────────────────────────────────────────────────────────┘
                              ↓
  ┌────────────────────────────────────────────────────────────────┐
  │              2. Git Commit 检测层（三级自动降级）                │
  │                                                                 │
  │  Post-Commit Hook → .git 目录监控 → Reflog 轮询                │
  │  (实时, 零延迟)    (毫秒级延迟)     (秒级间隔, 兜底)              │
  └────────────────────────────────────────────────────────────────┘
                              ↓ Commit Event
  ┌────────────────────────────────────────────────────────────────┐
  │                    3. AI 分析引擎（7 步流水线）                   │
  │                                                                 │
  │  DiffCollector → ContextBuilder → ModeDecider → PromptBuilder  │
  │       → AIProvider → ResponseParser → DocumentGenerator        │
  └────────────────────────────────────────────────────────────────┘
                              ↓
  ┌────────────────────────────────────────────────────────────────┐
  │                    4. 知识库管理层                               │
  │  StorageManager → RelationEngine → LinkIndexer → GitSyncManager│
  │  ConflictResolver → DocumentWriter                              │
  └────────────────────────────────────────────────────────────────┘
                              ↓
  ┌────────────────────────────────────────────────────────────────┐
  │                    5. Worker 服务层                              │
  │  Express HTTP Server + REST API + SQLite DB + TaskQueue        │
  │  中间件: CORS / Logger / ErrorHandler                          │
  └────────────────────────────────────────────────────────────────┘
                              ↓
  ┌────────────────────────────────────────────────────────────────┐
  │                    6. Web 前端层                                 │
  │  Vue 3 SPA + Pinia Stores + Vue Router + Markdown/Source 渲染  │
  └────────────────────────────────────────────────────────────────┘
```

## 各层详细说明

### 第 1 层：生命周期钩子层

代码位于 [src/hooks/](/project/Claude-DevSprite/source?path=src/hooks/index.ts)，是系统启动和管理的入口点。

| 钩子 | 文件 | 职责 |
|------|------|------|
| SessionStart | [sessionStart.ts](/project/Claude-DevSprite/source?path=src/hooks/sessionStart.ts) | 初始化数据库、启动 Worker 服务、触发项目发现 |
| UserPromptSubmit | [userPromptSubmit.ts](/project/Claude-DevSprite/source?path=src/hooks/userPromptSubmit.ts) | 拦截 `/kb` 命令（status / analyze / help） |
| PostToolUse | [postToolUse.ts](/project/Claude-DevSprite/source?path=src/hooks/postToolUse.ts) | 追踪文件修改操作（Write / Edit / NotebookEdit） |
| SessionEnd | [sessionEnd.ts](/project/Claude-DevSprite/source?path=src/hooks/sessionEnd.ts) | 停止检测器、关闭数据库连接、清理资源 |

### 第 2 层：Git Commit 检测层

代码位于 [src/detectors/](/project/Claude-DevSprite/source?path=src/detectors/index.ts)，负责自动检测 Git 仓库中的新提交事件。

**三级降级策略**（由 [detectorFactory.ts](/project/Claude-DevSprite/source?path=src/detectors/detectorFactory.ts) 协调）：

1. **Post-Commit Hook** — 在 `.git/hooks/post-commit` 注入通知脚本，通过 HTTP POST 通知 Worker
2. **.git 目录监控** — chokidar 监控 `.git/HEAD` 和 `.git/refs/heads`，带 200ms 防抖
3. **Reflog 轮询** — 定期 `git rev-parse HEAD` 比较哈希值，兼容性最强的兜底方案

所有检测策略最终产出统一的 `CommitEvent` 对象（定义于 [types.ts](/project/Claude-DevSprite/source?path=src/detectors/types.ts)），包含 repoPath、commitHash、commitMessage、author、timestamp、changedFiles 等字段。

### 第 3 层：AI 分析引擎

代码位于 [src/analyzer/](/project/Claude-DevSprite/source?path=src/analyzer/index.ts)，是系统最核心的模块。

**7 步流水线**（由 [pipeline.ts](/project/Claude-DevSprite/source?path=src/analyzer/pipeline.ts) 编排）：

```
DiffCollector.collectDiffs(commitHash)
  → ContextBuilder.buildContext(commitHash, diffs)
    → ModeDecider.decideAnalysisMode(diffs)
      → PromptBuilder.buildPrompt(context)
        → AIProvider.callAI(prompt)
          → ResponseParser.parseResponse(response)
            → DocumentGenerator.generateDocuments(parsed)
```

**双模式 AI 调用**（[aiProvider.ts](/project/Claude-DevSprite/source?path=src/analyzer/aiProvider.ts)）：
- **SDK 模式**：有 API Key 时使用 Anthropic SDK 直连，支持自定义 baseURL（适配 GLM 等代理）
- **CLI 模式**：回退到 Claude CLI 子进程调用
- 支持指数退避重试（默认 2 次，基础延迟 2000ms）

配置来源优先级：`process.env` > `~/.claude-dev-sprite/.env` > `worker-env.json`

### 第 4 层：知识库管理层

代码位于 [src/knowledge/](/project/Claude-DevSprite/source?path=src/knowledge/index.ts)。

| 组件 | 文件 | 职责 |
|------|------|------|
| StorageManager | [storageManager.ts](/project/Claude-DevSprite/source?path=src/knowledge/storageManager.ts) | 文档的 CRUD、目录结构管理 |
| RelationEngine | [relationEngine.ts](/project/Claude-DevSprite/source?path=src/knowledge/relationEngine.ts) | 文档间关联关系管理 |
| LinkIndexer | [linkIndexer.ts](/project/Claude-DevSprite/source?path=src/knowledge/linkIndexer.ts) | 文档内链接索引与解析 |
| GitSyncManager | [gitSyncManager.ts](/project/Claude-DevSprite/source?path=src/knowledge/gitSyncManager.ts) | 知识库 Git 提交与同步 |
| ConflictResolver | [conflictResolver.ts](/project/Claude-DevSprite/source?path=src/knowledge/conflictResolver.ts) | 合并冲突检测与解决 |
| DocumentWriter | [documentWriter.ts](/project/Claude-DevSprite/source?path=src/knowledge/documentWriter.ts) | 带前端元数据（frontmatter）的文档写入 |

### 第 5 层：Worker 服务层

代码位于 [src/worker/](/project/Claude-DevSprite/source?path=src/worker/index.ts)。

- **HTTP 服务器**：[server.ts](/project/Claude-DevSprite/source?path=src/worker/server.ts)，基于 Express，端口 38888
- **数据库**：[db.ts](/project/Claude-DevSprite/source?path=src/worker/db.ts)，sql.js（SQLite WASM），存储在 `~/.claude/claude-dev-sprite/data/dev-sprite.db`
- **任务队列**：[taskQueue.ts](/project/Claude-DevSprite/source?path=src/worker/taskQueue.ts)，异步处理分析任务
- **检测器注册表**：[detectorRegistry.ts](/project/Claude-DevSprite/source?path=src/worker/detectorRegistry.ts)，管理每个项目的检测器实例

**API 路由结构**（[routes/](/project/Claude-DevSprite/source?path=src/worker/routes/index.ts)）：

| 路由模块 | 前缀 | 功能 |
|----------|------|------|
| projects | `/api/projects` | 项目 CRUD 与发现 |
| files | `/api/files` | 文件树浏览与源码读取 |
| analysis | `/api/analysis` | 触发与查询分析任务 |
| search | `/api/search` | 全文搜索 |
| relations | `/api/relations` | 文档关联关系查询 |
| config | `/api/config` | 配置读写 |
| git | `/api/git` | Git 操作与 Hook 通知 |
| internal | `/api/internal` | 内部管理接口 |

**中间件栈**（[middleware/](/project/Claude-DevSprite/source?path=src/worker/middleware/cors.ts)）：
- CORS 跨域支持
- 请求日志记录
- 全局错误处理

### 第 6 层：Web 前端层

代码位于 [web/src/](/project/Claude-DevSprite/source?path=web/src/main.ts)。

基于 Vue 3 Composition API 构建的单页应用：

- **路由**：[router/index.ts](/project/Claude-DevSprite/source?path=web/src/router/index.ts) — 首页、项目布局、文档/源码视图、搜索结果
- **状态管理**：Pinia Stores（projects、knowledge、search、ui）
- **组合式函数**：useBreadcrumb、useDocument、useFileTree、useProjectList、useToc
- **组件体系**：Layout 组件（Header/Sidebar/TocPanel）、Tree 组件、Viewer 组件
- **API 客户端**：[api/client.ts](/project/Claude-DevSprite/source?path=web/src/api/client.ts) — 统一封装后端接口调用

## 数据流图

```
                    ┌──────────┐
     git commit ──→ │ Detector │
                    └─────┬────┘
                          │ CommitEvent
                          ↓
                 ┌────────────────┐
                 │  TaskQueue     │
                 │  (异步队列)     │
                 └───────┬────────┘
                         │
                         ↓
              ┌─────────────────────┐
              │  Analysis Pipeline  │
              │  (7 步流水线)        │
              └──────────┬──────────┘
                         │ GeneratedDocument[]
                         ↓
              ┌─────────────────────┐
              │  Knowledge Layer    │
              │  (写入 knowledge/)  │
              └──────────┬──────────┘
                         │
                    ┌────┴────┐
                    ↓         ↓
             ┌──────────┐  ┌──────────┐
             │ SQLite DB│  │ Git Repo │
             │ (元信息) │  │(知识文件)│
             └─────┬────┘  └─────┬────┘
                   │             │
                   └──────┬──────┘
                          ↓
                 ┌────────────────┐
                 │  REST API      │
                 │  (Express)     │
                 └───────┬────────┘
                         │
                         ↓
                 ┌────────────────┐
                 │  Vue 3 SPA     │
                 │  (Web Dashboard)│
                 └────────────────┘
```

## 守护进程架构

系统通过 [daemon.js](/project/Claude-DevSprite/source?path=dev-scripts/daemon.js) 支持后台运行：

- **启动**：`node dev-scripts/daemon.js start` — 创建子进程运行 Worker，写入 PID 文件
- **停止**：`node dev-scripts/daemon.js stop` — 读取 PID，发送终止信号
- **状态**：`node dev-scripts/daemon.js status` — 检查进程是否存活
- **环境传递**：启动时将环境变量写入 `worker-env.json`，供 Worker 内的 AI Provider 读取