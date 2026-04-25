---
title: 技术栈
category: tech-stack
date: 2026-04-25
updatedAt: 2026-04-25
---

# 技术栈

## 后端技术栈

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **运行时** | Node.js | - | JavaScript 运行环境 |
| **语言** | TypeScript | 5.3.3 | 类型安全的 JavaScript |
| **Web 框架** | Express | 4.18.2 | HTTP 服务器和 RESTful API |
| **Git 操作** | simple-git | 3.23.0 | Git 命令的 Node.js 封装 |
| **文件监控** | chokidar | 3.6.0 | 跨平台文件系统监控 |
| **Markdown 解析** | marked | 12.0.1 | Markdown → HTML 转换 |
| **代码高亮** | highlight.js | 11.9.0 | 源码语法高亮 |
| **Frontmatter** | gray-matter | 4.0.3 | YAML Frontmatter 解析/生成 |
| **数据库** | sql.js | 1.11.0 | SQLite WASM 版本（无需原生编译） |
| **日志** | winston | 3.11.0 | 结构化日志系统 |

### 为什么选择这些技术

**Express**：
- 轻量、成熟、生态丰富
- 适合提供 RESTful API
- 中间件架构灵活

**simple-git**：
- Git 命令的 Promise 封装
- 支持 diff、log、show 等所有常用 Git 操作
- 类型安全的 TypeScript 支持

**sql.js (SQLite WASM)**：
- 无需原生编译，跨平台兼容
- 零配置，数据存储在单个文件中
- 适合单机应用的项目元信息存储

**TypeScript**：
- 全栈类型安全
- 更好的 IDE 支持和代码补全
- 编译期错误检测

## 前端技术栈

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **框架** | Vue.js | 3.4.x | 渐进式前端框架 |
| **构建工具** | Vite | 5.0.x | 快速开发服务器和构建 |
| **路由** | Vue Router | 4.2.x | SPA 路由管理 |
| **状态管理** | Pinia | 2.1.x | Vue 官方推荐状态管理 |
| **Markdown** | marked | 12.0.x | Markdown 内容渲染 |
| **代码高亮** | highlight.js | 11.9.x | 代码块语法高亮 |
| **TypeScript** | TypeScript | 5.3.x | 类型支持 |

### 为什么选择 Vue 3

**Composition API**：
- 更好的逻辑复用（组合式函数）
- TypeScript 友好
- 更灵活的代码组织

**Pinia vs Vuex**：
- 更轻量（无 mutations）
- 完整的 TypeScript 支持
- 更直观的 API
- **重要**：解构 store 必须使用 `storeToRefs()` 保持响应性

**Vite**：
- 开发时极速 HMR
- 生产构建优化
- 原生 ESM 支持

## 开发工具链

| 工具 | 版本 | 用途 |
|------|------|------|
| npm | - | 包管理 |
| tsx | 4.7.x | TypeScript 直接执行（开发） |
| tsc | 5.3.x | TypeScript 编译（生产） |
| vitest | 1.4.x | 单元测试 |
| vue-tsc | 1.8.x | Vue 类型检查 |

## 构建和部署

### 构建

```bash
# 后端编译
npm run build          # tsc → dist/

# 前端构建
cd web && npm run build  # Vite → web/dist/
```

### 守护进程

使用独立进程架构（类似 claude-mem）：
- **Windows**: `Start-Process -WindowStyle Hidden`
- **Unix**: `setsid` (planned)
- PID 文件跟踪：`dev-scripts/worker.pid`
- 健康检查：`GET /api/health`

### 静态文件服务

Express 同时服务：
- API 路由（`/api/*`）
- 前端静态文件（`web/dist/`）
- SPA 回退（非 API 路由返回 `index.html`）

## 数据存储

| 数据 | 存储位置 | 格式 |
|------|---------|------|
| 项目元信息 | `~/.claude/claude-dev-sprite/data/dev-sprite.db` | SQLite |
| 知识库文档 | `{project}/knowledge/` | Markdown + YAML |
| 日志 | `~/.claude/claude-dev-sprite/logs/` | 文本 |
| 前端构建 | `web/dist/` | 静态文件 |
| 守护进程 PID | `dev-scripts/worker.pid` | 文本 |
