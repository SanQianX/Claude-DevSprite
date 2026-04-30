---
title: 模块分析
category: modules
updatedAt: 2026-04-25
---

# 模块分析

## 后端模块

### 1. Git 检测器 (`src/detectors/`)

三层检测策略，自动降级确保可靠性。统一产出 `CommitEvent` 对象。

#### Post-Commit Hook ([postCommitHook.ts](/project/Claude-DevSprite/source?path=src/detectors/postCommitHook.ts))

- **优先级**：最高（Level 1）
- **原理**：在 `.git/hooks/post-commit` 写入通知脚本，Hook 被触发时通过 HTTP POST 通知 Worker
- **延迟**：零延迟，实时响应
- **降级条件**：Hook 安装失败或权限不足
- **兼容性**：使用 `#!/bin/sh` shebang，LF 行尾，反斜杠转义（Windows 兼容）
- **标记机制**：使用 `# DEVSPRITE_HOOK` 和 `# DEVSPRITE_HOOK_END` 标记注入代码段，便于卸载时精确移除
- **接口**：实现 `Detector` 接口（start / stop / onCommit）

#### .git 目录监控 ([dotGitWatcher.ts](/project/Claude-DevSprite/source?path=src/detectors/dotGitWatcher.ts))

- **优先级**：次高（Level 2）
- **原理**：chokidar 监控 `.git/HEAD` 和 `.git/refs/heads` 变化
- **延迟**：毫秒级（200ms 防抖）
- **降级条件**：文件系统不支持或监听失败
- **配置**：`awaitWriteFinish` 确保 Git 原子写入完成后触发

#### Reflog 轮询 ([reflogPoller.ts](/project/Claude-DevSprite/source?path=src/detectors/reflogPoller.ts))

- **优先级**：最低（Level 3，兜底方案）
- **原理**：定期执行 `git rev-parse HEAD` 比较哈希值变化
- **延迟**：可配置（默认 1000ms 间隔）
- **特点**：兼容性最好，总是可用

#### 检测器工厂 ([detectorFactory.ts](/project/Claude-DevSprite/source?path=src/detectors/detectorFactory.ts))

- `createDetector()` — 按指定类型创建单个检测器
- `createDetectorWithFallback()` — 自动选择最优策略，失败时逐级降级
- 返回 `DetectorWithFallbackResult`：包含检测器实例和降级原因

#### 检测器管理器 ([index.ts](/project/Claude-DevSprite/source?path=src/detectors/index.ts))

`CommitDetectorManager` 管理检测器生命周期：
- `onCommit()` — 注册回调
- `start()` — 创建并启动最优检测器
- `stop()` — 停止所有检测器
- `getStatus()` — 查询当前检测器状态（名称、降级原因、运行状态）

#### 统一事件类型 ([types.ts](/project/Claude-DevSprite/source?path=src/detectors/types.ts))

```typescript
interface CommitEvent {
  repoPath: string;
  commitHash: string;
  commitMessage: string;
  author: string;
  timestamp: Date;
  changedFiles: string[];
}

interface Detector {
  name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  onCommit(callback: (event: CommitEvent) => void): void;
}

type DetectorType = 'post-commit-hook' | 'dotgit-watcher' | 'reflog-poller';
```

---

### 2. AI 分析引擎 (`src/analyzer/`)

7 步流水线架构，是系统最核心的模块。

#### 分析器入口 ([index.ts](/project/Claude-DevSprite/source?path=src/analyzer/index.ts))

`Analyzer` 类作为顶层入口：
- 管理多个 `AnalysisPipeline` 实例（按 repoPath 隔离）
- `analyze(repoPath, commitHash)` — 从 Commit 哈希开始完整分析
- `analyzeWithContext(context)` — 使用预构建上下文分析
- `getPipeline()` — 获取指定仓库的流水线实例

#### 流水线编排 ([pipeline.ts](/project/Claude-DevSprite/source?path=src/analyzer/pipeline.ts))

`AnalysisPipeline` 编排 7 个组件：

| 步骤 | 组件 | 职责 |
|------|------|------|
| 1 | DiffCollector | 收集 commit 的 diff 信息 |
| 2 | ContextBuilder | 构建分析上下文 + 加载已有知识 |
| 3 | ModeDecider | 决定增量/全量分析模式 |
| 4 | PromptBuilder | 组装 AI 提示词 |
| 5 | AIProvider | 调用 Claude 生成文档 |
| 6 | ResponseParser | 解析 AI JSON 响应 |
| 7 | DocumentGenerator | 应用模板 + 生成 Frontmatter |

提供两个入口方法：
- `execute(commitHash)` — 从 Commit 哈希执行完整流水线
- `executeWithContext(context)` — 使用预构建上下文执行（跳过步骤 1-3）

#### Diff 收集器 ([diffCollector.ts](/project/Claude-DevSprite/source?path=src/analyzer/diffCollector.ts))

- `collectDiffs(commitHash)` — 使用 `git.diffSummary()` 和 `git.diff()` 获取变更摘要和内容
- `parseDiff(diffString)` — 解析统一格式 Diff 字符串
- 产出 `DiffEntry[]`：包含文件路径、变更类型、增删行数、Diff 内容

#### 上下文构建器 ([contextBuilder.ts](/project/Claude-DevSprite/source?path=src/analyzer/contextBuilder.ts))

- `buildContext()` — 构建 `AnalysisContext`
- `loadRelevantKnowledge()` — 加载相关已有知识文档（按文件名/目录名/概述类型匹配）
- `getFileContent()` — 获取指定 Commit 的文件内容
- `getRepositoryStructure()` — 获取仓库文件树
- 文档智能截断：超过 2000 字符的文档自动截断防止上下文溢出

#### 模式决策器 ([modeDecider.ts](/project/Claude-DevSprite/source?path=src/analyzer/modeDecider.ts))

基于启发式规则决策分析模式：
- 无已有知识库 → 全量
- 变更文件占比 > 30% → 全量
- 变更行数 > 1000 → 全量
- 删除/重命名文件 > 5 → 全量
- 其他 → 增量

#### 提示词构建器 ([promptBuilder.ts](/project/Claude-DevSprite/source?path=src/analyzer/promptBuilder.ts))

- 使用 [promptTemplates.ts](/project/Claude-DevSprite/source?path=src/analyzer/promptTemplates.ts) 中定义的模板
- `fullAnalysis` 模板 — 全量分析，生成概览/架构/模块/技术栈等完整文档
- `incrementalAnalysis` 模板 — 增量分析，生成变更记录和更新相关文档
- 模板变量替换：`{{commitMessage}}`、`{{commitHash}}`、`{{changedFiles}}`、`{{previousKnowledge}}`

#### AI 提供者 ([aiProvider.ts](/project/Claude-DevSprite/source?path=src/analyzer/aiProvider.ts))

双模式 AI 调用：
- **SDK 模式**（优先）：使用 `@anthropic-ai/sdk` 直连 API，支持自定义 baseURL 和 auth token
- **CLI 模式**（降级）：调用 `claude` CLI 子进程
- 内置指数退避重试（最多 2 次，基础延迟 2000ms）
- 配置加载优先级：环境变量 > `~/.claude-dev-sprite/.env` > `worker-env.json`

#### 响应解析器 ([responseParser.ts](/project/Claude-DevSprite/source?path=src/analyzer/responseParser.ts))

- 解析 AI 返回的 JSON（支持 markdown 代码块包裹）
- `normalizeDocument()` — 规范化文档结构（路径、标题、分类、内容、关系）
- `extractMetadata()` — 从 Frontmatter 或 Markdown 标题提取元数据
- `extractRelations()` — 识别 `[[wiki-link]]` 格式的文档间关系

#### 文档生成器 ([documentGenerator.ts](/project/Claude-DevSprite/source?path=src/analyzer/documentGenerator.ts))

- `generateDocuments()` — 将 AI 响应转化为 `GeneratedDocument[]`
- `applyTemplate()` — 添加 YAML Frontmatter（title、category、日期、relations）
- `generateDocumentPath()` — 基于分类和标题生成文件路径
- `mergeWithExisting()` — 合并新旧文档内容

---

### 3. 知识库管理 (`src/knowledge/`)

#### 存储管理器 ([storageManager.ts](/project/Claude-DevSprite/source?path=src/knowledge/storageManager.ts))

管理 `knowledge/` 目录的文件读写操作。

#### 关系引擎 ([relationEngine.ts](/project/Claude-DevSprite/source?path=src/knowledge/relationEngine.ts))

维护文档间的关联关系（depends_on、related_to、implements、part_of、source_reference）。

#### 链接索引器 ([linkIndexer.ts](/project/Claude-DevSprite/source?path=src/knowledge/linkIndexer.ts))

索引文档中的内部链接和源码引用，支持快速导航。

#### Git 同步管理器 ([gitSyncManager.ts](/project/Claude-DevSprite/source?path=src/knowledge/gitSyncManager.ts))

- `commit(message)` — 自动提交知识库变更
- `getCurrentCommit()` — 获取当前 Commit 哈希
- `isDirty()` — 检查知识库是否有未提交变更

#### 冲突解决器 ([conflictResolver.ts](/project/Claude-DevSprite/source?path=src/knowledge/conflictResolver.ts))

处理知识库文档的合并冲突：
- `KeepOurs` — 保留本地版本
- `KeepTheirs` — 保留远端版本
- `Merge` — 智能合并（保留双方非重复内容）
- `Manual` — 标记为需手动解决
- `detectConflicts()` / `countConflicts()` — 检测和统计冲突

#### 文档写入器 ([documentWriter.ts](/project/Claude-DevSprite/source?path=src/knowledge/documentWriter.ts))

- `writeWithFrontmatter()` — 生成带 Frontmatter 的完整文档
- `parseWithFrontmatter()` — 解析已有文档的 Frontmatter 和内容

---

### 4. Worker 服务器 (`src/worker/`)

#### Express 服务器 ([server.ts](/project/Claude-DevSprite/source?path=src/worker/server.ts))

- 默认端口 `38888`
- 挂载所有路由、中间件和数据库
- 启动时初始化项目发现服务

#### API 路由

| 路由模块 | 文件 | 功能 |
|----------|------|------|
| `/api/analysis` | [analysis.ts](/project/Claude-DevSprite/source?path=src/worker/routes/analysis.ts) | 触发分析、查询状态（SSE 推送） |
| `/api/config` | [config.ts](/project/Claude-DevSprite/source?path=src/worker/routes/config.ts) | 获取/更新配置 |
| `/api/files` | [files.ts](/project/Claude-DevSprite/source?path=src/worker/routes/files.ts) | 文件树、文档内容读取 |
| `/api/git` | [git.ts](/project/Claude-DevSprite/source?path=src/worker/routes/git.ts) | Git 操作、Hook 通知 |
| `/api/internal` | [internal.ts](/project/Claude-DevSprite/source?path=src/worker/routes/internal.ts) | 内部管理接口 |
| `/api/logs` | [logs.ts](/project/Claude-DevSprite/source?path=src/worker/routes/logs.ts) | 系统日志查看 |
| `/api/projects` | [projects.ts](/project/Claude-DevSprite/source?path=src/worker/routes/projects.ts) | 项目列表、发现 |
| `/api/relations` | [relations.ts](/project/Claude-DevSprite/source?path=src/worker/routes/relations.ts) | 文档关系查询 |
| `/api/search` | [search.ts](/project/Claude-DevSprite/source?path=src/worker/routes/search.ts) | 全文搜索 |

#### 中间件

| 中间件 | 文件 | 功能 |
|--------|------|------|
| CORS | [cors.ts](/project/Claude-DevSprite/source?path=src/worker/middleware/cors.ts) | 跨域资源共享配置 |
| 错误处理 | [errorHandler.ts](/project/Claude-DevSprite/source?path=src/worker/middleware/errorHandler.ts) | 全局错误捕获和格式化 |
| 日志 | [logger.ts](/project/Claude-DevSprite/source?path=src/worker/middleware/logger.ts) | 请求日志记录 |

#### 数据库 ([db.ts](/project/Claude-DevSprite/source?path=src/worker/db.ts))

- 使用 sql.js（SQLite WASM），数据文件 `~/.claude/claude-dev-sprite/data/dev-sprite.db`
- 数据库迁移脚本：[001_initial.sql](/project/Claude-DevSprite/source?path=src/worker/migrations/001_initial.sql)

#### SSE 广播 ([sseBroadcaster.ts](/project/Claude-DevSprite/source?path=src/worker/sseBroadcaster.ts))

- Server-Sent Events 实时推送分析进度到前端
- 支持多客户端同时订阅

#### 任务队列 ([taskQueue.ts](/project/Claude-DevSprite/source?path=src/worker/taskQueue.ts))

- 管理分析任务的排队和执行
- 防止并发分析导致资源竞争

#### 分析跟踪器 ([analysisTracker.ts](/project/Claude-DevSprite/source?path=src/worker/analysisTracker.ts))

- 跟踪每个分析任务的状态、进度和结果
- 通过 SSE 推送实时进度更新

---

### 5. 生命周期钩子 (`src/hooks/`)

| 钩子 | 文件 | 触发时机 | 核心动作 |
|------|------|----------|----------|
| SessionStart | [sessionStart.ts](/project/Claude-DevSprite/source?path=src/hooks/sessionStart.ts) | Claude Code 会话启动 | 初始化数据库、启动 Worker、触发项目发现 |
| UserPromptSubmit | [userPromptSubmit.ts](/project/Claude-DevSprite/source?path=src/hooks/userPromptSubmit.ts) | 用户输入命令 | 拦截 `/kb` 命令（status / analyze / help） |
| PostToolUse | [postToolUse.ts](/project/Claude-DevSprite/source?path=src/hooks/postToolUse.ts) | 工具调用完成后 | 跟踪文件修改操作（Write/Edit/Bash），维护最近修改记录 |
| SessionEnd | [sessionEnd.ts](/project/Claude-DevSprite/source?path=src/hooks/sessionEnd.ts) | 会话结束 | 停止所有检测器、关闭数据库连接、清理资源 |

---

### 6. 项目发现服务 (`src/services/`)

#### 项目发现 ([projectDiscovery.ts](/project/Claude-DevSprite/source?path=src/services/projectDiscovery.ts))

- 自动扫描配置的目录路径（`~/Projects`、`~/code`、`~/dev`、`~/workspace` 等）
- 识别含 `.git` 目录的 Git 仓库
- 最大扫描深度 3 层
- 提供项目列表、项目状态查询接口

---

### 7. 工具模块 (`src/utils/`)

| 模块 | 文件 | 功能 |
|------|------|------|
| 文件系统 | [fs.ts](/project/Claude-DevSprite/source?path=src/utils/fs.ts) | 文件读写、目录操作封装 |
| Git 工具 | [git.ts](/project/Claude-DevSprite/source?path=src/utils/git.ts) | Git 操作辅助（获取变更文件列表等） |
| 日志 | [logger.ts](/project/Claude-DevSprite/source?path=src/utils/logger.ts) | 统一日志工具，支持分级输出 |
| Markdown | [markdown.ts](/project/Claude-DevSprite/source?path=src/utils/markdown.ts) | Markdown 处理工具 |
| 路径 | [path.ts](/project/Claude-DevSprite/source?path=src/utils/path.ts) | 路径处理工具 |

---

## 前端模块 (`web/src/`)

### 页面与视图

| 视图 | 文件 | 功能 |
|------|------|------|
| Home | [Home.vue](/project/Claude-DevSprite/source?path=web/src/views/Home.vue) | 根路由，重定向到 HomePage |
| HomePage | [HomePage.vue](/project/Claude-DevSprite/source?path=web/src/views/HomePage.vue) | 项目列表首页 |
| ProjectLayout | [ProjectLayout.vue](/project/Claude-DevSprite/source?path=web/src/views/ProjectLayout.vue) | 项目容器布局（侧边栏 + 内容区 + TOC） |
| ProjectOverview | [ProjectOverview.vue](/project/Claude-DevSprite/source?path=web/src/views/ProjectOverview.vue) | 单个项目概览 |
| DocumentView | [DocumentView.vue](/project/Claude-DevSprite/source?path=web/src/views/DocumentView.vue) | Markdown 文档阅读视图 |
| SourceView | [SourceView.vue](/project/Claude-DevSprite/source?path=web/src/views/SourceView.vue) | 源码预览视图 |
| SearchResults | [SearchResults.vue](/project/Claude-DevSprite/source?path=web/src/views/SearchResults.vue) | 全文搜索结果 |
| LogsView | [LogsView.vue](/project/Claude-DevSprite/source?path=web/src/views/LogsView.vue) | 系统日志查看 |

### 布局组件

| 组件 | 文件 | 功能 |
|------|------|------|
| AppHeader | [AppHeader.vue](/project/Claude-DevSprite/source?path=web/src/components/layout/AppHeader.vue) | 顶部导航栏 |
| AppSidebar | [AppSidebar.vue](/project/Claude-DevSprite/source?path=web/src/components/layout/AppSidebar.vue) | 左侧文件树侧边栏 |
| AppTocPanel | [AppTocPanel.vue](/project/Claude-DevSprite/source?path=web/src/components/layout/AppTocPanel.vue) | 右侧目录导航面板 |

### 通用组件

| 组件 | 文件 | 功能 |
|------|------|------|
| SearchBar | [SearchBar.vue](/project/Claude-DevSprite/source?path=web/src/components/common/SearchBar.vue) | 搜索输入框 |
| Breadcrumb | [Breadcrumb.vue](/project/Claude-DevSprite/source?path=web/src/components/common/Breadcrumb.vue) | 面包屑导航 |
| LoadingSpinner | [LoadingSpinner.vue](/project/Claude-DevSprite/source?path=web/src/components/common/LoadingSpinner.vue) | 加载动画 |
| EmptyState | [EmptyState.vue](/project/Claude-DevSprite/source?path=web/src/components/common/EmptyState.vue) | 空状态占位 |

### 组合式函数 (Composables)

| 函数 | 文件 | 功能 |
|------|------|------|
| useBreadcrumb | [useBreadcrumb.ts](/project/Claude-DevSprite/source?path=web/src/composables/useBreadcrumb.ts) | 面包屑导航逻辑 |
| useDocument | [useDocument.ts](/project/Claude-DevSprite/source?path=web/src/composables/useDocument.ts) | 文档加载、渲染、TOC 提取 |
| useFileTree | [useFileTree.ts](/project/Claude-DevSprite/source?path=web/src/composables/useFileTree.ts) | 文件树数据构建 |
| useProjectList | [useProjectList.ts](/project/Claude-DevSprite/source?path=web/src/composables/useProjectList.ts) | 项目列表获取 |
| useToc | [useToc.ts](/project/Claude-DevSprite/source?path=web/src/composables/useToc.ts) | 目录导航数据 |

### 状态管理 (Pinia Stores)

| Store | 文件 | 功能 |
|-------|------|------|
| projects | [projects.ts](/project/Claude-DevSprite/source?path=web/src/stores/projects.ts) | 项目列表和当前项目 |
| knowledge | [knowledge.ts](/project/Claude-DevSprite/source?path=web/src/stores/knowledge.ts) | 知识库文档和文件树 |
| analysis | [analysis.ts](/project/Claude-DevSprite/source?path=web/src/stores/analysis.ts) | 分析进度和状态 |
| search | [search.ts](/project/Claude-DevSprite/source?path=web/src/stores/search.ts) | 搜索查询和结果 |
| ui | [ui.ts](/project/Claude-DevSprite/source?path=web/src/stores/ui.ts) | UI 全局状态（侧边栏、主题等） |

### API 客户端

| 模块 | 文件 | 功能 |
|------|------|------|
| client | [client.ts](/project/Claude-DevSprite/source?path=web/src/api/client.ts) | Axios/fetch 基础客户端 |
| analysis | [analysis.ts](/project/Claude-DevSprite/source?path=web/src/api/analysis.ts) | 分析 API |
| files | [files.ts](/project/Claude-DevSprite/source?path=web/src/api/files.ts) | 文件操作 API |
| logs | [logs.ts](/project/Claude-DevSprite/source?path=web/src/api/logs.ts) | 日志 API |
| projects | [projects.ts](/project/Claude-DevSprite/source?path=web/src/api/projects.ts) | 项目 API |
| search | [search.ts](/project/Claude-DevSprite/source?path=web/src/api/search.ts) | 搜索 API |