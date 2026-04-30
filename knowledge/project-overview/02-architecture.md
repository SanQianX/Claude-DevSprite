---
title: 系统架构
category: architecture
updatedAt: 2026-04-25
---

# 系统架构

## 总体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Claude-DevSprite 系统架构                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    1. 生命周期钩子层 (Hooks)                      │  │
│  │  SessionStart → UserPromptSubmit → PostToolUse → SessionEnd     │  │
│  │       │              │                 │              │          │  │
│  │  初始化 Worker   拦截 /kb 命令    检测文件变更    资源清理      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    ↓                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │             2. Git Commit 检测层（三级自动降级）                   │  │
│  │                                                                    │  │
│  │  Post-Commit Hook → .git 目录监控 → Reflog 轮询                   │  │
│  │  (实时, 零延迟)      (毫秒级延迟)      (秒级间隔, 兜底)             │  │
│  │                                                                    │  │
│  │  统一产出: CommitEvent { repoPath, commitHash, message, ... }    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    ↓ Commit Event                       │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                  3. AI 分析引擎（7 步流水线）                      │  │
│  │                                                                    │  │
│  │  DiffCollector → ContextBuilder → ModeDecider → PromptBuilder    │  │
│  │        → AIProvider → ResponseParser → DocumentGenerator         │  │
│  │                                                                    │  │
│  │  支持增量/全量两种分析模式                                        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    ↓                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    4. 知识库管理层                                │  │
│  │  StorageManager → RelationEngine → LinkIndexer → GitSyncManager  │  │
│  │  ConflictResolver → DocumentWriter                               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    ↓                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    5. 数据存储层                                  │  │
│  │  ┌──────────────┐  ┌──────────────────────────────────────┐       │  │
│  │  │  sql.js DB   │  │  文件系统 (knowledge/*.md)            │       │  │
│  │  │  项目元信息   │  │  结构化 Markdown + YAML Frontmatter  │       │  │
│  │  │  分析记录     │  │  可 Git 版本控制                     │       │  │
│  │  └──────────────┘  └──────────────────────────────────────┘       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    ↓                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    6. Web 展示层 (Vue 3 + Vite)                   │  │
│  │  AppHeader / AppSidebar / AppTocPanel / MarkdownViewer           │  │
│  │  FileTree / SourceViewer / SearchBar                             │  │
│  │  SSE 实时推送分析进度                                             │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 数据流详解

### 主数据流：Commit → 知识库

```
git commit
  │
  ├── [Hook] .git/hooks/post-commit 脚本执行
  │         └── HTTP POST → Worker Server /api/git/hook-notify
  │
  ├── [Watcher] chokidar 检测 .git/HEAD 或 .git/refs/heads 变化
  │         └── 比对 HEAD 哈希值，200ms 防抖后触发
  │
  └── [Poller] 定时执行 git rev-parse HEAD
            └── 哈希值变化时触发

所有路径 → 统一 CommitEvent
                │
                ↓
         AnalysisPipeline.execute()
                │
                ├── DiffCollector.collectDiffs()
                │     └── git.diffSummary() + git.diff() → DiffEntry[]
                │
                ├── ContextBuilder.buildContext()
                │     ├── git.log() 获取提交消息
                │     └── loadRelevantKnowledge() 加载相关已有文档
                │
                ├── ModeDecider.decideAnalysisMode()
                │     └── 基于变更比例、行数、文件类型决定增量/全量
                │
                ├── PromptBuilder.buildPrompt()
                │     └── 注入模板 + 变更内容 + 已有知识
                │
                ├── AIProvider.callAI()
                │     ├── SDK 模式: Anthropic SDK 直接调用
                │     └── CLI 模式: claude CLI 子进程调用
                │
                ├── ResponseParser.parseResponse()
                │     └── JSON 解析 + 文档结构规范化
                │
                └── DocumentGenerator.generateDocuments()
                      └── 应用模板 + Frontmatter → GeneratedDocument[]
```

### 辅助数据流：Web Dashboard 交互

```
浏览器 → Vite Dev Server (port 5173)
              │
              ├── GET /api/projects          → 项目列表
              ├── GET /api/files/*            → 文件树 + 文档内容
              ├── GET /api/search?q=keyword   → 全文搜索
              ├── GET /api/analysis/status     → 分析状态 (SSE)
              └── GET /api/logs                → 系统日志

所有 API → Worker Express Server (port 38888)
              │
              ├── ProjectsRoute → ProjectDiscoveryService
              ├── FilesRoute → 文件系统读取
              ├── SearchRoute → sql.js 全文检索
              ├── AnalysisRoute → AnalysisTracker + SSE
              └── LogsRoute → 日志文件 Tail
```

## 核心组件连接关系

### 后端组件依赖图

```
Worker Server (Express)
  ├── routes/analysis.ts ←── AnalysisTracker
  ├── routes/config.ts
  ├── routes/files.ts ←── 知识库文件系统
  ├── routes/git.ts ←── GitSyncManager
  ├── routes/internal.ts
  ├── routes/logs.ts ←── 日志文件
  ├── routes/projects.ts ←── ProjectDiscoveryService
  ├── routes/relations.ts ←── RelationEngine
  ├── routes/search.ts ←── 全文搜索索引
  │
  ├── middleware/cors.ts
  ├── middleware/errorHandler.ts
  ├── middleware/logger.ts
  │
  ├── db.ts ←── sql.js 数据库
  ├── sseBroadcaster.ts ←── SSE 实时推送
  └── taskQueue.ts ←── 分析任务队列
```

### 前端组件架构

```
App.vue
  ├── router/
  │     ├── Home / HomePage (项目列表)
  │     ├── ProjectLayout (项目容器)
  │     │     ├── ProjectOverview (项目概览)
  │     │     ├── DocumentView (文档阅读)
  │     │     ├── SourceView (源码预览)
  │     │     └── SearchResults (搜索结果)
  │     └── LogsView (系统日志)
  │
  ├── stores/ (Pinia)
  │     ├── projects.ts ←── 项目列表状态
  │     ├── knowledge.ts ←── 知识库文档状态
  │     ├── analysis.ts ←── 分析进度状态
  │     ├── search.ts ←── 搜索状态
  │     └── ui.ts ←── UI 全局状态
  │
  └── composables/
        ├── useBreadcrumb.ts ←── 面包屑导航
        ├── useDocument.ts ←── 文档加载与渲染
        ├── useFileTree.ts ←── 文件树构建
        └── useProjectList.ts ←── 项目列表
```

## 关键设计决策

### 三级检测策略降级

核心配置位于 [detectorFactory.ts](/project/Claude-DevSprite/source?path=src/detectors/detectorFactory.ts)，`createDetectorWithFallback()` 按序尝试三种策略，任何一级失败自动降级到下一级。`CommitDetectorManager`（[index.ts](/project/Claude-DevSprite/source?path=src/detectors/index.ts)）管理检测器生命周期。

**设计理由**：不同开发环境（Windows/macOS/Linux）对文件系统监控、Git Hook 执行的支持程度不同，三级策略确保在几乎所有环境下都能正常工作。

### 双模式 AI 调用

`AIProvider`（[aiProvider.ts](/project/Claude-DevSprite/source?path=src/analyzer/aiProvider.ts)）支持两种调用模式，配置加载优先级为：环境变量 > `~/.claude-dev-sprite/.env` > `worker-env.json`：

- **SDK 模式**：使用 `@anthropic-ai/sdk` 直连 API，支持自定义 baseURL 和 auth token
- **CLI 模式**：调用 `claude` CLI 子进程作为降级方案

### 增量/全量分析切换

`ModeDecider`（[modeDecider.ts](/project/Claude-DevSprite/source?path=src/analyzer/modeDecider.ts)）基于以下启发式规则决策：

| 条件 | 模式 |
|------|------|
| 无已有知识库 | 全量 |
| 变更文件占比 > 30% | 全量 |
| 变更行数 > 1000 | 全量 |
| 删除/重命名文件 > 5 | 全量 |
| 其他 | 增量 |

### 数据库选型

使用 sql.js（SQLite WASM）而非原生 SQLite 驱动（[db.ts](/project/Claude-DevSprite/source?path=src/worker/db.ts)），数据库路径固定在 `~/.claude/claude-dev-sprite/data/dev-sprite.db`。**设计理由**：零原生编译依赖，完美支持 Windows 等所有平台。

## 进程模型

```
Claude Code 会话
  │
  └── Claude-DevSprite Worker (Express Server)
        ├── HTTP API (port 38888)
        ├── SSE 推送
        ├── Git 检测器 (后台运行)
        │     ├── Post-Commit Hook (被动触发)
        │     ├── chokidar Watcher (事件监听)
        │     └── Reflog Poller (定时器)
        ├── AI 分析任务队列
        └── sql.js 数据库实例

Vite Dev Server (port 5173) — 前端热更新
  └── API 代理 → Worker (port 38888)
```

Worker 进程通过 [daemon.js](/project/Claude-DevSprite/source?path=dev-scripts/daemon.js) 管理启动/停止/重启，支持 PID 文件记录和日志分离。