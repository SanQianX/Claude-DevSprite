# Claude-DevSprite

> Git Commit 自动监听 + AI 分析驱动的结构化知识库生成器，带 Web Dashboard 可视化浏览。

<!-- test commit for analysis pipeline -->

## 什么是 Claude-DevSprite？

Claude-DevSprite 是一个 **Claude Code Skill 插件**，它围绕四个核心环节构成完整闭环：

1. **自动监听** — 三级 Git Commit 检测策略（Post-Commit Hook → .git 目录监控 → Reflog 轮询），自动降级，零配置即可工作
2. **AI 分析** — 复用 Claude Code 模型配置（Anthropic SDK 直连 + Claude CLI 子进程双模式），将代码 Diff 转化为高质量文档
3. **生成/更新** — 以 `knowledge/` 目录为载体，产出带 YAML Frontmatter 的结构化 Markdown 文档，支持增量更新与全量重建
4. **可视化浏览** — Vue 3 + Vite Web Dashboard（默认 `localhost:38888`），提供文档树、Markdown 渲染、源码预览、全文搜索、TOC 导航、实时分析进度推送

```
git commit → 检测器捕获 → AI 分析 → 生成文档 → Web Dashboard 展示
```

## 功能特性

### Git 检测

- 三级自动降级检测策略，确保在所有环境下工作
- Post-Commit Hook（实时，零延迟）
- .git 目录 chokidar 监控（毫秒级延迟）
- Reflog 轮询（秒级间隔，兜底方案）
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

### Web Dashboard

- **文档浏览**：文件树导航 + Markdown 渲染 + 目录跳转
- **源码预览**：语法高亮查看源代码，文档内链接直接跳转
- **全文搜索**：跨文档关键词搜索，结果高亮
- **实时进度**：SSE 推送分析进度，Header 指示器显示当前状态
- **日志查看**：Worker 运行日志实时查看，支持级别过滤
- **响应式布局**：侧栏 + 主内容 + TOC 三栏布局

### 安全特性

- Path traversal 路径穿越防护
- DOMPurify XSS 防护（Markdown 渲染）
- asyncHandler 统一异步错误处理
- CORS 中间件保护

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
```

### 启动

```bash
# 使用守护进程启动（推荐）
npm run daemon:start

# 查看运行状态
npm run daemon:status

# 重启
npm run daemon:restart

# 停止
npm run daemon:stop
```

启动后打开浏览器访问 `http://localhost:38888`。

### 前端开发模式

```bash
cd web
npm run dev
# Vite 开发服务器运行在 http://localhost:5173
# API 请求自动代理到后端 38888 端口
```

## 项目结构

```
Claude-DevSprite/
├── src/
│   ├── analyzer/           # AI 分析引擎
│   │   ├── aiProvider.ts   # Claude AI 调用（SDK + CLI 双模式）
│   │   ├── pipeline.ts     # 7 步分析流水线
│   │   ├── diffCollector.ts
│   │   ├── contextBuilder.ts
│   │   ├── modeDecider.ts  # 增量/全量模式决策
│   │   ├── promptBuilder.ts
│   │   ├── responseParser.ts
│   │   └── types.ts
│   ├── detectors/          # Git Commit 检测器
│   │   ├── hookDetector.ts
│   │   ├── watcherDetector.ts
│   │   ├── pollerDetector.ts
│   │   └── detectorFactory.ts  # 三级降级工厂
│   ├── hooks/              # Claude Code 生命周期钩子
│   │   ├── sessionStart.ts
│   │   ├── userPromptSubmit.ts
│   │   ├── postToolUse.ts
│   │   └── sessionEnd.ts
│   ├── knowledge/          # 知识库管理
│   │   ├── storageManager.ts
│   │   ├── relationEngine.ts
│   │   ├── linkIndexer.ts
│   │   └── conflictResolver.ts
│   ├── services/           # 业务服务
│   │   └── projectDiscovery.ts
│   ├── worker/             # Express HTTP Server
│   │   ├── server.ts
│   │   ├── routes/         # API 路由
│   │   ├── middleware/     # 中间件
│   │   ├── sseBroadcaster.ts  # SSE 实时推送
│   │   └── analysisTracker.ts # 分析进度追踪
│   └── config.ts           # 核心配置
├── web/                    # Vue 3 前端
│   ├── src/
│   │   ├── views/          # 页面组件
│   │   ├── components/     # UI 组件
│   │   ├── stores/         # Pinia 状态管理
│   │   ├── composables/    # Vue 组合式函数
│   │   ├── api/            # API 客户端
│   │   └── router/         # Vue Router
│   └── vite.config.ts
├── knowledge/              # 生成的知识库文档
├── dev-scripts/            # 开发脚本
│   └── daemon.js           # 守护进程管理器
└── .claude/                # Claude Code 配置
    ├── skills/             # Skill 定义
    └── hooks/              # 钩子配置
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/stream` | SSE 实时推送（分析进度） |
| GET | `/api/projects` | 项目列表 |
| GET | `/api/projects/:name` | 项目详情 |
| GET | `/api/projects/:name/analysis-status` | 分析状态 |
| POST | `/api/projects/:name/analyze` | 触发全量分析 |
| GET | `/api/projects/:name/files` | 项目文件树 |
| GET | `/api/projects/:name/files/*` | 读取文件/文档内容 |
| GET | `/api/projects/:name/source` | 读取源码文件 |
| GET | `/api/search` | 全文搜索 |
| GET | `/api/logs` | Worker 运行日志 |
| GET | `/api/config` | 系统配置 |

## 技术栈

**后端：**
- TypeScript + Node.js
- Express（HTTP Server）
- sql.js（SQLite WASM，零原生编译依赖）
- simple-git（Git 操作）
- chokidar（文件系统监控）
- @anthropic-ai/sdk（AI API）

**前端：**
- Vue 3 + Composition API
- Vite（构建工具）
- Pinia（状态管理）
- Vue Router（路由）
- marked + highlight.js（Markdown 渲染 + 语法高亮）
- DOMPurify（XSS 防护）

## 默认配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `server.port` | `38888` | Worker HTTP 端口 |
| `knowledge.directoryName` | `knowledge` | 知识库目录名 |
| `analysis.mode` | `incremental` | 默认分析模式 |
| `analysis.fullAnalysisIntervalDays` | `30` | 全量分析间隔（天） |
| `detection.preferredStrategy` | `hook` | 优先检测策略 |
| `detection.pollerIntervalMs` | `5000` | 轮询间隔（毫秒） |
| `logging.level` | `info` | 日志级别 |
| `projectDiscovery.autoDiscover` | `true` | 自动发现项目 |
| `projectDiscovery.maxDepth` | `3` | 项目扫描最大深度 |

## 作为 Claude Code Skill 使用

Claude-DevSprite 通过四个生命周期钩子与 Claude Code 集成：

| 钩子 | 触发时机 | 功能 |
|------|----------|------|
| SessionStart | 会话启动 | 初始化数据库、启动 Worker、触发项目发现 |
| UserPromptSubmit | 用户输入 | 拦截 `/kb` 命令，提供状态查询和手动分析 |
| PostToolUse | 工具调用后 | 跟踪文件修改操作 |
| SessionEnd | 会话结束 | 停止检测器、关闭数据库、清理资源 |

## License

MIT
