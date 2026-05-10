# AUTO_TODO — DevSprite 双模式项目工作台实现清单

> 自动生成于 2026-05-11 | 按 Phase 顺序逐一完成

## Phase 0 — 首页重新设计 (v1.1.1)

- [x] 0.1 移除 HomeSidebar 组件引用（HomePage.vue 不再包含左侧边栏）
- [x] 0.2 实现 TokensBar.vue 组件（轻量融合式横条：总量 + Input/Output/Cache 芯片 + 迷你柱状图 + 趋势 + 周期切换）
- [x] 0.3 实现后端 Tokens 统计 API（GET /api/tokens，返回总量/分项/7日趋势）
- [x] 0.4 实现前端 API 层 web/src/api/tokens.ts
- [x] 0.5 首页布局重构：Header → TokensBar → 项目列表表格 → Console（无侧边栏）
- [x] 0.6 项目表格精简列（移除 Docs 列，列宽与 mockup 对齐）
- [x] 0.7 AppHeader 搜索框 placeholder 改为通用搜索
- [ ] 0.8 Console 可折叠功能增强（折叠时仅显示 Header 行，保留展开按钮）
- [ ] 0.9 构建验证 + 回归测试

## Phase 1 — 项目工作台基础框架

- [ ] 1.1 创建 ProjectView.vue 容器组件（Dashboard/Workspace Tab 切换）
- [ ] 1.2 路由更新：/project/:name 使用 ProjectView 作为默认子路由
- [ ] 1.3 创建 WorkspaceView.vue 面板容器组件
- [ ] 1.4 创建 SplitPane.vue 可拖拽分隔组件
- [ ] 1.5 创建 ProjectToolbar.vue 工具栏（模式 Tab + 面板开关）
- [ ] 1.6 面板开关逻辑 + 布局自适应（最少保留 Chat）
- [ ] 1.7 构建验证 + 回归测试

## Phase 2 — Dashboard 模式

- [ ] 2.1 后端数据模型：tasks + reviews SQLite 表
- [ ] 2.2 后端 API：tasks CRUD + reviews CRUD 端点
- [ ] 2.3 前端 store：dashboard store（tasks + reviews 状态管理）
- [ ] 2.4 ProjectInfoBar.vue 项目信息栏（名称/路径/仓库类型/文档数/最后更新）
- [ ] 2.5 TaskList.vue + TaskCard.vue 任务列表组件（CRUD + 状态流转）
- [ ] 2.6 AddTaskDialog.vue 新建任务对话框
- [ ] 2.7 ReviewQueue.vue + ReviewItem.vue 审查队列（列表 + 筛选）
- [ ] 2.8 ReviewFilter.vue 筛选组件
- [ ] 2.9 构建验证 + 回归测试

## Phase 3 — Workspace 面板

- [ ] 3.1 DocPanel.vue 封装（复用 DocumentView）
- [ ] 3.2 CodePanel.vue 封装（复用 SourceViewer + 文件树浏览）
- [ ] 3.3 ChatPanel.vue 精简版（复用 DevChatView 核心组件）
- [ ] 3.4 FileTreeSidebar.vue 双 Tab（知识库/源码）
- [ ] 3.5 后端 source-tree API 端点（返回项目源码文件树）
- [ ] 3.6 面板拖拽调整大小
- [ ] 3.7 构建验证 + 回归测试

## Phase 4 — Doc↔Code 关联

- [ ] 4.1 文档中 [source:path:line] 链接解析
- [ ] 4.2 点击跳转 + 行高亮动画
- [ ] 4.3 Code 面板底部关联文档链接
- [ ] 4.4 URL query params 同步（doc/code/chat 路径同步到 URL）
- [ ] 4.5 构建验证 + 回归测试

## Phase 5 — AI 审查集成

- [ ] 5.1 后台扫描任务调度器（AI 自动扫描代码变更）
- [ ] 5.2 AI 代码审查 prompt 模板
- [ ] 5.3 审查结果解析 + 写入 reviews 队列
- [ ] 5.4 批准操作 → AI 自动修复流程
- [ ] 5.5 构建验证 + 回归测试

## Phase 6 — 开发记忆

- [ ] 6.1 DevMemoryContext 构建器（汇总会话/任务/审查信息）
- [ ] 6.2 会话摘要自动生成
- [ ] 6.3 记忆 API 端点
- [ ] 6.4 Chat 面板记忆横幅
- [ ] 6.5 构建验证 + 回归测试
