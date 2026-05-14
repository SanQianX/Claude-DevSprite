---
title: 问题扫描器架构
category: overview
createdAt: '2026-05-14T01:20:00.000Z'
updatedAt: '2026-05-14T01:20:00.000Z'
relations:
  - 03-modules.md
---

# 问题扫描器架构

## 概述

问题扫描器使用 **两层 Claude Code CLI Agent 架构**，自动检测代码实现与设计文档的不一致。

- **协调 Agent（Orchestrator）**：轻量级，读设计文档、识别问题、创建任务目录
- **子 Agent（Worker）**：深度分析，在问题目录中独立运行，可恢复

## 架构图

```
触发扫描（定时 / 手动）
    │
    ▼
┌─────────────────────────────────────────────────┐
│ Phase 1: Orchestrator                            │
│ cwd = scanteaks/ 目录                            │
│                                                  │
│ 1. Read tasks/FUNCTIONAL-LOGIC-ANALYSIS.md       │
│ 2. Read tasks/BUG-HUNTING-PLAN.md                │
│ 3. Read tasks/COMPONENT-INVENTORY.md             │
│ 4. 快速扫描代码（Grep + Read）                    │
│ 5. 为每个问题创建目录 + task.md + CLAUDE.md       │
│    （最多 10 个问题）                              │
│ 6. 写 summary.md + findings.json                 │
│ 7. → 关闭                                        │
└─────────────────────────────────────────────────┘
    │
    │ 创建了 N 个问题目录（N ≤ 10）
    ▼
┌─────────────────────────────────────────────────┐
│ Phase 2: Workers（最多 2 个并行）                 │
│                                                  │
│ ┌─ Worker 1 ─┐  ┌─ Worker 2 ─┐                  │
│ │ cwd = dir1/ │  │ cwd = dir2/ │                  │
│ │ Read CLAUDE │  │ Read CLAUDE │                  │
│ │ Read task   │  │ Read task   │                  │
│ │ 深度分析     │  │ 深度分析     │                  │
│ │ 写 4 文件    │  │ 写 4 文件    │                  │
│ └─────────────┘  └─────────────┘                  │
│     ↓ 完成一个 → 启动下一个                       │
│                                                  │
│ Worker 3: cwd = scanteaks/issue-dir-3/           │
│   ...                                            │
└─────────────────────────────────────────────────┘
    │
    │ 所有 Worker 完成后
    ▼
Phase 3: 读取 findings.json → 存入 SQLite reviews 表
```

## 目录结构

```
{projectPath}/.claude-devsprite/scanteaks/
├── summary.md                          ← 扫描摘要（统计、问题列表）
├── findings.json                       ← 结构化汇总（供 DB 导入）
├── missing-task-sync_2026-05-14/       ← 问题目录（语义化命名，最多 10 个）
│   ├── .claude/                        ← Claude Code 对话历史（自动）
│   ├── CLAUDE.md                       ← 协调 Agent 写的工作指南（给子 Agent）
│   ├── task.md                         ← 协调 Agent 写的任务描述
│   ├── finding.md                      ← 子 Agent 输出：问题描述、严重程度、分类
│   ├── analysis.md                     ← 子 Agent 输出：发现过程、影响范围、根因
│   ├── verification.md                 ← 子 Agent 输出：验证结果、预期 vs 实际
│   └── fix-suggestion.md               ← 子 Agent 输出：修复方案、涉及文件、步骤
├── dead-code-approve-endpoint_2026-05-14/
│   └── ...
└── api-path-mismatch_2026-05-14/
    └── ...
```

## 目录命名规则

格式: `{问题关键词}_{YYYY-MM-DD}/`

- 英文小写，单词间用连字符
- 从问题标题中提取 2-4 个核心词
- 示例: `missing-task-sync_2026-05-14/`, `dead-code-approve-endpoint_2026-05-14/`

## 核心文件说明

### task.md（协调 Agent → 子 Agent 的契约）

协调 Agent 创建，包含：
- 问题基本信息（严重程度、模块、排查项、分类）
- 问题描述和设计文档原文
- 需要分析的内容清单
- 相关文件提示

### CLAUDE.md（协调 Agent → 子 Agent 的工作指南）

协调 Agent 创建，包含：
- 项目路径信息
- 完整的工作流步骤（7 步）
- 设计文档读取路径
- 分析结果输出文件列表
- 重要规则（中文、文件路径验证等）

子 Agent 启动时同时读取 task.md（问题描述）和 CLAUDE.md（工作流程）。

### finding.md（子 Agent 输出）

- 问题标题和元数据
- 严重程度: critical / warning / info
- 分类: missing-impl / dead-code / logic-mismatch / api-mismatch / state-mismatch
- 关联到 FUNCTIONAL-LOGIC-ANALYSIS.md 的模块和排查项编号

### analysis.md（子 Agent 输出）

- 发现过程：读了哪些文件、搜了什么关键词
- 影响范围：搜索所有引用，评估影响
- 根因分析：为什么会出现不一致

### verification.md（子 Agent 输出）

- 验证结果和具体过程
- 预期 vs 实际对比

### fix-suggestion.md（子 Agent 输出）

- 修复方案和涉及文件
- 具体修改步骤和方向

## 发现问题的逻辑

### 数据源

| 文档 | 用途 |
|------|------|
| `tasks/FUNCTIONAL-LOGIC-ANALYSIS.md` | 每个模块的排查项、测试方法、预期结果 |
| `tasks/BUG-HUNTING-PLAN.md` | 按优先级分组的 Bug 排查计划 |
| `tasks/COMPONENT-INVENTORY.md` | UI 组件清单和风险评级 |

### 排查方法

对于 FUNCTIONAL-LOGIC-ANALYSIS.md 中的每个模块每个排查项：
1. 阅读"测试方法"列描述的操作
2. 用 Grep 搜索相关 API 路由、函数名、状态变量
3. 用 Read 查看对应源代码文件
4. 判断"预期结果"是否在代码中实现

### 重点关注

- 标记了 ⚠️ **未实现** 的排查项 → 用代码验证是否确实未实现
- 标记了 ⚠️ **UI 未暴露** 的项 → 检查后端有但前端没有的功能
- API 端点 → 对比文档描述的路径和代码中的实际路径
- 状态管理 → 对比文档描述的 store 逻辑和实际实现

## 触发方式

### 定时扫描

- 默认间隔: 10 分钟（可配置）
- 启动后延迟 30 秒执行首次扫描
- 遍历所有已注册项目

### 手动扫描

- API: `POST /api/projects/:name/reviews/scan`
- 前端: Dashboard "开始扫描" 按钮

## 状态追踪

### API

`GET /api/scanner/status` 返回：

```json
{
  "enabled": true,
  "intervalMs": 600000,
  "isScanning": true,
  "activeProjects": [
    {
      "projectId": "abc-123",
      "projectName": "Claude-DevSprite",
      "scanDir": "D:\\Claude-DevSprite\\.claude-devsprite\\scanteaks",
      "startedAt": 1778691144083
    }
  ],
  "lastScanTime": 1778690102780
}
```

### 前端显示

- **扫描中**: 黄色脉冲指示器 + 项目名 + 已用时间
- **空闲时**: 显示上次扫描时间
- 每 5 秒轮询更新

### 内部状态

- `activeScanInfo: Map<projectId, ProjectScanStatus>` — 跟踪每个正在进行的扫描
- `isScanning` (getter) = `isBatchScanning || activeScanInfo.size > 0`
- 共享单例: `getSharedScanner()` 确保所有模块使用同一个 scanner 实例

## 超时和重叠保护

| 参数 | 值 | 说明 |
|------|------|------|
| 协调 Agent 超时 | 20 分钟 | 超时后 kill 进程 |
| 子 Agent 超时 | 10 分钟 | 超时后 kill 进程 |
| 最大问题数 | 10 | 每次扫描最多发现 10 个问题 |
| 最大并行子 Agent | 2 | 最多同时运行 2 个子 Agent |
| 最大跳过次数 | 3 | 连续 3 次检测到进程仍在运行则强制 kill |

## 生命周期管理

### isScanning 状态

`isScanning` 在整个扫描周期内保持 `true`：
1. `activeScanInfo.set()` — Phase 1 开始（Orchestrator 运行期间）
2. Phase 2（Workers 运行期间）— `activeScanInfo` 仍然存在
3. Phase 3（读取 findings.json 存入 DB）
4. `activeScanInfo.delete()` — 所有阶段完成后才清除

这意味着 UI 上的"正在扫描"状态会一直显示，直到所有子 Agent 都完成。

### 并发控制

使用 `runWorkersWithConcurrencyLimit()` 实现 Worker 池：
- 最多同时运行 `MAX_PARALLEL_WORKERS` (2) 个子 Agent
- 一个完成后立即启动下一个排队的任务
- 所有 Worker 完成后才进入 Phase 3

### 新扫描阻塞

`scanAllProjects()` 检查 `isScanning`，如果当前有扫描在进行（包括子 Agent 未完成），自动跳过。

## 配置

从 `~/.claude-dev-sprite/config.json` 读取：

```json
{
  "ai": {
    "scanner": {
      "model": "claude-sonnet-4-6",
      "apiKey": "...",
      "baseUrl": "...",
      "intervalMs": 600000
    }
  }
}
```

## 后续操作

### 恢复问题分析

```bash
cd {projectPath}/.claude-devsprite/scanteaks/{issue-dir}
claude -c    # 恢复上次对话，继续分析
```

### 追加分析记录

子 Agent 可在问题目录中追加文件：
- `fix-applied.md` — 修复记录
- `test-result.md` - 修复后验证结果

## 代码位置

| 文件 | 职责 |
|------|------|
| `src/analyzer/agentScanner.ts` | 两层 Agent 架构核心实现 |
| `src/analyzer/designScanner.ts` | 对外接口 + 共享单例 |
| `src/worker/routes/reviews.ts` | API 端点（触发扫描、状态查询） |
| `src/worker/index.ts` | 后台定时扫描启动 |
