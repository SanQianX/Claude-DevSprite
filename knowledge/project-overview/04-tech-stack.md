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
| **语言** | TypeScript | 5.3.3 | 类型安全的 JavaScript |
| **Web 框架** | Express | 4.18.2 | HTTP 服务器和 RESTful API |
| **AI SDK** | @anthropic-ai/sdk | 0.91.1 | Claude API 直连调用 |
| **Git 操作** | simple-git | 3.23.0 | Git 命令的 Node.js Promise 封装 |
| **文件监控** | chokidar | 3.6.0 | 跨平台文件系统监控 |
| **Markdown 解析** | marked | 12.0.1 | Markdown → HTML 转换 |
| **代码高亮** | highlight.js | 11.9.0 | 源码语法高亮 |
| **Frontmatter** | gray-matter | 4.0.3 | YAML Frontmatter 解析与生成 |
| **数据库** | sql.js | 1.11.0 | SQLite WASM 版本（无需原生编译） |

### 为什么选择这些技术

**Express 4.x**：
- 轻量、成熟、生态极其丰富
- 中间件架构灵活，适合 API 服务
- 社区支持广泛，问题排查容易
- 配合 TypeScript 类型定义完善（`@types/express`）

**simple-git**：
- Git 命令的 Promise 封装，API 直观
- 支持 diff、log、show、diffSummary 等所有常用 Git 操作
- 完整的 TypeScript 类型支持
- 跨平台兼容性好

**sql.js（SQLite WASM）**：
- 无需原生编译，真正的跨平台（包括 Windows）
- 零配置，数据存储在单个 `.db` 文件中
- 适合单机应用的轻量级元信息存储
- WASM 性能足够应对项目元数据查询

**chokidar**：
- Node.js 文件监控的事实标准
- 跨平台兼容（Windows / macOS / Linux）
- 支持 `awaitWriteFinish` 处理原子写入
- 用于 Git 检测层 Level 2 的 `.git` 目录监控

**gray-matter**：
- 处理 YAML Frontmatter 的标准工具
- 支持 stringify 和 parse 双向操作
- 为知识库文档提供结构化元数据（title、category、日期、relations）

**@anthropic-ai/sdk**：
- Anthropic 官方 SDK，支持流式和非流式调用
- 支持自定义 baseURL（适配代理服务如 GLM）
- 支持自定义认证 Token
- 与 Claude CLI 形成双模式容错

**TypeScript 全栈**：
- 后端（`src/`）和前端（`web/src/`）统一使用 TypeScript
- 编译期错误检测减少运行时 Bug
- 更好的 IDE 智能提示和代码导航
- `strict: true` 严格模式确保类型安全

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

**Composition API**：
- 更好的逻辑复用 — 通过 Composables（组合式函数）提取和共享逻辑
- TypeScript 友好 — 完整的类型推导
- 更灵活的代码组织 — 相关逻辑聚合而非按选项类型分散

**Pinia vs Vuex**：
- 更轻量（去除了 mutations）
- 完整的 TypeScript 支持
- 更直观的 API（`defineStore` + `storeToRefs`）
- **关键注意事项**：解构 Store 必须使用 `storeToRefs()` 保持响应性

**Vite**：
- 开发时极速 HMR（热模块替换）
- 原生 ESM 支持，无需打包即可开发
- 生产构建自动代码分割和 Tree Shaking
- 配置简洁（[vite.config.ts](/project/Claude-DevSprite/source?path=web/vite.config.ts)）

---

## 开发工具链

| 工具 | 版本 | 用途 |
|------|------|------|
| npm | - | 包管理器 |
| tsx | 4.7.x | TypeScript 直接执行（开发时 `--watch` 模式） |
| tsc | 5.3.x | TypeScript 编译（生产构建） |
| vitest | 1.4.x | 单元测试框架 |

### NPM Scripts

```json
{
  "build": "tsc",                    // TypeScript 编译 → dist/
  "dev": "tsx --watch src/worker/index.ts",  // 开发模式，热重载
  "start": "node dist/worker/index.js",       // 生产启动
  "test": "vitest",                          // 运行测试
  "daemon:start": "node dev-scripts/daemon.js start",   // 后台启动
  "daemon:stop": "node dev-scripts/daemon.js stop",     // 停止守护进程
  "daemon:status": "node dev-scripts/daemon.js status", // 查看状态
  "daemon:restart": "node dev-scripts/daemon.js restart" // 重启
}
```

---

## 编译和部署

### 编译配置

**后端** ([tsconfig.json](/project/Claude-DevSprite/source?path=tsconfig.json))：
- Target: ES2020
- Module: CommonJS
- Strict mode 启用
- 输出目录: `dist/`
- 源码目录: `src/`
- 生成声明文件（`.d.ts`）和 Source Map

**前端** ([web/tsconfig.json](/project/Claude-DevSprite/source?path=web/tsconfig.json))：
- Vue 3 + Vite 标准配置

### 守护进程架构

使用独立进程架构（[daemon.js](/project/Claude-DevSprite/source?path=dev-scripts/daemon.js)）：

- **Windows**：`Start-Process -WindowStyle Hidden` 创建后台进程
- **Unix**：`child_process.spawn` + `detached: true` + `unref()`
- **PID 管理**：写入 `worker.pid` 文件
- **环境传递**：启动时将 `ANTHROPIC_API_KEY` 等环境变量写入 `worker-env.json`
- **日志**：stdout/stderr 重定向到 `worker-stdout.log` / `worker-stderr.log`

### 数据存储位置

| 数据类型 | 路径 | 说明 |
|----------|------|------|
| SQLite 数据库 | `~/.claude/claude-dev-sprite/data/dev-sprite.db` | 项目元信息 |
| 应用日志 | `~/.claude/claude-dev-sprite/logs/app.log` | 运行时日志 |
| 知识库文件 | `<project>/knowledge/` | Markdown 知识文档 |
| Worker 环境 | `dev-scripts/worker-env.json` | 运行时环境变量 |
| PID 文件 | `dev-scripts/worker.pid` | 守护进程 PID |

---

## 依赖关系图

```
Claude-DevSprite
├── @anthropic-ai/sdk     ← AI 分析核心
├── simple-git            ← Git 操作
├── chokidar              ← 文件监控
├── express               ← HTTP 服务
│   ├── cors              ← 跨域中间件
│   └── errorHandler      ← 错误处理
├── sql.js                ← 数据库
├── gray-matter           ← Frontmatter 处理
├── marked                ← Markdown 渲染
├── highlight.js          ← 代码高亮
├── TypeScript            ← 类型系统
├── Vue 3 + Pinia         ← 前端框架
├── Vite                  ← 前端构建
├── vitest                ← 测试框架
└── tsx                   ← 开发时 TS 执行
```