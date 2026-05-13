---
title: 项目概览
category: overview
updatedAt: 2026-05-12
---

# 项目概览

## 一句话描述

**Claude-DevSprite 是一个 Claude Code Skill 插件，自动监听 Git 仓库的 Commit 事件，通过 AI（Claude）分析代码变更，实时生成结构化的 Markdown 知识库文档，并提供 Web Dashboard 进行可视化浏览与源码跳转，同时集成了多 Agent 团队协作系统。**

## 项目定位

Claude-DevSprite 围绕五个核心环节构成完整闭环：

1. **自动监听** — 三级 Git Commit 检测策略（Post-Commit Hook → .git 目录监控 → Reflog 轮询），自动降级，零配置即可工作
2. **AI 分析** — 复用 Claude Code 模型配置（支持 Anthropic SDK 直连与 Claude CLI 子进程两种模式），将代码 Diff 转化为高质量文档
3. **生成/更新** — 以 `knowledge/`（代码中实际配置为 `doc`）目录为载体，产出带有 YAML Frontmatter 的结构化 Markdown 文档，支持增量更新与全量重建
4. **可视化浏览** — 基于 Vue 3 + Vite 的 Web Dashboard（默认 `localhost:38888`），提供文档树、Markdown 渲染、源码预览、全文搜索、目录导航（TOC）等功能
5. **多 Agent 团队** — Lead / Dev / Test 三角色 Agent 协作系统，支持实时聊天与任务执行

## 核心价值

### 对开发者

- **零配置使用**：[ProjectDiscoveryService](/project/Claude-DevSprite/source?path=src/services/projectDiscovery.ts) 自动扫描 `~/Projects`、`~/code`、`~/dev`、`~/workspace` 等常见目录，无需手动注册项目
- **智能文档生成**：AI 自动分析代码变更，生成包含架构说明、模块分析、变更日志等有价值的知识文档
- **知识积累**：随着项目迭代，知识库自动更新和丰富，形成活文档（Living Documentation）
- **源码关联**：文档中通过 `[source](/project/Claude-DevSprite/source?path=src/some/file.ts)` 链接可直接跳转到对应源码查看
- **代码质量保障**：内置 [CodeReviewer](/project/Claude-DevSprite/source?path=src/analyzer/codeReviewer.ts) 和 [DesignChecker](/project/Claude-DevSprite/source?path=src/analyzer/designChecker.ts) 模块，自动发现安全、性能和设计一致性问题

### 对团队

- **知识共享**：文档存储在项目 `knowledge/` 目录，可纳入 Git 版本控制，随代码一起分发
- **降低上手门槛**：新成员可通过知识库的概览、架构、模块等文档快速了解项目全貌
- **变更可追溯**：每次 Commit 都会生成变更记录（Changelog），关联具体源文件
- **协作开发**：通过多 Agent 团队系统，实现 Lead 架构决策、Dev 代码实现、Test 质量验证的协作流程

## 解决的痛点

| 痛点 | 传统方式 | Claude-DevSprite 方案 |
|------|----------|----------------------|
| 文档维护成本高 | 手动编写，容易遗忘 | AI 自动生成，随 Commit 更新 |
| 知识散落各地 | 分散在 Issue、PR、注释中 | 统一存储在 `knowledge/` 目录 |
| 新人上手慢 | 缺乏系统化入口 | 概览 → 架构 → 模块 → 变更记录，层次分明 |
| 文档容易过时 | 代码演进后文档未同步 | 检测到 Commit 即触发更新 |
| 代码审查人工成本高 | 依赖人工 Code Review | AI 自动扫描并提供修复建议 |
| 团队协作流程不透明 | 缺乏统一的任务管理和沟通平台 | 多 Agent 团队系统提供实时聊天和任务跟踪 |

## 典型使用场景

- **个人项目**：记录代码演进历程，快速回顾设计决策，充当“第二大脑”
- **小团队协作**：建立共享知识库，减少口头沟通成本，促进知识沉淀
- **开源项目**：自动维护文档，降低贡献者理解门槛
- **学习研究**：分析他人项目结构，理解架构设计思路
- **质量保障流程**：集成到 CI/CD，自动触发代码审查和设计一致性检查

## 工作流程

```
git commit
  ↓
[CommitDetectorManager](/project/Claude-DevSprite/source?path=src/detectors/index.ts) 捕获 Commit 事件
  （三级降级：Hook / Watcher / Poller）
  ↓
[AnalysisPipeline](/project/Claude-DevSprite/source?path=src/analyzer/pipeline.ts) 执行 7 步流水线：
  1. [DiffCollector](/project/Claude-DevSprite/source?path=src/analyzer/diffCollector.ts) 收集变更内容
  2. [ContextBuilder](/project/Claude-DevSprite/source?path=src/analyzer/contextBuilder.ts) 构建分析上下文（含已有知识库文档）
  3. [ModeDecider](/project/Claude-DevSprite/source?path=src/analyzer/modeDecider.ts) 决定增量/全量分析模式
  4. [PromptBuilder](/project/Claude-DevSprite/source?path=src/analyzer/promptBuilder.ts) + [AIProvider](/project/Claude-DevSprite/source?path=src/analyzer/aiProvider.ts) 调用 Claude 生成文档
  5. [ResponseParser](/project/Claude-DevSprite/source?path=src/analyzer/responseParser.ts) + [DocumentGenerator](/project/Claude-DevSprite/source?path=src/analyzer/documentGenerator.ts) 产出结构化 Markdown
  ↓
[StorageManager](/project/Claude-DevSprite/source?path=src/knowledge/storageManager.ts) 写入 knowledge/ 目录
  ↓
Web Dashboard 实时展示更新（SSE 推送）
```

## 关键配置入口

核心配置位于 [config.ts](/project/Claude-DevSprite/source?path=src/config.ts)，主要配置项包括：

- `server.port`: Worker HTTP 端口（默认 38888）
- `knowledge.directoryName`: 知识库目录名（代码中默认为 `doc`）
- `analysis.mode`: 默认分析模式（incremental/full）
- `analysis.maxRetries`: AI 调用重试次数
- `detection.preferredStrategy`: 优先检测策略
- `projectDiscovery.scanPaths`: 项目扫描路径列表