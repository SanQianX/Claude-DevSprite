---
title: 项目概览
category: overview
updatedAt: 2026-04-25
---

# 项目概览

## 一句话描述

**Claude-DevSprite 是一个 Claude Code Skill 插件，自动监听 Git 仓库的 Commit 事件，通过 AI（Claude）分析代码变更，实时生成结构化的 Markdown 知识库文档，并提供 Web Dashboard 进行可视化浏览与源码跳转。**

## 项目定位

Claude-DevSprite 围绕四个核心环节构成完整闭环：

1. **自动监听** — 三层 Git Commit 检测策略（Post-Commit Hook → .git 目录监控 → Reflog 轮询），自动降级，零配置即可工作
2. **AI 分析** — 复用 Claude Code 模型配置（支持 Anthropic SDK 直连与 Claude CLI 子进程两种模式），将代码 Diff 转化为高质量文档
3. **生成/更新** — 以 `knowledge/` 目录为载体，产出带有 YAML Frontmatter 的结构化 Markdown 文档，支持增量更新与全量重建
4. **可视化浏览** — 基于 Vue 3 + Vite 的 Web Dashboard（默认 `localhost:38888`），提供文档树、Markdown 渲染、源码预览、全文搜索、目录导航（TOC）等功能

## 核心价值

### 对开发者

- **零配置使用**：项目发现服务自动扫描 `~/Projects`、`~/code`、`~/dev`、`~/workspace` 等常见目录，无需手动注册
- **智能文档生成**：AI 自动分析代码变更，生成包含架构说明、模块分析、变更日志等有价值的知识文档
- **知识积累**：随着项目迭代，知识库自动更新和丰富，形成活文档（Living Documentation）
- **源码关联**：文档中通过 `[source](/project/Claude-DevSprite/source?path=src/...)` 链接可直接跳转到对应源码查看

### 对团队

- **知识共享**：文档存储在项目 `knowledge/` 目录，可纳入 Git 版本控制，随代码一起分发
- **降低上手门槛**：新成员可通过知识库的概览、架构、模块等文档快速了解项目全貌
- **变更可追溯**：每次 Commit 都会生成变更记录（Changelog），关联具体源文件

## 解决的痛点

| 痛点 | 传统方式 | Claude-DevSprite 方案 |
|------|----------|----------------------|
| 文档维护成本高 | 手动编写，容易遗忘 | AI 自动生成，随 Commit 更新 |
| 知识散落各地 | 分散在 Issue、PR、注释中 | 统一存储在 `knowledge/` 目录 |
| 新人上手慢 | 缺乏系统化入口 | 概览 → 架构 → 模块 → 变更记录，层次分明 |
| 文档容易过时 | 代码演进后文档未同步 | 检测到 Commit 即触发更新 |

## 典型使用场景

- **个人项目**：记录代码演进历程，快速回顾设计决策，充当"第二大脑"
- **小团队协作**：建立共享知识库，减少口头沟通成本，促进知识沉淀
- **开源项目**：自动维护文档，降低贡献者理解门槛
- **学习研究**：分析他人项目结构，理解架构设计思路

## 工作流程

```
git commit
  ↓
检测器捕获 Commit 事件（Hook / Watcher / Poller 三级降级）
  ↓
DiffCollector 收集变更内容
  ↓
ContextBuilder 构建分析上下文（含已有知识库文档）
  ↓
ModeDecider 决定增量/全量分析模式
  ↓
PromptBuilder + AIProvider 调用 Claude 生成文档
  ↓
ResponseParser + DocumentGenerator 产出结构化 Markdown
  ↓
StorageManager 写入 knowledge/ 目录
  ↓
Web Dashboard 实时展示更新
```

## 关键配置入口

核心配置位于 [config.ts](/project/Claude-DevSprite/source?path=src/config.ts)，涵盖服务器端口、知识库目录名、分析模式、检测策略、日志级别和项目发现路径等。默认服务端口 `38888`，知识库目录名 `knowledge`，AI 模型默认 `claude-sonnet-4-6`。