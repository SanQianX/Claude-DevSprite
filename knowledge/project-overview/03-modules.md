---
title: 模块分析
category: modules
updatedAt: 2026-04-25
---

# 模块分析

## 后端模块

### 1. Git 检测器 (`src/detectors/`)

三层检测策略，自动降级确保可靠性。

#### Post-Commit Hook ([postCommitHook.ts](/project/Claude-DevSprite/source?path=src/detectors/postCommitHook.ts))

- **优先级**：最高（Level 1）
- **原理**：在 `.git/hooks/post-commit` 写入通知脚本，Hook 被触发时通过 HTTP POST 通知 Worker
- **延迟**：零延迟，实时响应
- **降级条件**：Hook 安装失败或权限不足
- **兼容性**：使用 `#!/bin/sh` shebang，LF 行尾，反斜杠转义（Windows 兼容）
- **标记机制**：使用 `# DEVSPRITE_MARKER` 和 `# DEVSPRITE_MARKER_END` 标记注入的代码段，便于卸载时精确移除
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

- 自动选择最优策略，失败时逐级降级
- `createDetectorWithFallback()` 函数按序尝试三种策略
- `CommitDetectorManager` 管理检测器生命周期，支持多回调分发

#### 统一事件类型

所有检测器产出相同的 `CommitEvent`（[types.ts](/project/Claude-DevSprite/source?path=src/detectors/types.ts)）：

```typescript
interface CommitEvent {
  repoPath: string;
  commitHash: string;
  commitMessage: string;
  author: string;
  timestamp: Date;
  changedFiles: string[];
}
```

---

### 2. AI 分析引擎 (`src/analyzer/`)

7 步流水线架构，是系统最核心的模块。

#### 分析器入口 ([index.ts](/project/Claude-DevSprite/source?path=src/analyzer/index.ts))

- `Analyzer` 类作为顶层入口，管理多个 `AnalysisPipeline` 实例（按 repoPath 隔离）
- 提供 `analyze()` 和 `analyzeWithContext()` 两种调用方式

#### 流水线编排 ([pipeline.ts](/project/Claude-DevSprite/source?path=src/analyzer/pipeline.ts))

编排 7 个组件的执行顺序，处理完整的从 Diff 到文档的转换流程：

| 步骤 | 组件 | 职责 |
|------|------|------|
| 1 | DiffCollector | 收集 Git diff，解析变更文件列表 |
| 2 | ContextBuilder | 构建分析上下文（提交信息 + 已有知识库） |
| 3 | ModeDecider | 根据变更规模决定增量/全量分析模式 |
| 4 | PromptBuilder | 根据模式选择模板，填充变量 |
| 5 | AIProvider | 调用 Claude API 或 CLI 获取分析结果 |
| 6 | ResponseParser | 解析 AI 返回的 JSON 为文档结构 |
| 7 | DocumentGenerator | 应用模板、添加 Frontmatter、合并已有文档 |

#### Diff 收集器 ([diffCollector.ts](/project/Claude-DevSprite/source?path=src/analyzer/diffCollector.ts))

- 使用 `simple-git` 的 `diffSummary` 获取变更概览
- 对每个文件获取详细 diff 内容
- 识别变更类型：added / modified / deleted / renamed
- 统计增删行数

#### 上下文构建器 ([contextBuilder.ts](/project/Claude-DevSprite/source?path=src/analyzer/contextBuilder.ts))

- 获取 Commit 元信息（消息、哈希）
- 加载相关知识库文档作为上下文：
  - 引用了变更文件的文档
  - 位于相关目录的文档
  - 概览/架构类文档（始终包含）
- 长文档截断为 2000 字符防止上下文溢出

#### 模式决策器 ([modeDecider.ts](/project/Claude-DevSprite/source?path=src/analyzer/modeDecider.ts))

**全量分析触发条件**（任一满足即触发）：
- 无已有知识库（`totalFileCount === 0`）
- 变更文件占比 > 30%
- 变更行数 > 1000
- 删除/重命名操作 > 5 次

其余情况使用增量分析。

#### 提示词构建器 ([promptBuilder.ts](/project/Claude-DevSprite/source?path=src/analyzer/promptBuilder.ts))

- 根据模式选择模板（[promptTemplates.ts](/project/Claude-DevSprite/source?path=src/analyzer/promptTemplates.ts)）
- 填充模板变量：commitMessage、commitHash、changedFiles、previousKnowledge
- Diff 预览截断为 20 行

#### AI 提供者 ([aiProvider.ts](/project/Claude-DevSprite/source?path=src/analyzer/aiProvider.ts))

**双模式调用**：
- **SDK 模式**：使用 Anthropic SDK 直连，支持自定义 baseURL
- **CLI 模式**：Claude CLI 子进程调用

**配置来源优先级**：`process.env` → `~/.claude-dev-sprite/.env` → `worker-env.json`

**容错机制**：指数退避重试（默认 2 次，基础延迟 2000ms）

**Token 估算**：`(prompt.length + response.length) / 4`

#### 响应解析器 ([responseParser.ts](/project/Claude-DevSprite/source?path=src/analyzer/responseParser.ts))

- 尝试从 Markdown 代码块中提取 JSON
- 解析文档数组，验证并标准化每个文档结构
- 提取 Wiki 链接形式的关联关系（`[[doc-path]]` 或 `[[doc-path|label]]`）

#### 文档生成器 ([documentGenerator.ts](/project/Claude-DevSprite/source?path=src/analyzer/documentGenerator.ts))

- 应用文档模板，添加 YAML Frontmatter（title、category、createdAt、updatedAt、relations）
- 生成基于分类和标题的文件路径
- 支持与已有文档合并（追加内容 + 更新元数据）

---

### 3. 知识库管理 (`src/knowledge/`)

#### 文档存储管理器 ([storageManager.ts](/project/Claude-DevSprite/source?path=src/knowledge/storageManager.ts))

- 管理知识库目录结构的创建和维护
- 文档的读取、写入、删除操作
- 按 category 组织目录

#### 关联关系引擎 ([relationEngine.ts](/project/Claude-DevSprite/source?path=src/knowledge/relationEngine.ts))

- 管理文档间的关联关系（depends_on / related_to / implements / part_of / source_reference）
- 支持双向关系查询
- 关系类型定义在 [types.ts](/project/Claude-DevSprite/source?path=src/knowledge/types.ts)

#### 链接索引器 ([linkIndexer.ts](/project/Claude-DevSprite/source?path=src/knowledge/linkIndexer.ts))

- 解析文档中的 Markdown 链接和 Wiki 链接
- 建立链接索引，支持反向链接查询
- 检测断链

#### Git 同步管理器 ([gitSyncManager.ts](/project/Claude-DevSprite/source?path=src/knowledge/gitSyncManager.ts))

- 将知识库变更自动提交到 Git
- `commit()` — add knowledge/ 并 commit
- `isDirty()` — 检查是否有未提交变更
- `getCurrentCommit()` — 获取当前提交哈希

#### 冲突解决器 ([conflictResolver.ts](/project/Claude-DevSprite/source?path=src/knowledge/conflictResolver.ts))

- 检测 `<<<<<<<` / `>>>>>>>` 冲突标记
- 四种解决策略：KeepOurs / KeepTheirs / Merge / Manual
- 智能合并：保留双方独特内容，去除重复

#### 文档写入器 ([documentWriter.ts](/project/Claude-DevSprite/source?path=src/knowledge/documentWriter.ts))

- 使用 gray-matter 处理 YAML Frontmatter
- `writeWithFrontmatter()` — 合并元数据和内容
- `parseWithFrontmatter()` — 解析已有文档

---

### 4. Worker 服务 (`src/worker/`)

#### HTTP 服务器 ([server.ts](/project/Claude-DevSprite/source?path=src/worker/server.ts))

- Express 应用，监听 `localhost:38888`
- 挂载所有路由模块和中间件
- 启动时初始化数据库连接和迁移

#### 数据库 ([db.ts](/project/Claude-DevSprite/source?path=src/worker/db.ts))

- sql.js（SQLite WASM 版本），数据文件 `~/.claude/claude-dev-sprite/data/dev-sprite.db`
- 单例模式，通过 `getDatabase()` 获取
- SQL 迁移文件：[001_initial.sql](/project/Claude-DevSprite/source?path=src/worker/migrations/001_initial.sql)

#### 任务队列 ([taskQueue.ts](/project/Claude-DevSprite/source?path=src/worker/taskQueue.ts))

- 异步任务队列，处理分析请求
- 防止并发分析导致资源争用
- 任务状态追踪

#### 检测器注册表 ([detectorRegistry.ts](/project/Claude-DevSprite/source?path=src/worker/detectorRegistry.ts))

- 管理每个注册项目的检测器实例
- `getAllProjectDetectors()` — 获取所有活跃检测器
- 项目注册/注销时自动启停检测器

#### 路由模块

| 路由文件 | 前缀 | 核心端点 |
|----------|------|----------|
| [projects.ts](/project/Claude-DevSprite/source?path=src/worker/routes/projects.ts) | `/api/projects` | GET /（列表）、POST /（发现）、DELETE /:name |
| [files.ts](/project/Claude-DevSprite/source?path=src/worker/routes/files.ts) | `/api/files` | GET /tree（文件树）、GET /content（文件内容） |
| [analysis.ts](/project/Claude-DevSprite/source?path=src/worker/routes/analysis.ts) | `/api/analysis` | POST /（触发）、GET /status（状态） |
| [search.ts](/project/Claude-DevSprite/source?path=src/worker/routes/search.ts) | `/api/search` | GET /（全文搜索） |
| [relations.ts](/project/Claude-DevSprite/source?path=src/worker/routes/relations.ts) | `/api/relations` | GET /（关系查询） |
| [config.ts](/project/Claude-DevSprite/source?path=src/worker/routes/config.ts) | `/api/config` | GET /（读取）、PUT /（更新） |
| [git.ts](/project/Claude-DevSprite/source?path=src/worker/routes/git.ts) | `/api/git` | POST /hook-notify（Hook 回调） |
| [internal.ts](/project/Claude-DevSprite/source?path=src/worker/routes/internal.ts) | `/api/internal` | 内部管理接口 |

---

### 5. 项目发现服务 (`src/services/`)

#### 项目发现 ([projectDiscovery.ts](/project/Claude-DevSprite/source?path=src/services/projectDiscovery.ts))

- 自动扫描配置的目录（`~/Projects`、`~/code`、`~/dev`、`~/workspace`、当前工作目录）
- 深度限制：3 层
- 识别包含 `.git` 目录的项目
- 单例模式，通过 `getProjectDiscoveryService()` 获取

---

### 6. 生命周期钩子 (`src/hooks/`)

| 钩子 | 触发时机 | 主要动作 |
|------|----------|----------|
| [sessionStart.ts](/project/Claude-DevSprite/source?path=src/hooks/sessionStart.ts) | 会话开始 | 初始化 DB → 启动 Worker → 项目发现 |
| [userPromptSubmit.ts](/project/Claude-DevSprite/source?path=src/hooks/userPromptSubmit.ts) | 用户输入 | 拦截 `/kb status` / `/kb analyze <name>` / `/kb help` |
| [postToolUse.ts](/project/Claude-DevSprite/source?path=src/hooks/postToolUse.ts) | 工具调用后 | 追踪 Write/Edit/Bash 操作 |
| [sessionEnd.ts](/project/Claude-DevSprite/source?path=src/hooks/sessionEnd.ts) | 会话结束 | 停止检测器 → 关闭 DB → 清理资源 |

---

### 7. 工具模块 (`src/utils/`)

| 工具 | 文件 | 功能 |
|------|------|------|
| 文件系统 | [fs.ts](/project/Claude-DevSprite/source?path=src/utils/fs.ts) | 文件读写、目录操作封装 |
| Git | [git.ts](/project/Claude-DevSprite/source?path=src/utils/git.ts) | Git 命令封装（changedFiles、revparse 等） |
| 日志 | [logger.ts](/project/Claude-DevSprite/source?path=src/utils/logger.ts) | 结构化日志（基于 console） |
| Markdown | [markdown.ts](/project/Claude-DevSprite/source?path=src/utils/markdown.ts) | Markdown 解析与处理 |
| 路径 | [path.ts](/project/Claude-DevSprite/source?path=src/utils/path.ts) | 路径工具函数 |

---

## 前端模块

### 8. Web Dashboard (`web/src/`)

#### 路由结构

| 路径 | 视图 | 功能 |
|------|------|------|
| `/` | [HomePage.vue](/project/Claude-DevSprite/source?path=web/src/views/HomePage.vue) | 首页，项目列表 |
| `/project/:name` | [ProjectLayout.vue](/project/Claude-DevSprite/source?path=web/src/views/ProjectLayout.vue) | 项目布局（侧栏 + 内容区 + TOC） |
| `/project/:name/document/*` | [DocumentView.vue](/project/Claude-DevSprite/source?path=web/src/views/DocumentView.vue) | Markdown 文档渲染 |
| `/project/:name/source` | [SourceView.vue](/project/Claude-DevSprite/source?path=web/src/views/SourceView.vue) | 源码预览与高亮 |
| `/search` | [SearchResults.vue](/project/Claude-DevSprite/source?path=web/src/views/SearchResults.vue) | 全文搜索结果 |

#### 状态管理（Pinia Stores）

| Store | 文件 | 管理的数据 |
|-------|------|-------------|
| projects | [projects.ts](/project/Claude-DevSprite/source?path=web/src/stores/projects.ts) | 项目列表、当前项目 |
| knowledge | [knowledge.ts](/project/Claude-DevSprite/source?path=web/src/stores/knowledge.ts) | 文档树、当前文档内容 |
| search | [search.ts](/project/Claude-DevSprite/source?path=web/src/stores/search.ts) | 搜索关键词、结果列表 |
| ui | [ui.ts](/project/Claude-DevSprite/source?path=web/src/stores/ui.ts) | 侧栏状态、TOC 面板、主题 |

#### 组合式函数（Composables）

| 函数 | 文件 | 用途 |
|------|------|------|
| useProjectList | [useProjectList.ts](/project/Claude-DevSprite/source?path=web/src/composables/useProjectList.ts) | 加载和管理项目列表 |
| useDocument | [useDocument.ts](/project/Claude-DevSprite/source?path=web/src/composables/useDocument.ts) | 加载和渲染文档内容 |
| useFileTree | [useFileTree.ts](/project/Claude-DevSprite/source?path=web/src/composables/useFileTree.ts) | 构建和导航文件树 |
| useBreadcrumb | [useBreadcrumb.ts](/project/Claude-DevSprite/source?path=web/src/composables/useBreadcrumb.ts) | 面包屑导航 |
| useToc | [useToc.ts](/project/Claude-DevSprite/source?path=web/src/composables/useToc.ts) | 文档目录提取与导航 |

#### 组件体系

**布局组件**：
- [AppHeader.vue](/project/Claude-DevSprite/source?path=web/src/components/layout/AppHeader.vue) — 顶部导航栏，搜索入口
- [AppSidebar.vue](/project/Claude-DevSprite/source?path=web/src/components/layout/AppSidebar.vue) — 左侧文件树导航
- [AppTocPanel.vue](/project/Claude-DevSprite/source?path=web/src/components/layout/AppTocPanel.vue) — 右侧文档目录导航

**通用组件**：
- [SearchBar.vue](/project/Claude-DevSprite/source?path=web/src/components/common/SearchBar.vue) — 搜索输入框
- [Breadcrumb.vue](/project/Claude-DevSprite/source?path=web/src/components/common/Breadcrumb.vue) — 面包屑导航
- [LoadingSpinner.vue](/project/Claude-DevSprite/source?path=web/src/components/common/LoadingSpinner.vue) — 加载状态
- [EmptyState.vue](/project/Claude-DevSprite/source?path=web/src/components/common/EmptyState.vue) — 空状态提示

**功能组件**：
- [FileTree.vue](/project/Claude-DevSprite/source?path=web/src/components/tree/FileTree.vue) / [FileTreeNode.vue](/project/Claude-DevSprite/source?path=web/src/components/tree/FileTreeNode.vue) — 递归文件树
- [MarkdownViewer.vue](/project/Claude-DevSprite/source?path=web/src/components/viewer/MarkdownViewer.vue) — Markdown 渲染与高亮
- [SourceViewer.vue](/project/Claude-DevSprite/source?path=web/src/components/viewer/SourceViewer.vue) — 源码预览
- [ProjectCard.vue](/project/Claude-DevSprite/source?path=web/src/components/home/ProjectCard.vue) / [ProjectList.vue](/project/Claude-DevSprite/source?path=web/src/components/home/ProjectList.vue) — 项目卡片与列表