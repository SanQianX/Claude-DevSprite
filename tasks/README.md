# Tasks - Bug 排查与修复

## 目录结构

```
tasks/
├── README.md                      # 本文件 - 总索引
├── STATE.json                     # 任务状态 (自动化用)
├── task-runner.js                 # 任务执行器
├── setup-cron.bat                 # 设置定时任务 (管理员运行)
├── monitor.bat                    # 监控面板
├── COMPONENT-INVENTORY.md         # UI 控件清单 (722+ 控件)
├── FUNCTIONAL-LOGIC-ANALYSIS.md   # 功能逻辑排查 (核心!)
├── BUG-HUNTING-PLAN.md            # 排查计划 (组件分组)
├── BUG-FIX-TEMPLATE.md            # Bug 修复文档模板
└── bugfix/                        # 已完成的修复记录
    └── tokens-mock-data/          # Tokens Mock 数据修复
```

## 快速链接

| 文件 | 说明 |
|------|------|
| [FUNCTIONAL-LOGIC-ANALYSIS.md](./FUNCTIONAL-LOGIC-ANALYSIS.md) | **功能逻辑全面排查** - 数据流、状态同步、持久化 |
| [COMPONENT-INVENTORY.md](./COMPONENT-INVENTORY.md) | UI 控件清单 (722+ 控件) |
| [BUG-HUNTING-PLAN.md](./BUG-HUNTING-PLAN.md) | 48 个组件的排查计划 |
| [BUG-FIX-TEMPLATE.md](./BUG-FIX-TEMPLATE.md) | 文档模板 |

## 自动化系统

### 启动方式

```bash
# 1. 设置定时任务 (以管理员身份运行)
tasks\setup-cron.bat

# 2. 启动监控面板
tasks\monitor.bat

# 3. 手动执行一次
node tasks\task-runner.js
```

### 工作原理

```
┌─────────────────────────────────────────────────────────────────┐
│                    自动化循环流程                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Windows 定时任务 (每10分钟)                                      │
│       ↓                                                         │
│  task-runner.js                                                 │
│       ↓                                                         │
│  读取 STATE.json                                                │
│       ↓                                                         │
│  检查 status 是否为 in_progress                                  │
│       │                                                         │
│       ├─ 是 → 检查是否超时 (>10分钟)                             │
│       │        ├─ 未超时 → 跳过本轮                              │
│       │        └─ 已超时 → 标记为 idle，继续                      │
│       │                                                         │
│       └─ 否 (idle) → 获取下一个任务                              │
│               ↓                                                 │
│           更新状态为 in_progress                                 │
│               ↓                                                 │
│           创建 bugfix 文件夹                                     │
│               ↓                                                 │
│           生成任务报告模板                                       │
│               ↓                                                 │
│           更新状态为 idle                                        │
│               ↓                                                 │
│           git commit + push                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 状态说明

| status | 说明 |
|--------|------|
| `idle` | 空闲，可以开始新任务 |
| `in_progress` | 正在开发中，定时任务跳过 |
| `completed` | 所有任务完成 |

### 任务队列 (STATE.json)

| # | 任务 ID | 名称 | 优先级 |
|---|---------|------|--------|
| 1 | devchat-message-flow | DevChat 消息收发 | P0 |
| 2 | devchat-session-persistence | DevChat 会话持久化 | P0 |
| 3 | ai-review-scan | AI 审查扫描 | P0 |
| 4 | ai-review-fix | AI 审查修复 | P0 |
| 5 | task-sync | 任务创建同步 | P0 |
| 6 | task-status-management | 任务状态管理 | P1 |
| 7 | project-analysis | 项目分析 | P1 |
| 8 | config-management | 配置管理 | P2 |
| 9 | knowledge-base | 知识库浏览 | P2 |

## 项目规模

| 类别 | 数量 |
|------|------|
| Vue 组件 | 48 |
| API 端点 | 64 |
| WebSocket 事件 | 19 |
| 数据库表 | 8 |
| Pinia Store | 9 |
| UI 控件 | 722+ |
| 排查任务 | 10 |

## 排查进度

### UI 控件层面
| 组件 | 优先级 | 控件数 | 状态 |
|------|--------|--------|------|
| TokensBar | P0 | 10 | ✅ 已修 |
| TokenDetailModal | P0 | 13 | ✅ 已修 |
| WorkspaceView | P0 | 18 | ✅ 已修 |
| DocPanel | P0 | 8 | ✅ 已修 |
| 其余 44 个组件 | - | 673 | ⏳ 待测 |

### 功能逻辑层面
| 模块 | 优先级 | 状态 |
|------|--------|------|
| DevChat 消息收发 | P0 | ⏳ 待测 |
| DevChat 会话切换 | P0 | ⏳ 待测 |
| AI 审查扫描 | P0 | ⏳ 待测 |
| AI 审查修复 | P0 | ⏳ 待测 |
| 任务创建同步 | P0 | ⏳ 待测 |
| 任务状态管理 | P1 | ⏳ 待测 |
| 项目分析 | P1 | ⏳ 待测 |
| 配置管理 | P2 | ⏳ 待测 |
| 知识库浏览 | P2 | ⏳ 待测 |
