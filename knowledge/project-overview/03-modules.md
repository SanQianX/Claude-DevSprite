---
title: 模块分析
category: modules
date: 2026-04-25
updatedAt: 2026-04-25
---

# 模块分析

## 后端模块

### 1. Git 检测器 (`src/detectors/`)

三层检测策略，自动降级确保可靠性：

#### Post-Commit Hook ([postCommitHook.ts](/project/Claude-DevSprite/source?path=src/detectors/postCommitHook.ts))
- **优先级**：最高（Level 1）
- **原理**：在 `.git/hooks/post-commit` 写入通知脚本
- **延迟**：零延迟，实时响应
- **降级条件**：Hook 安装失败或权限不足
- **Windows 兼容**：使用 `#!/bin/sh` shebang，LF 行尾，路径转义

#### .git 目录监控 ([dotGitWatcher.ts](/project/Claude-DevSprite/source?path=src/detectors/dotGitWatcher.ts))
- **优先级**：次高（Level 2）
- **原理**：chokidar 监控 `.git/HEAD` 和 `.git/refs/` 变化
- **延迟**：毫秒级
- **降级条件**：文件系统不支持或监听失败

#### Reflog 轮询 ([reflogPoller.ts](/project/Claude-DevSprite/source?path=src/detectors/reflogPoller.ts))
- **优先级**：最低（Level 3）
- **原理**：定期执行 `git reflog` 检测新提交
- **延迟**：可配置（默认 5 秒）
- **特点**：兼容性最好，总是可用

#### 检测器工厂 ([detectorFactory.ts](/project/Claude-DevSprite/source?path=src/detectors/detectorFactory.ts))
- 自动选择最优策略
- 失败时自动降级到下一策略
- 去重机制：`dedupWindowMs`（默认 5 秒）

### 2. AI 分析引擎 (`src/analyzer/`)

7 步流水线架构：

| 步骤 | 文件 | 职责 |
|------|------|------|
| 1 | [diffCollector.ts](/project/Claude-DevSprite/source?path=src/analyzer/diffCollector.ts) | 收集 Git diff、变更文件列表 |
| 2 | [contextBuilder.ts](/project/Claude-DevSprite/source?path=src/analyzer/contextBuilder.ts) | 构建分析上下文 |
| 3 | [modeDecider.ts](/project/Claude-DevSprite/source?path=src/analyzer/modeDecider.ts) | 决定增量/全量分析模式 |
| 4 | [promptBuilder.ts](/project/Cla-DevSprite/source?path=src/analyzer/promptBuilder.ts) | 构建提示词 |
| 5 | [aiProvider.ts](/project/Claude-DevSprite/source?path=src/analyzer/aiProvider.ts) | 调用 Claude CLI |
| 6 | [responseParser.ts](/project/Claude-DevSprite/source?path=src/analyzer/responseParser.ts) | 解析 AI 响应 |
| 7 | [documentGenerator.ts](/project/Claude-DevSprite/source?path=src/analyzer/documentGenerator.ts) | 生成 Markdown 文档 |

分析模式：
- **增量分析**（默认）：分析单个 Commit 的变更
- **全量分析**：分析整个项目，生成完整知识库

全量分析触发条件：
- 首次分析
- 全量分析间隔超过 30 天
- 新增文件数量超过阈值（10 个）
- 依赖文件（`package.json` 等）变更
- Commit 消息包含 `[major]`、`[breaking]` 等关键词

### 3. 知识库管理 (`src/knowledge/`)

| 模块 | 文件 | 职责 |
|------|------|------|
| 文档存储 | [storageManager.ts](/project/Claude-DevSprite/source?path=src/knowledge/storageManager.ts) | 文档读写、查找 |
| 关系引擎 | [relationEngine.ts](/project/Claude-DevSprite/source?path=src/knowledge/relationEngine.ts) | 文档间关系管理 |
| 链接索引 | [linkIndexer.ts](/project/Claude-DevSprite/source?path=src/knowledge/linkIndexer.ts) | 链接解析和索引 |
| 冲突解决 | [conflictResolver.ts](/project/Claude-DevSprite/source?path=src/knowledge/conflictResolver.ts) | 合并冲突处理 |
| Git 同步 | [gitSyncManager.ts](/project/Claude-DevSprite/source?path=src/knowledge/gitSyncManager.ts) | 知识库自动提交 |

### 4. Worker 服务 (`src/worker/`)

#### HTTP Server ([server.ts](/project/Claude-DevSprite/source?path=src/worker/server.ts))
- Express 框架
- 端口 38888
- SPA 回退支持
- 自动发现项目并启动检测器

#### API 路由
| 文件 | 端点前缀 | 功能 |
|------|---------|------|
| [projects.ts](/project/Claude-DevSprite/source?path=src/worker/routes/projects.ts) | `/api/projects` | 项目管理 |
| [files.ts](/project/Claude-DevSprite/source?path=src/worker/routes/files.ts) | `/api/projects/:name/tree,file,source` | 文件操作 |
| [analysis.ts](/project/Claude-DevSprite/source?path=src/worker/routes/analysis.ts) | `/api/projects/:name/analyze` | 分析触发 |
| [search.ts](/project/Claude-DevSprite/source?path=src/worker/routes/search.ts) | `/api/search` | 搜索 |
| [git.ts](/project/Claude-DevSprite/source?path=src/worker/routes/git.ts) | `/api/git` | Git 操作 |
| [relations.ts](/project/Claude-DevSprite/source?path=src/worker/routes/relations.ts) | `/api/relations` | 关系查询 |

#### 数据库 ([db.ts](/project/Claude-DevSprite/source?path=src/worker/db.ts))
- SQLite 通过 sql.js（WASM 版本，无需原生编译）
- 路径：`~/.claude/claude-dev-sprite/data/dev-sprite.db`
- 表：`projects`, `documents`, `relations`, `analysis_log`, `link_index`

#### 检测器注册表 ([detectorRegistry.ts](/project/Claude-DevSprite/source?path=src/worker/detectorRegistry.ts))
- 共享检测器状态
- 避免循环依赖
- 支持多项目检测器管理

### 5. 项目发现服务 (`src/services/`)

[projectDiscovery.ts](/project/Claude-DevSprite/source?path=src/services/projectDiscovery.ts)

- 自动扫描配置的路径，发现 Git 仓库
- 为每个项目创建 `knowledge/` 目录
- 注册项目到 SQLite 数据库
- 支持手动添加项目

扫描路径（默认）：
1. 当前工作目录
2. `~/Projects`
3. `~/code`
4. `~/dev`

### 6. 配置系统 (`src/config.ts`)

[config.ts](/project/Claude-DevSprite/source?path=src/config.ts)

多层级配置：
- `server`: 端口、主机
- `knowledge`: 目录名、自动提交
- `analysis`: 分析模式、触发条件
- `detection`: 检测策略、轮询间隔
- `web`: 启用状态
- `logging`: 日志级别
- `projectDiscovery`: 扫描路径、深度

---

## 前端模块

### 页面视图 (`web/src/views/`)

| 页面 | 文件 | 功能 |
|------|------|------|
| 首页 | [HomePage.vue](/project/Claude-DevSprite/source?path=web/src/views/HomePage.vue) | 项目列表 |
| 项目布局 | [ProjectLayout.vue](/project/Claude-DevSprite/source?path=web/src/views/ProjectLayout.vue) | 三栏布局容器 |
| 项目概览 | [ProjectOverview.vue](/project/Claude-DevSprite/source?path=web/src/views/ProjectOverview.vue) | 项目统计信息 |
| 文档查看 | [DocumentView.vue](/project/Claude-DevSprite/source?path=web/src/views/DocumentView.vue) | Markdown 文档渲染 |

### 状态管理 (`web/src/stores/`)

| Store | 文件 | 状态 |
|-------|------|------|
| Projects | [projects.ts](/project/Claude-DevSprite/source?path=web/src/stores/projects.ts) | 项目列表、当前项目 |
| Knowledge | [knowledge.ts](/project/Claude-DevSprite/source?path=web/src/stores/knowledge.ts) | 文件树、当前文档、TOC |
| UI | [ui.ts](/project/Claude-DevSprite/source?path=web/src/stores/ui.ts) | 侧边栏、TOC 面板、主题 |
| Search | [search.ts](/project/Claude-DevSprite/source?path=web/src/stores/search.ts) | 搜索查询和结果 |

**重要**：Pinia store 必须使用 `storeToRefs()` 解构响应式属性，否则会丢失 Vue 响应性。

### 关键组件

| 组件 | 位置 | 功能 |
|------|------|------|
| ProjectCard | components/home/ | 项目卡片展示 |
| FileTree | components/tree/ | 文件树导航 |
| MarkdownViewer | components/viewer/ | Markdown 渲染 + 代码高亮 |
| AppSidebar | components/layout/ | 侧边栏（文件树） |
| AppTocPanel | components/layout/ | 目录面板 |
| Breadcrumb | components/common/ | 面包屑导航 |
