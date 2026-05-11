# Project Workspace 设计文档

> **版本**: v1.0
> **日期**: 2026-05-11
> **状态**: 设计阶段

---

## 1. 概述

### 1.1 目标

将项目页面 `/project/:name` 从单一的文档浏览页面，改造为**双模式项目工作台**：

- **Dashboard 模式**：项目总览、任务管理、AI 审查队列
- **Workspace 模式**：文档 + 代码 + 对话的可折叠多面板工作台

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
// 路由结构
{
  path: '/project/:projectName',
  component: ProjectLayout,
  children: [
    { path: '', name: 'project', component: ProjectView },  // 新的统一入口
  ]
}

// ProjectView 内部通过 query param 切换模式
// /project/Claude-DevSprite?tab=dashboard
// /project/Claude-DevSprite?tab=workspace
// /project/Claude-DevSprite?tab=workspace&doc=project-overview/01-overview&code=src/analyzer/pipeline.ts&line=42
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

### 3.1 功能描述

Dashboard 是项目进入后的默认页面，提供项目全局视图：

1. **项目信息栏**：项目名称、路径、统计概览
2. **项目计划**：任务的增删改查，状态流转
3. **AI 审查队列**：AI 发现的问题列表，人工审批

### 3.2 项目计划 — 状态流转

```
Backlog → In Progress → Done
   ↑          ↓           ↓
   └──────────┘ (回退)    Archive
```

### 3.3 AI 审查队列 — 交互流程

```
AI 后台扫描 (定时/commit后/手动触发)
        │
        ▼
  发现问题 → 写入队列 (status: pending)
        │
        ├─→ ✅ 批准修复 → AI 自动修复 → 生成变更 → Chat 通知
        ├─→ ❌ 忽略    → 标记 ignored → 从列表隐藏
        └─→ 💬 讨论    → 打开 Chat → 与 AI 讨论方案
```

### 3.4 UI 示意 — Dashboard 默认状态

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  ◂ Claude-DevSprite         [📊 Dashboard]  [💻 Workspace]            🔍        │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─ 项目信息 ──────────────────────────────────────────────────────────────────┐│
│  │                                                                              ││
│  │   🔶 Claude-DevSprite                                                        ││
│  │   D:\Claude-DevSprite                              7 docs  │  342 files     ││
│  │   Git repository | Last analysis: 2h ago               3 in-progress        ││
│  │                                                                              ││
│  └──────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌─ 📋 项目计划 ──────────────────────────────────┐  ┌─ 📊 统计 ──────────────┐│
│  │                                                  │  │                        ││
│  │  ┌─ 🔵 进行中 (3) ────────────────────────────┐ │  │   总任务: 9            ││
│  │  │                                              │ │  │   ████████░░ 67%     ││
│  │  │  ◉ WebSocket 实时聊天优化                     │ │  │   Done: 6 / 9        ││
│  │  │    优先级: 高  |  预计: 3天                   │ │  │                        ││
│  │  │                                              │ │  │   本周完成: +3         ││
│  │  │  ◉ 多面板工作台布局                           │ │  │   待开发: 2            ││
│  │  │    优先级: 高  |  预计: 5天                   │ │  │                        ││
│  │  │                                              │ │  │                        ││
│  │  │  ◉ AI 自动代码审查                            │ │  │                        ││
│  │  │    优先级: 中  |  预计: 2天                   │ │  │                        ││
│  │  └──────────────────────────────────────────────┘ │  │                        ││
│  │                                                  │  │                        ││
│  │  ┌─ ✅ 已完成 (4) ─── 点击展开 ────────────────┐ │  │                        ││
│  │  └──────────────────────────────────────────────┘ │  │                        ││
│  │                                                  │  │                        ││
│  │  ┌─ 📥 待开发 (2) ─── 点击展开 ────────────────┐ │  │                        ││
│  │  └──────────────────────────────────────────────┘ │  │                        ││
│  │                                                  │  │                        ││
│  │  [+ 添加任务]                                     │  │                        ││
│  └──────────────────────────────────────────────────┘  └────────────────────────┘│
│                                                                                  │
│  ┌─ 🔍 AI 审查队列 ────────────────────────────────────────────────────────────┐│
│  │                                                                              ││
│  │  筛选: [全部 ▾] [严重性 ▾] [类型 ▾]        待审批: 5  已批准: 12  已忽略: 2 ││
│  │  ════════════════════════════════════════════════════════════════════════════ ││
│  │                                                                              ││
│  │  ┌─ 🔴 HIGH ────────────────────────────────────────────────────────────────┐│
│  │  │  未处理的 API 密钥异常可能导致进程崩溃                                     ││
│  │  │  📍 src/analyzer/aiProvider.ts:87                                         ││
│  │  │  💡 AI 建议: 添加 try-catch 并实现降级到 CLI 模式                         ││
│  │  │  📅 2026-05-10 22:30  │  来源: 后台自动扫描                               ││
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                    ││
│  │  │  │ ✅ 批准   │ │ ❌ 忽略   │ │ 💬 讨论   │ │ 📍 定位   │                    ││
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘                    ││
│  │  └──────────────────────────────────────────────────────────────────────────┘│
│  │                                                                              ││
│  │  ┌─ 🟡 MED ─────────────────────────────────────────────────────────────────┐│
│  │  │  buildFileTree 递归深度无限制，大项目可能导致栈溢出                         ││
│  │  │  📍 src/worker/routes/files.ts:142                                        ││
│  │  │  💡 AI 建议: 添加 maxDepth 参数限制递归层级                               ││
│  │  │  📅 2026-05-10 22:30  │  来源: 后台自动扫描                               ││
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                    ││
│  │  │  │ ✅ 批准   │ │ ❌ 忽略   │ │ 💬 讨论   │ │ 📍 定位   │                    ││
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘                    ││
│  │  └──────────────────────────────────────────────────────────────────────────┘│
│  │                                                                              ││
│  │  ┌─ 🟡 MED ─────────────────────────────────────────────────────────────────┐│
│  │  │  内存中 Map 无大小限制，长期运行可能 OOM                                   ││
│  │  │  📍 src/knowledge/relationEngine.ts:45                                    ││
│  │  │  💡 AI 建议: 添加 LRU 缓存或定期清理过期条目                              ││
│  │  │  📅 2026-05-10 21:15  │  来源: 后台自动扫描                               ││
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                    ││
│  │  │  │ ✅ 批准   │ │ ❌ 忽略   │ │ 💬 讨论   │ │ 📍 定位   │                    ││
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘                    ││
│  │  └──────────────────────────────────────────────────────────────────────────┘│
│  │                                                                              ││
│  └──────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 3.5 UI 示意 — 添加任务对话框

```
┌─────────────────────────────────────────────┐
│  添加任务                              [×]  │
├─────────────────────────────────────────────┤
│                                             │
│  任务标题                                    │
│  ┌─────────────────────────────────────────┐│
│  │ 实现多模型支持                           ││
│  └─────────────────────────────────────────┘│
│                                             │
│  描述 (可选)                                 │
│  ┌─────────────────────────────────────────┐│
│  │ 支持 OpenAI、Gemini 等多种 AI 模型      ││
│  │                                         ││
│  └─────────────────────────────────────────┘│
│                                             │
│  状态          优先级                        │
│  ┌──────────┐  ┌──────────┐                │
│  │ 📥 待开发 ▾│  │ 🔵 中   ▾│                │
│  └──────────┘  └──────────┘                │
│                                             │
│  预估工期 (可选)                              │
│  ┌─────────────────────────────────────────┐│
│  │ 5天                                     ││
│  └─────────────────────────────────────────┘│
│                                             │
│         [取消]              [创建任务]       │
└─────────────────────────────────────────────┘
```

### 3.6 UI 示意 — 审查队列筛选展开

```
┌──────────────────────────────────────────────────────────────────────┐
│  筛选: [全部 ▾] [严重性 ▾] [类型 ▾]                                  │
│  ════════════════════════════════════════════════════════════════════ │
│                                                                      │
│  严重性:    ○ 全部  ◉ HIGH  ◉ MED  ○ LOW                            │
│  类型:      ○ 全部  ◉ Bug  ◉ 性能  ○ 安全  ○ 重构  ○ 风格          │
│  来源:      ◉ 全部  ○ 后台扫描  ○ Commit 后  ○ 手动                  │
│  状态:      ◉ 待审批  ○ 已批准  ○ 已忽略  ○ 讨论中                   │
│                                                                      │
│  [重置筛选]                                          [应用]          │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.7 UI 示意 — 审查项展开详情

```
┌──────────────────────────────────────────────────────────────────────┐
│  🔴 HIGH  未处理的 API 密钥异常可能导致进程崩溃                       │
│  ════════════════════════════════════════════════════════════════════ │
│                                                                      │
│  📍 位置                                                             │
│  src/analyzer/aiProvider.ts:87                                       │
│                                                                      │
│  📝 问题描述                                                         │
│  在 AIProvider.callAI() 方法中，API 密钥无效或服务不可用时，          │
│  异常未被捕获，会导致整个 worker 进程崩溃。                           │
│                                                                      │
│  💡 AI 修复建议                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │ // 当前代码 (第 87 行)                                           ││
│  │ const response = await client.messages.create({                  ││
│  │   model: this.model,                                            ││
│  │   max_tokens: 16384,                                            ││
│  │   messages: [{ role: 'user', content: prompt }]                 ││
│  │ });                                                             ││
│  │                                                                  ││
│  │ // 建议修改                                                      ││
│  │ try {                                                           ││
│  │   const response = await client.messages.create({...});          ││
│  │ } catch (error) {                                               ││
│  │   logger.error('SDK call failed, falling back to CLI', error);  ││
│  │   return await this.callViaCLI(prompt);  // 降级到 CLI 模式     ││
│  │ }                                                               ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  📅 发现时间: 2026-05-10 22:30                                       │
│  📡 来源: 后台自动扫描 (post-commit)                                 │
│                                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │ ✅ 批准   │ │ ❌ 忽略   │ │ 💬 讨论   │ │ 📍 定位   │               │
│  │ AI 修复   │ │ 不再显示  │ │ 打开对话  │ │ 查看代码  │               │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Workspace 模式

### 4.1 面板系统

Workspace 由三个独立面板组成，每个面板可开关：

| 面板 | 内容 | 默认状态 |
|------|------|---------|
| **Doc Panel** | 知识库文档浏览 | 关闭 |
| **Code Panel** | 项目源码浏览 | 关闭 |
| **Chat Panel** | 开发对话 | 打开 |

### 4.2 布局自适应规则

```
打开的面板数    布局方式        各面板宽度
─────────────────────────────────────────
    1          单栏全屏        100%
    2          双栏等分        50% | 50%
    3          三栏等分        33% | 33% | 34%

用户可通过拖拽分隔线自定义宽度，双击分隔线恢复均分。
```

### 4.3 Doc ↔ Code 关联机制

#### 文档中的代码引用格式

```markdown
<!-- 格式1: 指定文件 + 行号范围 -->
[source:src/analyzer/pipeline.ts:42-58]

<!-- 格式2: 指定文件 -->
[source:src/analyzer/pipeline.ts]

<!-- 格式3: 带显示文本 -->
Pipeline 类 ([source:src/analyzer/pipeline.ts:42])
```

#### 点击行为

```
用户点击文档中的 [source:...] 链接
        │
        ├─ Code 面板关闭 → 自动打开 Code 面板 → 定位到文件+行号
        ├─ Code 面板打开 → 直接定位到文件+行号
        └─ 目标行高亮 3 秒后渐隐
```

#### 反向关联

```
代码面板底部显示关联文档链接：
  📎 关联文档: 03-modules.md > 分析引擎
  点击 → 切换到 Doc 面板，定位到对应章节
```

### 4.4 UI 示意 — Workspace 三面板

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  ◂ Claude-DevSprite         [📊 Dashboard]  [💻 Workspace]                    🔍        │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────────────────────────┐  │
│  │  [📄 Doc ▾]  [📁 Code ▾]  [💬 Chat]          [═ 均分]  [📌 固定侧栏]  [⚙ 布局]  │  │
│  └────────────────────────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────┬───────────────────────┬──────────────────────┬──────────────────────┐  │
│  │  文件树       │  📄 Doc        [×]   │  📁 Code       [×]  │  💬 Chat       [×]  │  │
│  │  ──────────── │  ─────────────────── │  ─────────────────── │  ─────────────────── │  │
│  │  [知识库][源码]│  01-overview.md      │  pipeline.ts         │  Session: Feature    │  │
│  │  ──────────── │  Category: overview  │  Language: TS        │                      │  │
│  │  ▸ 知识库     │  Updated: May 11     │  Lines: 42-58 / 156 │  👤 根据文档重构     │  │
│  │    proj-over  │  ─────────────────── │  ─────────────────── │     pipeline         │  │
│  │    ├ 01-ov  ←│─ # 项目概览          │  L42│export class    │                      │  │
│  │    ├ 02-ar   │                      │  L43│ Analysis {     │  🤖 好的，参考       │  │
│  │    ├ 03-mo   │  Claude-DevSprite 是  │  L44│  private diff │     文档中的架构说明：│  │
│  │    └ 04-te   │  一个 Claude Code    │  L45│  private ctx  │                      │  │
│  │  ▸ changelog │  Skill 插件...       │  L46│              │  AnalysisPipeline 是 │  │
│  │              │                      │  L47│  async exec()│  核心编排类，负责...  │  │
│  │  ──────────── │  ## 核心价值         │  L48│    const d = │                      │  │
│  │  ▸ 源码      │                      │  L49│    await ... │  我来进行重构：       │  │
│  │    ▸ src/    │  核心模块位于         │  L50│              │  1. 先读取现有代码    │  │
│  │      analyzer│  [source:src/analyz  │  L51│ }            │  2. 对照文档分析      │  │
│  │      ├ aiP → │─ er/pipeline.ts:42] │     ↑ 高亮行       │  3. 执行重构          │  │
│  │      ├ diff  │  (Pipeline 类)       │  ─────────────────── │                      │  │
│  │      └ pipe  │                      │  📎 关联: 03-modules │  ┌──────────────────┐│  │
│  │    ▸ knowledge│  ...                │  > 分析引擎          │  │ Message...     📎││  │
│  │    ▸ worker/ │                      │                      │  └──────────────────┘│  │
│  │              │                      │                      │                      │  │
│  └──────────────┴───────────────────────┴──────────────────────┴──────────────────────┘  │
│  Status: 7 docs | 342 files | Last analysis: 2h ago | WebSocket: Connected              │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.5 UI 示意 — Workspace 双面板 (Doc + Chat)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  ◂ Claude-DevSprite       [📊 Dashboard]  [💻 Workspace]            🔍        │
├────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  [📄 Doc ▾]  [📁 Code]  [💬 Chat]              [═ 均分]  [⚙ 布局]     │  │
│  │                   ↑ 未激活(点击打开)                                      │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────┬─────────────────────────────────┬──────────────────────────┐  │
│  │  文件树       │  📄 Doc                  [×]   │  💬 Chat          [×]   │  │
│  │  ──────────── │  ──────────────────────────── │  ─────────────────────── │  │
│  │  [知识库][源码]│  01-overview.md                │  Session: Feature        │  │
│  │  ──────────── │  Category: overview            │                          │  │
│  │  ▸ 知识库     │  Updated: May 11               │  👤 帮我分析架构         │  │
│  │    proj-over  │  ──────────────────────────── │                          │  │
│  │    ├ 01-ov  ←│─ # 项目概览                    │  🤖 好的，这个项目       │  │
│  │    ├ 02-ar   │                                │     主要由以下模块组成：  │  │
│  │    ├ 03-mo   │  Claude-DevSprite 是一个       │     1. 分析引擎           │  │
│  │    └ 04-te   │  Claude Code Skill 插件...     │     2. 知识库管理         │  │
│  │  ▸ changelog │                                │     3. Web Dashboard      │  │
│  │              │  ## 核心价值                   │                          │  │
│  │  ──────────── │  ...                          │  [source:src/analyzer/   │  │
│  │  ▸ 源码      │                                │   pipeline.ts:42]        │  │
│  │    ▸ src/    │  核心模块位于                   │   ↑ 点击将打开 Code 面板 │  │
│  │    ▸ test/   │  [source:src/analyzer/         │                          │  │
│  │              │   pipeline.ts:42] (Pipeline)   │  ┌──────────────────────┐│  │
│  │              │                                │  │ Message...         📎││  │
│  │              │  点击上面的链接会自动打开        │  └──────────────────────┘│  │
│  │              │  Code 面板并定位到代码          │                          │  │
│  │              │                                │                          │  │
│  └──────────────┴─────────────────────────────────┴──────────────────────────┘  │
│  Status: 7 docs | 342 files | WebSocket: Connected                              │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 4.6 UI 示意 — Workspace 双面板 (Code + Chat)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  ◂ Claude-DevSprite       [📊 Dashboard]  [💻 Workspace]            🔍        │
├────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  [📄 Doc]  [📁 Code ▾]  [💬 Chat]              [═ 均分]  [⚙ 布局]     │  │
│  │          ↑ 未激活                                                          │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────┬─────────────────────────────────┬──────────────────────────┐  │
│  │  文件树       │  📁 Code                  [×]  │  💬 Chat          [×]   │  │
│  │  ──────────── │  ──────────────────────────── │  ─────────────────────── │  │
│  │  [知识库][源码]│  src/analyzer/pipeline.ts      │  Session: Refactor       │  │
│  │  ──────────── │  Language: TypeScript          │                          │  │
│  │  ▸ 源码      │  Lines: 156                    │  👤 重构 aiProvider      │  │
│  │    ▸ worker/ │  ──────────────────────────── │     支持多模型切换        │  │
│  │    ▸ knowledge│                                │                          │  │
│  │    ▸ analyzer│  L41│                          │  🤖 好的，我来分析       │  │
│  │      aiProv  │  L42│export class Analysis {   │     当前的实现：         │  │
│  │      diffCo  │  L43│  private collector       │                          │  │
│  │      pipe  ← │  L44│  private builder         │  AIProvider 目前支持     │  │
│  │      prompt  │  L45│                          │  SDK 和 CLI 两种模式     │  │
│  │    ▸ utils/  │  L46│  async execute(          │  我建议...               │  │
│  │    ▸ services│  L47│    hash: string           │                          │  │
│  │              │  L48│  ) {                      │  ┌──────────────────────┐│  │
│  │              │  L49│    const diff =           │  │ Message...         📎││  │
│  │              │  L50│      await this...        │  └──────────────────────┘│  │
│  │              │  L51│  }                        │                          │  │
│  │              │  ──────────────────────────── │                          │  │
│  │              │  📎 关联文档: 03-modules.md     │                          │  │
│  │              │     > 分析引擎                  │                          │  │
│  │              │                                │                          │  │
│  └──────────────┴─────────────────────────────────┴──────────────────────────┘  │
│  Status: 7 docs | 342 files | WebSocket: Connected                              │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 4.7 UI 示意 — Workspace 单面板 (仅 Chat)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  ◂ Claude-DevSprite       [📊 Dashboard]  [💻 Workspace]            🔍        │
├────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  [📄 Doc]  [📁 Code]  [💬 Chat ▾]              [═ 均分]  [⚙ 布局]     │  │
│  │          ↑         ↑                                                       │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────────────┐│
│  │  💬 Chat                                                      [×]        ││
│  │  ──────────────────────────────────────────────────────────────────────── ││
│  │  Session: Feature Development                                              ││
│  │                                                                            ││
│  │  👤 帮我分析一下 Claude-DevSprite 的整体架构，然后给出重构建议             ││
│  │                                                                            ││
│  │  🤖 好的，让我先查看项目的知识库文档...                                    ││
│  │                                                                            ││
│  │     根据项目文档，Claude-DevSprite 主要由以下模块组成：                     ││
│  │                                                                            ││
│  │     ## 1. 分析引擎 (src/analyzer/)                                         ││
│  │     - aiProvider.ts: AI 模型调用（SDK/CLI 双模式）                          ││
│  │     - pipeline.ts: 分析流程编排                                             ││
│  │     - diffCollector.ts: Git diff 收集                                       ││
│  │                                                                            ││
│  │     ## 2. 知识库管理 (src/knowledge/)                                       ││
│  │     - storageManager.ts: 文件存储                                           ││
│  │     - relationEngine.ts: 文档关系图                                         ││
│  │                                                                            ││
│  │     ## 3. Web 服务 (src/worker/)                                            ││
│  │     - server.ts: Express 服务                                               ││
│  │     - routes/: REST API                                                     ││
│  │                                                                            ││
│  │     我建议从以下几个方面进行重构...                                          ││
│  │                                                                            ││
│  │  ┌──────────────────────────────────────────────────────────────────────┐  ││
│  │  │ 📎 上下文: 01-overview.md, pipeline.ts                   [清除附件]  │  ││
│  │  ├──────────────────────────────────────────────────────────────────────┤  ││
│  │  │ Type a message...                                          [📎] [➤] │  ││
│  │  └──────────────────────────────────────────────────────────────────────┘  ││
│  └────────────────────────────────────────────────────────────────────────────┘│
│  Status: 7 docs | 342 files | WebSocket: Connected                              │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 4.8 UI 示意 — Doc→Code 跳转动画

```
步骤1: 用户在文档中看到代码引用
┌─────────────────────────────────────────────┐
│  ## 分析引擎                                │
│                                             │
│  核心编排逻辑位于                            │
│  [source:src/analyzer/pipeline.ts:42-58]    │
│  (Pipeline 类)                              │
│        ↑ 蓝色可点击链接                      │
└─────────────────────────────────────────────┘
                    │
                    │ 用户点击
                    ▼
步骤2: Code 面板自动打开，定位到目标行
┌──────────────────────┬──────────────────────┐
│  📄 Doc         [×]  │  📁 Code        [×]  │
│                      │                      │
│  (文档内容不变)       │  pipeline.ts         │
│                      │                      │
│                      │  L40│                │
│                      │  L41│                │
│                      │  L42│export class ←──┤ 高亮行 (黄色背景)
│                      │  L43│ Analysis {  ←──┤ 高亮行
│                      │  L44│  private   ←──┤ 高亮行
│                      │  L45│  collector ←──┤ 高亮行
│                      │  ...             ←──┤ 高亮行
│                      │  L58│ }           ←──┤ 高亮行
│                      │     ↑ 自动滚动到这里  │
│                      │                      │
│                      │  (3秒后高亮渐隐)      │
└──────────────────────┴──────────────────────┘
```

### 4.9 UI 示意 — 拖拽调整宽度

```
┌──────────────────────────────────────────────────────────────────────┐
│  [📄 Doc ▾]  [📁 Code ▾]  [💬 Chat ▾]          [═ 均分]  [⚙ 布局]  │
├────────────────┬───────────────────────┬─────────────────────────────┤
│  📄 Doc        │  📁 Code              │  💬 Chat                    │
│  width: 25%    │  width: 45%           │  width: 30%                 │
│                │                       │                             │
│                │←── 拖拽分隔线 ──→│    │                             │
│                │                       │                             │
└────────────────┴───────────────────────┴─────────────────────────────┘

双击分隔线 → 恢复均分 (33% | 33% | 34%)
```

---

## 5. 数据模型

### 5.1 项目任务 (ProjectTask)

```typescript
interface ProjectTask {
  id: string                    // UUID
  projectId: string             // 关联项目 ID
  title: string                 // 任务标题
  description?: string          // 任务描述
  status: TaskStatus            // 任务状态
  priority: TaskPriority        // 优先级
  estimate?: string             // 预估工期
  assignee?: string             // 负责人
  createdAt: string             // 创建时间
  updatedAt: string             // 更新时间
  completedAt?: string          // 完成时间
}

type TaskStatus = 'backlog' | 'in_progress' | 'done' | 'archived'
type TaskPriority = 'high' | 'medium' | 'low'
```

### 5.2 AI 审查项 (ReviewItem)

```typescript
interface ReviewItem {
  id: string                    // UUID
  projectId: string             // 关联项目 ID
  type: ReviewType              // 问题类型
  severity: ReviewSeverity      // 严重性
  status: ReviewStatus          // 审批状态
  filePath: string              // 文件路径 (相对项目根目录)
  lineStart: number             // 起始行
  lineEnd?: number              // 结束行
  title: string                 // 问题标题 (简短)
  description: string           // 问题描述 (详细)
  suggestion: string            // AI 修复建议
  codeContext?: string          // 相关代码片段
  source: ReviewSource          // 发现来源
  commitHash?: string           // 关联 commit
  createdAt: string             // 发现时间
  resolvedAt?: string           // 解决时间
  resolvedBy?: string           // 解决方式 (approved/ignored)
}

type ReviewType = 'bug' | 'performance' | 'security' | 'refactor' | 'style'
type ReviewSeverity = 'high' | 'medium' | 'low'
type ReviewStatus = 'pending' | 'approved' | 'ignored' | 'discussing'
type ReviewSource = 'auto_scan' | 'post_commit' | 'manual'
```

### 5.3 面板状态 (PanelState)

```typescript
interface WorkspaceState {
  panels: {
    doc: { open: boolean; filePath?: string; scrollY?: number }
    code: { open: boolean; filePath?: string; line?: number }
    chat: { open: boolean; sessionId?: string }
  }
  sidebar: {
    open: boolean
    activeTab: 'knowledge' | 'source'
  }
  layout: {
    widths: [number, number, number]  // 百分比
  }
}
```

---

## 6. API 设计

### 6.1 任务管理 API

```
GET    /api/projects/:name/tasks              → 获取任务列表
POST   /api/projects/:name/tasks              → 创建任务
PATCH  /api/projects/:name/tasks/:taskId      → 更新任务 (状态/内容)
DELETE /api/projects/:name/tasks/:taskId      → 删除任务
```

### 6.2 审查队列 API

```
GET    /api/projects/:name/reviews            → 获取审查列表 (支持筛选)
POST   /api/projects/:name/reviews            → 创建审查项 (AI 调用)
PATCH  /api/projects/:name/reviews/:reviewId  → 更新审查状态
POST   /api/projects/:name/reviews/:reviewId/approve  → 批准并触发 AI 修复
POST   /api/projects/:name/reviews/:reviewId/discuss   → 打开讨论 (关联 Chat)
```

### 6.3 源码文件树 API (新增)

```
GET    /api/projects/:name/source-tree        → 获取项目源码目录树
       Response: FileTreeNode[] (复用现有类型，排除 node_modules/.git/dist)
```

### 6.4 现有 API 复用

```
GET    /api/projects/:name/tree               → 知识库文件树 (已有)
GET    /api/projects/:name/file?path=...      → 知识库文档 (已有)
GET    /api/projects/:name/source?path=...    → 源码内容 (已有)
POST   /api/projects/:name/analyze/full       → 触发分析 (已有)
```

---

## 7. 实现分期

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
- [ ] URL query params 同步 (doc, code, line)

### Phase 5: AI 审查集成 (2-3天)

- [ ] 后台扫描任务调度器
- [ ] AI 代码审查 prompt 模板
- [ ] 审查结果解析 + 写入队列
- [ ] 批准操作 → AI 自动修复流程
- [ ] 讨论操作 → Chat 面板上下文注入

---

## 8. 文件清单

### 新增文件

```
web/src/views/ProjectView.vue              — 项目页面统一入口
web/src/views/DashboardView.vue            — Dashboard 模式
web/src/views/WorkspaceView.vue            — Workspace 模式
web/src/components/workspace/SplitPane.vue — 可拖拽分隔面板
web/src/components/workspace/DocPanel.vue  — 文档面板
web/src/components/workspace/CodePanel.vue — 代码面板
web/src/components/workspace/ChatPanel.vue — 对话面板 (精简版)
web/src/components/workspace/PanelToolbar.vue — 面板工具栏
web/src/components/dashboard/ProjectInfoBar.vue — 项目信息栏
web/src/components/dashboard/TaskList.vue  — 任务列表
web/src/components/dashboard/TaskCard.vue  — 任务卡片
web/src/components/dashboard/AddTaskDialog.vue — 添加任务对话框
web/src/components/dashboard/ReviewQueue.vue — 审查队列
web/src/components/dashboard/ReviewItem.vue — 审查项
web/src/components/dashboard/ReviewFilter.vue — 审查筛选
web/src/components/tree/SourceFileTree.vue — 源码文件树
web/src/stores/tasks.ts                    — 任务 store
web/src/stores/reviews.ts                  — 审查 store
web/src/stores/workspace.ts                — 工作台状态 store
web/src/api/tasks.ts                       — 任务 API
web/src/api/reviews.ts                     — 审查 API
web/src/api/sourceTree.ts                  — 源码文件树 API
src/worker/routes/tasks.ts                 — 任务 API 端点
src/worker/routes/reviews.ts               — 审查 API 端点
src/worker/routes/sourceTree.ts            — 源码文件树 API 端点
src/worker/db/migrations/002_tasks_reviews.sql — 数据库迁移
```

### 修改文件

```
web/src/router/index.ts                    — 更新路由配置
web/src/views/ProjectLayout.vue            — 适配新子路由
web/src/components/layout/AppHeader.vue    — 移除项目页内的 header (由 ProjectToolbar 替代)
```

### 删除/废弃文件

```
web/src/views/ProjectOverview.vue          — 被 DashboardView 替代
web/src/views/SourceView.vue               — 功能并入 CodePanel
web/src/views/DevChatView.vue              — 保留，ChatPanel 从中提取精简版
```
