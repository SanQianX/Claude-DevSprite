# UI Bug 排查计划

## 项目规模

| 类型 | 数量 |
|------|------|
| Views (页面) | 13 |
| Components (组件) | 35 |
| **总计** | **48** |

## 排查流程 (每个组件)

```
1. UI 控件分析 → 识别所有交互元素
2. 代码审查 → 检查数据绑定、事件处理、边界情况
3. 功能测试 → 模拟用户操作验证行为
4. Bug 记录 → 发现问题立即记录
5. 修复验证 → 修复后重新测试
6. 文档更新 → 写入 bugfix 文件夹
```

## 组件分组 (按页面)

### 🏠 Group 1: 首页 (HomePage)
| 组件 | 优先级 | 状态 |
|------|--------|------|
| HomePage.vue | P0 | ✅ 已测 |
| TokensBar.vue | P0 | ✅ 已修 |
| TokenDetailModal.vue | P0 | ✅ 已修 |
| ProjectCard.vue | P1 | ⏳ 待测 |
| ProjectList.vue | P1 | ⏳ 待测 |
| AddProjectModal.vue | P1 | ⏳ 待测 |
| HomeSidebar.vue | P2 | ⏳ 待测 |
| ConsolePanel.vue | P2 | ⏳ 待测 |
| LogOutput.vue | P2 | ⏳ 待测 |
| LogFilters.vue | P2 | ⏳ 待测 |

### 📁 Group 2: 项目页 (Project)
| 组件 | 优先级 | 状态 |
|------|--------|------|
| ProjectView.vue | P0 | ✅ 已测 |
| ProjectLayout.vue | P0 | ✅ 已测 |
| ProjectOverview.vue | P1 | ⏳ 待测 |
| DashboardView.vue | P1 | ⏳ 待测 |

### 💬 Group 3: 开发聊天 (DevChat)
| 组件 | 优先级 | 状态 |
|------|--------|------|
| DevChatView.vue | P0 | ⏳ 待测 |
| ChatMessage.vue | P1 | ⏳ 待测 |
| ChatMessageList.vue | P1 | ⏳ 待测 |
| ChatInput.vue | P1 | ⏳ 待测 |
| ToolCard.vue | P2 | ⏳ 待测 |
| TeamStatusPanel.vue | P2 | ⏳ 待测 |

### 📝 Group 4: 文档查看 (Document)
| 组件 | 优先级 | 状态 |
|------|--------|------|
| DocumentView.vue | P0 | ✅ 已测 |
| MarkdownViewer.vue | P1 | ⏳ 待测 |
| AppTocPanel.vue | P2 | ⏳ 待测 |

### 🔧 Group 5: 工作区 (Workspace)
| 组件 | 优先级 | 状态 |
|------|--------|------|
| WorkspaceView.vue | P0 | ✅ 已修 |
| ChatPanel.vue | P1 | ⏳ 待测 |
| CodePanel.vue | P1 | ⏳ 待测 |
| DocPanel.vue | P1 | ✅ 已修 |
| SplitPane.vue | P2 | ⏳ 待测 |
| FileTreeSidebar.vue | P2 | ⏳ 待测 |

### 🔍 Group 6: 搜索 (Search)
| 组件 | 优先级 | 状态 |
|------|--------|------|
| SearchResults.vue | P1 | ⏳ 待测 |
| SearchBar.vue | P1 | ⏳ 待测 |

### ⚙️ Group 7: 设置 (Settings)
| 组件 | 优先级 | 状态 |
|------|--------|------|
| SettingsView.vue | P1 | ⏳ 待测 |

### 🎨 Group 8: 通用组件 (Common)
| 组件 | 优先级 | 状态 |
|------|--------|------|
| Breadcrumb.vue | P2 | ⏳ 待测 |
| EmptyState.vue | P2 | ⏳ 待测 |
| LoadingSpinner.vue | P2 | ⏳ 待测 |
| FolderBrowser.vue | P2 | ⏳ 待测 |

### 📂 Group 9: 布局 (Layout)
| 组件 | 优先级 | 状态 |
|------|--------|------|
| AppHeader.vue | P0 | ⏳ 待测 |
| AppSidebar.vue | P1 | ⏳ 待测 |

### 🌲 Group 10: 文件树 (Tree)
| 组件 | 优先级 | 状态 |
|------|--------|------|
| FileTree.vue | P2 | ⏳ 待测 |
| FileTreeNode.vue | P2 | ⏳ 待测 |

### 👥 Group 11: 会话管理 (Session)
| 组件 | 优先级 | 状态 |
|------|--------|------|
| SessionSidebar.vue | P2 | ⏳ 待测 |
| NewSessionDialog.vue | P2 | ⏳ 待测 |

### 📺 Group 12: 查看器 (Viewer)
| 组件 | 优先级 | 状态 |
|------|--------|------|
| SourceViewer.vue | P2 | ⏳ 待测 |

## 优先级说明

| 优先级 | 说明 | 组件数 |
|--------|------|--------|
| P0 | 核心功能，用户频繁使用 | 8 |
| P1 | 重要功能，影响用户体验 | 16 |
| P2 | 辅助功能，低频使用 | 24 |

## 已发现问题

### 已修复
1. ✅ TokensBar Mock 数据 → 集成 ccusage
2. ✅ WorkspaceView 面板切换崩溃 → reactive→ref + URL 参数
3. ✅ DocPanel marked v12 API → 导入修复

### 待排查
（暂无）

## 执行计划

### Phase 1: P0 组件 (核心功能)
预计时间: 2-3 小时
- HomePage 相关
- ProjectView 相关
- WorkspaceView 相关
- DevChatView
- AppHeader

### Phase 2: P1 组件 (重要功能)
预计时间: 3-4 小时
- Chat 组件
- Document 组件
- Search 组件
- Settings 组件

### Phase 3: P2 组件 (辅助功能)
预计时间: 2-3 小时
- Common 组件
- Tree 组件
- Session 组件
- Viewer 组件

## 测试方法

### 1. 代码审查检查清单
- [ ] 数据绑定是否正确
- [ ] 事件处理是否完整
- [ ] 错误处理是否覆盖
- [ ] 边界情况是否考虑
- [ ] 内存泄漏风险

### 2. 功能测试检查清单
- [ ] 组件正常渲染
- [ ] 交互响应正确
- [ ] 数据加载正常
- [ ] 错误状态处理
- [ ] 响应式布局

### 3. Bug 记录格式
```markdown
### [Bug Title]
- **组件**: ComponentName.vue
- **描述**: 问题描述
- **复现步骤**: 1. 2. 3.
- **预期行为**: 应该...
- **实际行为**: 实际...
- **严重程度**: Critical/Major/Minor
- **修复方案**: ...
```


## Design Checker Module

This module (DesignChecker) performs background scanning to ensure design-code consistency. Refer to DESIGN-CHECKER-MODULE.md for details.
