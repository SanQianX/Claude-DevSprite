---
title: 变更记录 - 为仪表盘任务列表添加缺失的编辑与删除按钮
category: changelog
createdAt: '2026-05-14T07:33:02.089Z'
updatedAt: '2026-05-14T07:33:02.089Z'
relations:
  - changelog/2025-01-ui-fix.md
  - project-overview/03-modules.md
---

# 变更记录 - 为仪表盘任务列表添加缺失的编辑与删除按钮

## 提交信息

- **提交类型**: `fix` - 修复
- **提交消息**: `fix(auto): task-edit-delete-ui-missing-fix_2026-05-14`
- **修复日期**: 2026-05-14

## 变更内容

### 1. web/src/views/DashboardView.vue

**变更类型**: 修改

**变更详情**:

在仪表盘视图的任务列表组件中，修复了任务操作按钮缺失的问题。具体变更如下：

1.  **添加操作按钮组**: 在任务列表项 (`v-for="task in tasks"`) 内，为每个任务添加了新的 `div` 容器，其中包含两个操作按钮。
2.  **按钮条件显示**: 操作按钮组通过 `v-if="!task.severity"` 条件进行渲染，这意味着只有当任务没有 `severity` 属性（即非审查项关联的任务）时，才会显示编辑和删除按钮。
3.  **编辑按钮**: 标题为“编辑”，图标为“✏️”。点击后触发 `openEditTask(task)` 函数，并通过 `.stop` 修饰符阻止事件冒泡。
4.  **删除按钮**: 标题为“删除”，图标为“🗑️”。点击后触发 `handleDeleteTask(task.id)` 函数，并通过 `.stop` 修饰符阻止事件冒泡。该按钮使用了 `task-action-delete` 类名，可能用于样式区分。
5.  **样式类**: 按钮容器使用 `task-actions` 类，每个按钮使用 `task-action-btn` 类。

**新增行数**: 64， **删除行数**: 0

**影响范围**: Web Dashboard 用户界面。此修复直接解决了用户无法通过界面对任务进行编辑和删除操作的交互缺失问题。

**源码文件**: [DashboardView.vue](/project/Claude-DevSprite/source?path=web/src/views/DashboardView.vue)

## 修复的问题列表

1.  **任务操作按钮缺失**: 在仪表盘的任务列表中，用户无法看到或点击编辑、删除任务的按钮，导致任务管理功能不完整。
2.  **UI交互不一致**: 审查项（`review`）通常具有操作按钮（批准、修复等），而由任务生成的独立任务项却缺少相应的管理入口，降低了操作便利性。

## 根本原因

根本原因是 **DashboardView.vue 模板中任务列表项的交互元素未完全实现**。在之前的迭代中，可能优先实现了审查项的操作按钮，而为任务（task）预留的编辑、删除功能在模板层面被遗漏，导致这些功能在 UI 上不可用。

## 修复方案

修复方案是直接在 Vue 模板中为任务项添加缺失的交互按钮：

1.  **条件渲染**: 根据任务是否有 `severity` 属性来区分审查项和独立任务，确保操作按钮只出现在合适的项目上。
2.  **事件绑定**: 将按钮的点击事件正确绑定到已存在的（或后续需实现的）`openEditTask` 和 `handleDeleteTask` 函数。
3.  **事件隔离**: 使用 `@click.stop` 确保点击按钮不会触发任务项上可能存在的其他父级事件（如点击跳转）。

## 影响评估

- **功能恢复**: 仪表盘的任务管理功能得到完善，用户现在可以直观地对任务进行编辑和删除操作。
- **用户体验提升**: 提供了与审查项操作类似的交互模式，使界面行为更加一致和可预测。
- **代码结构**: 变更仅限于模板层，未涉及逻辑层的改动，风险较低。前提是 `openEditTask` 和 `handleDeleteTask` 函数已在脚本中正确实现。

## 关联文档与源码

- **项目知识库**: 本次修复涉及 Web Dashboard 的核心视图。相关组件的功能描述请参阅：
    - [模块分析 - DashboardView.vue](/project/Claude-DevSprite/source?path=knowledge/project-overview/03-modules.md#7-web-前端-web)
- **先前修复**: 本次变更可视为对早期 UI 功能修复（如 `changelog/2025-01-ui-fix.md` 中提及的按钮修复）在任务管理场景下的补充和完善。
