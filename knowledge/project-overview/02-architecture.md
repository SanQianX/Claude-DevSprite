---
title: 系统架构
category: architecture
date: 2026-04-25
updatedAt: 2026-04-25
---

# 系统架构

## 总体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Claude-DevSprite 系统架构                       │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    1. 生命周期钩子层                             │ │
│  │  SessionStart → UserPromptSubmit → PostToolUse → SessionEnd   │ │
│  │       │              │                 │              │         │ │
│  │  初始化 Worker   拦截命令         检测 Git 操作    资源清理     │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              ↓                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │              2. Git Commit 检测层（三级自动降级）                │ │
│  │                                                                 │ │
│  │  Post-Commit Hook → .git 目录监控 → Reflog 轮询                │ │
│  │  (实时, 零延迟)    (毫秒级延迟)     (5秒间隔, 兜底)              │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              ↓ Commit Event                         │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    3. AI 分析引擎                                │ │
│  │                                                                 │ │
│  │  DiffCollector → ContextBuilder → ModeDecider → PromptBuilder  │ │
│  │       → AIProvider → ResponseParser → DocumentGenerator        │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              ↓                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    4. 知识库管理层                               │ │
│  │  文档存储管理器 → 关联关系引擎 → Git 同步管理器                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              ↓                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    5. Worker 服务 (localhost:38888)              │ │
│  │  Express HTTP Server + SQLite 数据库 + 任务队列                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              ↓                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    6. Web Dashboard (Vue 3 SPA)                 │ │
│  │  项目列表 + 文件树 + Markdown渲染 + 源码预览 + 文档跳转         │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## 核心数据流

### 提交分析流程

```
Git Commit Event
       │
       ▼
┌──────────────────┐
│  Diff Collector   │  收集变更文件和 diff
│  src/analyzer/    │
│  diffCollector.ts │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  Context Builder  │  构建分析上下文（项目结构、已有知识库）
│  src/analyzer/    │
│  contextBuilder.ts│
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  Mode Decider     │  决定增量/全量分析模式
│  src/analyzer/    │
│  modeDecider.ts   │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  Prompt Builder   │  构建发送给 AI 的提示词
│  src/analyzer/    │
│  promptBuilder.ts │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  AI Provider      │  调用 Claude API 进行分析
│  src/analyzer/    │
│  aiProvider.ts    │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  Document Writer  │  写入 Markdown 文档到 knowledge/ 目录
│  src/analyzer/    │
│  documentGen.ts   │
└──────────────────┘
```

## 进程架构

Claude-DevSprite 运行在独立的后台守护进程中，与 Claude Code 解耦：

```
┌──────────────────────────┐
│     Claude Code Session  │
│                          │
│  ┌─────────────────┐    │
│  │ Claude Code CLI  │    │
│  └────────┬─────────┘    │
│           │ hooks 触发    │
└───────────┼──────────────┘
            │
            ▼
┌──────────────────────────┐
│   独立守护进程 (daemon)   │
│                          │
│  ┌─────────────────┐    │
│  │ Express Server   │    │
│  │  localhost:38888 │    │
│  └─────────────────┘    │
│  ┌─────────────────┐    │
│  │ Git 检测器       │    │
│  └─────────────────┘    │
│  ┌─────────────────┐    │
│  │ AI 分析引擎      │    │
│  └─────────────────┘    │
│  ┌─────────────────┐    │
│  │ SQLite 数据库    │    │
│  └─────────────────┘    │
└──────────────────────────┘
```

**守护进程管理**：
- 启动：`npm run daemon:start`（PowerShell `Start-Process -WindowStyle Hidden`）
- 停止：`npm run daemon:stop`
- 状态：`npm run daemon:status`
- 重启：`npm run daemon:restart`
- PID 文件：`dev-scripts/worker.pid`

## 多项目支持

系统支持同时监控多个 Git 项目：

```
Worker Server
  ├── Project: Claude-DevSprite
  │   ├── Detector (Post-Commit Hook)
  │   └── knowledge/
  ├── Project: AnotherProject
  │   ├── Detector (Reflog Poller)
  │   └── knowledge/
  └── Project: ThirdProject
      ├── Detector (DotGitWatcher)
      └── knowledge/
```

每个项目有独立的：
- 检测器实例（自动选择最优策略）
- 知识库目录（`{project}/knowledge/`）
- 数据库记录（`projects` 表）
- 分析历史（`analysis_log` 表）

## API 架构

Express 服务器提供 RESTful API：

| 路径 | 描述 |
|------|------|
| `GET /api/projects` | 项目列表 |
| `GET /api/projects/:name` | 项目详情 |
| `GET /api/projects/:name/tree` | 文件树 |
| `GET /api/projects/:name/file` | 文档内容 |
| `GET /api/projects/:name/source` | 源码内容 |
| `POST /api/projects/:name/analyze` | 增量分析 |
| `POST /api/projects/:name/analyze/full` | 全量分析 |
| `GET /api/projects/:name/search` | 项目内搜索 |
| `POST /api/projects/discover` | 发现项目 |

所有非 API 路由通过 SPA 回退返回 `index.html`，支持 Vue Router 的 HTML5 History 模式。
