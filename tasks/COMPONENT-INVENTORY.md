# UI 控件完整清单

## 总体统计

| 类别 | 数量 |
|------|------|
| Vue 组件文件 | 48 |
| 事件绑定 (@click, @input 等) | 173 |
| 交互元素 (button, input 等) | 109 |
| 指令 (v-if, v-for 等) | 101 |
| API 调用 | 189 |
| 响应式状态 (ref, reactive, computed) | 150 |
| **总控件数** | **722+** |

---

## 按组件详细清单

### 🔴 高复杂度 (30+ 控件)

#### 1. SettingsView.vue (62 控件)
| 类型 | 数量 | 控件 |
|------|------|------|
| 事件 | 11 | AI模型切换、Agent Teams、Skills、System 配置 |
| 元素 | 23 | Tab按钮、输入框、开关、下拉框 |
| 指令 | 28 | v-if条件、v-for列表、v-model绑定 |
| **预估Bug风险**: ⭐⭐⭐⭐⭐ |

#### 2. DashboardView.vue (33 控件)
| 类型 | 数量 | 控件 |
|------|------|------|
| 事件 | 11 | 项目操作、状态切换 |
| 元素 | 10 | 卡片、按钮、状态指示器 |
| 指令 | 12 | 条件渲染、列表 |
| **预估Bug风险**: ⭐⭐⭐⭐ |

#### 3. ChatPanel.vue (26 控件)
| 类型 | 数量 | 控件 |
|------|------|------|
| 事件 | 5 | 发送消息、文件上传 |
| 元素 | 5 | 输入框、按钮 |
| 指令 | 13 | 消息列表、状态显示 |
| **预估Bug风险**: ⭐⭐⭐⭐ |

---

### 🟠 中复杂度 (10-29 控件)

#### 4. WorkspaceView.vue (18 控件)
- 事件: 5 (面板切换、URL同步)
- 元素: 5 (Tab按钮)
- 指令: 8 (条件渲染)
- **已修复**: 面板切换崩溃

#### 5. FolderBrowser.vue (14 控件)
- 事件: 5 (目录导航、选择)
- 元素: 5 (树节点、按钮)
- 指令: 6 (展开/折叠)

#### 6. NewSessionDialog.vue (13 控件)
- 事件: 5 (创建、取消)
- 元素: 5 (输入框、按钮)
- 指令: 3 (表单验证)

#### 7. AddProjectModal.vue (13 控件)
- 事件: 5 (添加、浏览)
- 元素: 4 (输入框、按钮)
- 指令: 4 (路径验证)

#### 8. TokenDetailModal.vue (13 控件) ✅
- 事件: 4 (切换周期、刷新)
- 元素: 3 (Tab按钮)
- 指令: 6 (表格渲染)
- **已修复**: Mock数据问题

#### 9. CodePanel.vue (13 控件)
- 事件: 3 (文件选择、导航)
- 元素: 2 (文件树)
- 指令: 8 (代码高亮、行号)

#### 10. ConsolePanel.vue (12 控件)
- 事件: 4 (清除、过滤、滚动)
- 元素: 3 (按钮、过滤器)
- 指令: 5 (日志级别)

#### 11. LogsView.vue (12 控件)
- 事件: 3 (刷新、过滤)
- 元素: 4 (日志列表)
- 指令: 5 (分页)

#### 12. HomePage.vue (11 控件)
- 事件: 4 (导航、搜索)
- 元素: 4 (项目列表)
- 指令: 3 (条件显示)

#### 13. SessionSidebar.vue (11 控件)
- 事件: 4 (创建、删除、切换)
- 元素: 3 (会话列表)
- 指令: 4 (活跃状态)

#### 14. ProjectCard.vue (10 控件)
- 事件: 7 (导航、操作菜单)
- 元素: 2 (卡片、下拉菜单)
- 指令: 1 (条件显示)

#### 15. TokensBar.vue (10 控件) ✅
- 事件: 3 (切换周期、刷新、详情)
- 元素: 3 (按钮组)
- 指令: 4 (图表渲染)
- **已修复**: Mock数据 + 预加载

---

### 🟡 低复杂度 (5-9 控件)

| # | 组件 | 控件数 | 主要功能 |
|---|------|--------|----------|
| 16 | ProjectView.vue | 9 | Tab切换、路由 |
| 17 | DocPanel.vue | 8 | 文档渲染、Markdown |
| 18 | AppHeader.vue | 7 | 导航、搜索、设置 |
| 19 | SearchResults.vue | 7 | 搜索结果、高亮 |
| 20 | FileTreeSidebar.vue | 6 | 文件树导航 |
| 21 | SearchBar.vue | 6 | 搜索输入、自动完成 |
| 22 | ToolCard.vue | 6 | 工具调用显示 |
| 23 | ChatInput.vue | 5 | 消息输入、发送 |
| 24 | AppTocPanel.vue | 5 | 目录导航 |
| 25 | ChatMessageList.vue | 5 | 消息列表滚动 |

---

### 🟢 简单组件 (1-4 控件)

| # | 组件 | 控件数 | 主要功能 |
|---|------|--------|----------|
| 26 | FileTreeNode.vue (workspace) | 4 | 递归节点 |
| 27 | FileTreeNode.vue (tree) | 4 | 递归节点 |
| 28 | ProjectLayout.vue | 4 | 布局容器 |
| 29 | SourceView.vue | 3 | 源码显示 |
| 30 | DocumentView.vue | 3 | 文档显示 |
| 31 | TeamStatusPanel.vue | 3 | 团队状态 |
| 32 | AppSidebar.vue | 3 | 侧边栏导航 |
| 33 | LogFilters.vue | 3 | 日志过滤器 |
| 34 | LogOutput.vue | 3 | 日志输出 |
| 35 | Breadcrumb.vue | 3 | 面包屑导航 |
| 36 | MarkdownViewer.vue | 2 | Markdown渲染 |
| 37 | SourceViewer.vue | 2 | 代码高亮 |
| 38 | FileTree.vue | 2 | 文件树容器 |
| 39 | SplitPane.vue | 2 | 分割面板 |
| 40 | EmptyState.vue | 1 | 空状态显示 |
| 41 | LoadingSpinner.vue | 1 | 加载动画 |
| 42 | ChatMessage.vue | 1 | 单条消息 |
| 43 | Home.vue | 0 | 路由占位 |
| 44 | DevChatView.vue | 0 | 路由占位 |

---

## 排查优先级排序

### P0 - 必须排查 (高复杂度 + 核心功能)
| 优先级 | 组件 | 控件数 | 原因 |
|--------|------|--------|------|
| 1 | SettingsView.vue | 62 | 最复杂，配置核心 |
| 2 | DashboardView.vue | 33 | 首页仪表盘 |
| 3 | ChatPanel.vue | 26 | 聊天核心功能 |
| 4 | WorkspaceView.vue | 18 | 工作区核心 |
| 5 | FolderBrowser.vue | 14 | 文件选择关键 |

### P1 - 重要排查 (中复杂度)
| 优先级 | 组件 | 控件数 |
|--------|------|--------|
| 6 | NewSessionDialog.vue | 13 |
| 7 | AddProjectModal.vue | 13 |
| 8 | CodePanel.vue | 13 |
| 9 | ConsolePanel.vue | 12 |
| 10 | LogsView.vue | 12 |
| 11 | HomePage.vue | 11 |
| 12 | SessionSidebar.vue | 11 |
| 13 | ProjectCard.vue | 10 |
| 14 | TokensBar.vue | 10 ✅ |
| 15 | ProjectView.vue | 9 |

### P2 - 常规排查 (低复杂度)
其余 29 个组件

---

## Bug 高发区域

基于复杂度分析，以下区域最容易出 Bug：

1. **表单交互**: SettingsView, NewSessionDialog, AddProjectModal
2. **列表渲染**: ChatPanel, SessionSidebar, LogOutput
3. **条件显示**: DashboardView, WorkspaceView, CodePanel
4. **异步加载**: FolderBrowser, FileTreeSidebar, SearchResults
5. **状态管理**: ChatMessageList, ConsolePanel, TokensBar ✅

---

## 排查工作量估算

| 阶段 | 组件数 | 控件数 | 预估时间 |
|------|--------|--------|----------|
| P0 核心 | 5 | 153 | 4-5 小时 |
| P1 重要 | 10 | 115 | 3-4 小时 |
| P2 常规 | 29 | 222 | 4-5 小时 |
| **总计** | **44** | **490** | **11-14 小时** |

*注: 不含已完成的 4 个组件*
