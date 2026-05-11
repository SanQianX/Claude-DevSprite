# Project Workspace 设计文档

> **版本**: v1.1.1
> **日期**: 2026-05-11
> **状态**: 设计阶段
> **版本历史**: v1.0.0 → 基础双模式工作台 | v1.1.0 → 新增开发记忆功能 | v1.1.1 → 首页重新设计

---

## 1. 概述

### 1.1 目标

将项目页面 `/project/:name` 从单一的文档浏览页面，改造为**双模式项目工作台**：

- **Dashboard 模式**：项目总览、任务管理、AI 审查队列
- **Workspace 模式**：文档 + 代码 + 对话的可折叠多面板工作台

同时重新设计**首页 `/`**，移除左侧边栏，新增 Tokens 消费统计，优化整体布局。

### 1.2 核心设计理念

| 原则 | 说明 |
|------|------|
| **面板独立** | 每个面板可独立开关，最少保留 Chat 面板 |
| **布局自适应** | 根据打开的面板数量自动调整布局 |
| **Doc↔Code 关联** | 文档中的代码引用可直接跳转到代码位置 |
| **AI 审查驱动** | AI 后台扫描 → 人工审批 → AI 修复的闭环 |
| **双模式切换** | Dashboard 和 Workspace 通过 Tab 切换 |

---

## 2. 整体架构

### 2.1 页面结构

```
/ (首页)
├── Header (Logo + 通用搜索 + 语言/主题/设置)
├── Tokens 消费统计条 (轻量融合式)
├── 项目列表表格
└── Console 日志面板 (可折叠)

/project/:name
├── ?tab=dashboard (默认)  →  Dashboard 模式
│   ├── 项目信息栏
│   ├── 📋 项目计划 (任务列表)
│   └── 🔍 AI 审查队列 (审批表格)
│
└── ?tab=workspace          →  Workspace 模式
    ├── Toolbar (面板开关)
    ├── 📄 Doc Panel (知识库文档)
    ├── 📁 Code Panel (源码浏览)
    └── 💬 Chat Panel (开发对话)
```

### 2.2 路由设计

```typescript
{
  path: '/project/:projectName',
  component: ProjectLayout,
  children: [
    { path: '', name: 'project', component: ProjectView },
  ]
}
```

### 2.3 组件架构

```
ProjectView.vue (新)
├── ProjectToolbar.vue (新) — 模式切换 + 面板开关
├── DashboardView.vue (新)
│   ├── ProjectInfoBar.vue (新)
│   ├── TaskList.vue (新)
│   │   ├── TaskCard.vue (新)
│   │   └── AddTaskDialog.vue (新)
│   └── ReviewQueue.vue (新)
│       ├── ReviewFilter.vue (新)
│       └── ReviewItem.vue (新)
└── WorkspaceView.vue (新)
    ├── SplitPane.vue (新) — 可拖拽分隔面板
    ├── DocPanel.vue (新) — 封装 DocumentView
    ├── CodePanel.vue (新) — 封装 SourceViewer + 源码文件树
    ├── ChatPanel.vue (新) — 精简版 DevChatView
    └── FileTreeSidebar.vue (新) — 左侧文件树（知识库/源码 Tab 切换）
```

---

## 3. Dashboard 模式

（内容同 v1.1.0，此处省略，详见 v1.1.0 文档）

---

## 4. Workspace 模式

（内容同 v1.1.0，此处省略，详见 v1.1.0 文档）

---

## 5. 数据模型

（内容同 v1.1.0，此处省略，详见 v1.1.0 文档）

---

## 5A. 开发记忆功能 (Development Memory)

（内容同 v1.1.0，此处省略，详见 v1.1.0 文档）

---

## 6. 首页重新设计 (v1.1.1 新增)

### 6.1 设计目标

- 移除左侧 HomeSidebar（开发对话和设置入口已不需要）
- 新增 Tokens 消费统计，以轻量融合式横条展示
- 搜索框升级为通用搜索（文档 + 代码 + 项目）
- Console 日志面板保持原版设计，增加可折叠功能

### 6.2 布局结构

```
┌─────────────────────────────────────────────────────────────────────┐
│  Logo    🔍 搜索文档、代码、项目...     中  ☀  ⚙                   │
├─────────────────────────────────────────────────────────────────────┤
│  Tokens │ 1,284,567 │ ●Input 823K │ ●Output 461K │ ▏▏▏ +89K ↑12% │
│  ────── 日 ─ [周] ─ 月 ─ 全部 ───────────────────────────────────── │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  项目列表                                [+ 添加项目]               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 项目          仓库    最后更新          状态        操作     │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ 🔶 Claude..  Git   2026-05-11 2h ago  ● Ready    Open →   │   │
│  │ 🔵 MyApp..   Git   2026-05-11 3h ago  ●Analyzing Open →   │   │
│  │ 🟣 API..     Git   2026-05-09 2d ago  ● Ready    Open →   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Console  ☑ Auto-refresh                          ↻    ✕            │
│ LEVEL: [All] Info  Warn  Error                                     │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ [2026-05-10T09:31:02Z] [INFO] [teams-routes] Team routes reg  ││
│ │ [2026-05-10T09:31:02Z] [INFO] [session-manager] Loaded 0 ses  ││
│ │ [2026-05-10T09:31:02Z] [INFO] [DevSprite] Auto-discovering... ││
│ └─────────────────────────────────────────────────────────────────┘│
│ 29 of 29 lines                                          SSE Connected│
└─────────────────────────────────────────────────────────────────────┘
```

### 6.3 Tokens 统计条设计

**位置**：Header 下方，内容区顶部的固定横条

**设计原则**：
- 浅色背景（`#f8fafc`），与页面整体色调一致，不使用深色独立卡片
- 一行式布局，信息密度高但不拥挤
- 迷你柱状图 + 趋势数字，直观展示消耗情况

**组成元素**：
| 元素 | 说明 |
|------|------|
| 标签 | "Tokens" 文字标签 |
| 总量 | 加粗大字显示总消耗量 |
| 分隔线 | 视觉分隔 |
| 分项芯片 | Input(蓝) / Output(紫) / Cache(绿) 三色圆点 + 数值 |
| 迷你图表 | 7 天 Input+Output 双色柱状图 |
| 趋势 | 本周增量 + 百分比变化 |
| 周期切换 | 日 / 周 / 月 / 全部 按钮组 |

### 6.4 Console 日志面板

**保持原版设计**（参考截图 `日志模块.png`）：
- Header 行：`Console` 标题 + `☑ Auto-refresh` 复选框 + ↻ 刷新按钮 + ✕ 关闭按钮
- 过滤行：`LEVEL: All | Info | Warn | Error` 圆角胶囊按钮
- 日志区域：深色背景，绿色时间戳 `[2026-05-10T...]`，蓝色 `[INFO]`，黄色 `[模块名]`
- Footer：`29 of 29 lines` + `SSE Connected`

**新增功能**：
- 可折叠：点击 ✕ 按钮折叠整个 Console 区域（日志区 + 过滤行 + Footer）
- 折叠后 Header 行保持可见，可再次展开

### 6.5 项目表格

- 列：项目名、仓库类型、最后更新时间、分析状态、操作按钮
- 去掉了 Tokens/Docs 列（这些信息在各项目页面内查看）
- 状态支持：Ready（绿）、Analyzing（蓝+脉冲动画）、Failed（红）

---

## 7. API 设计

（内容同 v1.1.0，此处省略，详见 v1.1.0 文档）

---

## 8. 实现分期

### Phase 0: 首页重新设计 (v1.1.1) (1-2天)

- [ ] 移除 HomeSidebar 组件
- [ ] 实现 Tokens 消费统计条组件 (TokensBar.vue)
- [ ] 后端 Tokens 统计 API 端点
- [ ] Console 可折叠功能
- [ ] 搜索框升级为通用搜索
- [ ] 项目表格精简列

### Phase 1: 基础框架 (1-2天)

- [ ] ProjectView 容器组件 + Dashboard/Workspace Tab 切换
- [ ] WorkspaceView 面板容器 + SplitPane 拖拽组件
- [ ] 面板开关逻辑 + 布局自适应
- [ ] ProjectToolbar 工具栏

### Phase 2: Dashboard (2-3天)

- [ ] ProjectInfoBar 项目信息栏
- [ ] TaskList 任务列表 (CRUD + 状态流转)
- [ ] ReviewQueue 审查队列 (列表 + 筛选 + 详情展开)
- [ ] 任务/审查项的数据模型 + API 端点
- [ ] SQLite 数据库表 (tasks, reviews)

### Phase 3: Workspace 面板 (2-3天)

- [ ] DocPanel 封装 (复用 DocumentView)
- [ ] CodePanel 封装 (复用 SourceViewer + 新增文件树)
- [ ] ChatPanel 精简版 (复用 DevChatView 核心组件)
- [ ] FileTreeSidebar 双 Tab (知识库/源码)
- [ ] source-tree API 端点

### Phase 4: Doc↔Code 关联 (1-2天)

- [ ] 文档中 [source:path:line] 链接解析
- [ ] 点击跳转 + 行高亮动画
- [ ] Code 面板底部关联文档链接
- [ ] URL query params 同步

### Phase 5: AI 审查集成 (2-3天)

- [ ] 后台扫描任务调度器
- [ ] AI 代码审查 prompt 模板
- [ ] 审查结果解析 + 写入队列
- [ ] 批准操作 → AI 自动修复流程

### Phase 6: 开发记忆 (2-3天)

- [ ] DevMemoryContext 构建器
- [ ] 会话摘要自动生成
- [ ] 记忆 API 端点
- [ ] Chat 面板记忆横幅

---

## 9. 文件清单

### 新增文件 (首页相关)

```
web/src/components/home/TokensBar.vue          — Tokens 消费统计条
web/src/api/tokens.ts                          — Tokens 统计 API
src/worker/routes/tokens.ts                    — Tokens 统计端点
```

### 修改文件 (首页相关)

```
web/src/views/HomePage.vue                     — 移除 HomeSidebar，新增 TokensBar
web/src/components/layout/AppHeader.vue        — 搜索框 placeholder 改为通用搜索
```

### 删除/废弃文件

```
web/src/components/home/HomeSidebar.vue        — 左侧边栏不再需要
```

### 其余文件 (项目工作台，同 v1.1.0)

详见 v1.1.0 文档。
