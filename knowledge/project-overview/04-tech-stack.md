---
title: 技术栈
category: tech-stack
updatedAt: 2026-04-25
---

# 技术栈

## 后端技术栈

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **运行时** | Node.js | - | JavaScript 运行环境 |
| **语言** | TypeScript | 5.3.3 | 类型安全的 JavaScript，strict 模式 |
| **Web 框架** | Express | 4.18.2 | HTTP 服务器和 RESTful API |
| **AI SDK** | @anthropic-ai/sdk | 0.91.1 | Claude API 直连调用（支持自定义 baseURL） |
| **Git 操作** | simple-git | 3.23.0 | Git 命令的 Node.js Promise 封装 |
| **文件监控** | chokidar | 3.6.0 | 跨平台文件系统监控 |
| **Markdown 解析** | marked | 12.0.1 | Markdown → HTML 转换 |
| **代码高亮** | highlight.js | 11.9.0 | 源码语法高亮 |
| **Frontmatter** | gray-matter | 4.0.3 | YAML Frontmatter 解析与生成 |
| **数据库** | sql.js | 1.11.0 | SQLite WASM 版本（无需原生编译） |

### 为什么选择这些技术

#### Express 4.x

- 轻量、成熟、生态极其丰富
- 中间件架构灵活，适合 API 服务
- 社区支持广泛，问题排查容易
- 配合 TypeScript 类型定义完善（`@types/express`）
- 路由组织清晰，每个路由模块独立文件（[routes/](/project/Claude-DevSprite/source?path=src/worker/routes/)）

#### simple-git

- Git 命令的 Promise 封装，API 直观
- 支持 diff、log、show、diffSummary 等所有常用 Git 操作
- 完整的 TypeScript 类型支持
- 跨平台兼容性好
- 核心使用场景：DiffCollector 收集变更、ContextBuilder 获取提交信息、检测器比对 HEAD 哈希

#### sql.js（SQLite WASM）

- **零原生编译**：无需 node-gyp，完美支持 Windows/macOS/Linux
- **零配置**：数据存储在单个 `.db` 文件中（`~/.claude/claude-dev-sprite/data/dev-sprite.db`）
- **适合场景**：单机应用的轻量级元信息存储（项目信息、分析记录）
- **WASM 性能**：足以应对项目元数据查询场景
- 初始化逻辑位于 [config.ts](/project/Claude-DevSprite/source?path=src/config.ts)，自动创建数据目录

#### chokidar

- Node.js 文件监控的事实标准
- 跨平台兼容（Windows / macOS / Linux）
- 支持 `awaitWriteFinish` 处理 Git 原子写入（`stabilityThreshold: 100`）
- 用于 Git 检测层 Level 2 的 `.git/HEAD` 和 `.git/refs/heads` 监控
- 内置 200ms 防抖防止重复触发

#### gray-matter

- 处理 YAML Frontmatter 的标准工具
- 支持 `stringify` 和 `parse` 双向操作
- 为知识库文档提供结构化元数据（title、category、日期、relations）
- 在 DocumentGenerator、DocumentWriter、ContextBuilder 中广泛使用

#### @anthropic-ai/sdk

- Anthropic 官方 SDK，支持流式和非流式调用
- **自定义 baseURL**：适配代理服务（如 GLM、OpenRouter 等）
- **自定义认证 Token**：支持 `ANTHROPIC_AUTH_TOKEN` 环境变量
- **双模式容错**：SDK 模式 + Claude CLI 子进程模式
- 配置加载链：环境变量 → `~/.claude-dev-sprite/.env` → `worker-env.json`

#### TypeScript 全栈

- 后端（`src/`）和前端（`web/src/`）统一使用 TypeScript
- 编译期错误检测减少运行时 Bug
- `tsconfig.json` 配置：`strict: true`、`ES2020` 目标、`declaration: true`
- 前端 `vite-env.d.ts` 提供类型声明

---

## 前端技术栈

| 类别 | 技术 | 用途 |
|------|------|------|
| **框架** | Vue.js 3 (Composition API) | 渐进式前端框架 |
| **构建工具** | Vite 5.x | 快速开发服务器和生产构建 |
| **路由** | Vue Router 4.x | SPA 路由管理 |
| **状态管理** | Pinia | Vue 官方推荐状态管理 |
| **Markdown 渲染** | marked | 知识库文档内容渲染 |
| **代码高亮** | highlight.js | 代码块和源码预览高亮 |
| **语言** | TypeScript | 前端类型安全 |

### 为什么选择 Vue 3

#### Composition API

- 更好的逻辑复用 — 通过 Composables（组合式函数）提取和共享逻辑
- TypeScript 友好 — 完整的类型推导
- 更灵活的代码组织 — 按功能而非选项类型组织
- 项目中 5 个 Composable：useBreadcrumb、useDocument、useFileTree、useProjectList、useToc

#### Pinia 状态管理

- Vue 官方推荐，替代 Vuex
- 完整 TypeScript 支持
- 轻量级 API，无 mutations
- 5 个 Store：projects、knowledge、analysis、search、ui

#### Vite 构建

- 极快的 HMR（热模块替换）
- 原生 ESM 开发模式
- 配置文件 [vite.config.ts](/project/Claude-DevSprite/source?path=web/vite.config.ts) 中配置 API 代理到后端

---

## 开发工具链

| 工具 | 用途 |
|------|------|
| **tsx** | TypeScript 直接执行（开发模式 `tsx --watch`） |
| **vitest** | 单元测试框架 |
| **tsc** | TypeScript 编译器（生产构建） |

### NPM Scripts

| 命令 | 功能 |
|------|------|
| `npm run build` | TypeScript 编译到 `dist/` |
| `npm run dev` | tsx 监听模式启动开发服务器 |
| `npm run start` | 运行编译后的生产版本 |
| `npm run test` | 运行 vitest 测试 |
| `npm run daemon:start` | 通过 [daemon.js](/project/Claude-DevSprite/source?path=dev-scripts/daemon.js) 启动后台守护进程 |
| `npm run daemon:stop` | 停止守护进程 |
| `npm run daemon:status` | 查看守护进程状态 |
| `npm run daemon:restart` | 重启守护进程 |

---

## 构建与部署

### 后端构建

- **编译**：`tsc` 编译 `src/` → `dist/`，生成 `.js`、`.d.ts`、`.js.map` 文件
- **入口**：`dist/worker/index.js`（`package.json` 的 `main` 字段）
- **运行时依赖**：所有 `dependencies` 包在部署时需要

### 前端构建

- **开发**：`vite` 开发服务器（端口 5173），代理 API 到后端 38888
- **生产**：`vite build` 输出到 `web/dist/`
- **静态资源**：Favicon、Logo 等位于 `web/public/`

### 守护进程管理

通过 [daemon.js](/project/Claude-DevSprite/source?path=dev-scripts/daemon.js) 管理 Worker 进程：
- **PID 文件**：`dev-scripts/worker.pid`
- **日志**：`dev-scripts/worker-stdout.log` + `dev-scripts/worker-stderr.log`
- **环境变量**：通过 `dev-scripts/worker-env.json` 注入
- **启动脚本**：`dev-scripts/start-worker.cmd`（Windows）

---

## 项目依赖关系图

```
Claude-DevSprite
  ├── 后端 (src/)
  │     ├── @anthropic-ai/sdk ← AI 分析引擎
  │     ├── simple-git ← Git 操作 + 检测器
  │     ├── chokidar ← .git 目录监控
  │     ├── express ← HTTP API 服务器
  │     ├── sql.js ← 元数据存储
  │     ├── gray-matter ← 文档 Frontmatter
  │     ├── marked ← Markdown 处理
  │     └── highlight.js ← 代码高亮
  │
  └── 前端 (web/)
        ├── Vue 3 ← UI 框架
        ├── Vue Router ← SPA 路由
        ├── Pinia ← 状态管理
        ├── Vite ← 构建工具
        ├── marked ← 文档渲染
        └── highlight.js ← 代码高亮
```

---

## 测试框架

| 工具 | 版本 | 用途 |
|------|------|------|
| vitest | 1.4.0 | 单元测试和集成测试 |
| tsx | 4.7.0 | 测试文件直接执行 |

测试文件位于项目根 `tests/` 目录（不存在，但 References/claude-mem-main/tests/ 中有大量参考测试）。测试覆盖范围包括：Git 检测器、AI 分析引擎、Worker 服务器、工具函数等。