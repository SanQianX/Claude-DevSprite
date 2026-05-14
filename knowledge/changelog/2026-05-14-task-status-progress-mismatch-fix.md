---
title: 变更记录 - 修复仪表盘任务状态筛选字段不匹配
category: changelog
createdAt: '2026-05-14T07:40:49.637Z'
updatedAt: '2026-05-14T07:40:49.637Z'
relations:
  - changelog/2026-05-13.md
  - changelog/2026-05-14-task-progress-manual-refresh-fix.md
  - project-overview/03-modules.md
---

# 变更记录 - 修复仪表盘任务状态筛选字段不匹配

## 提交信息

- **提交类型**: `fix` - 修复
- **提交消息**: `fix(auto): task-status-progress-mismatch-fix_2026-05-14`
- **修复日期**: 2026-05-14

## 变更内容

### 1. web/src/views/DashboardView.vue

**变更类型**: 修改

**变更详情**:

在仪表盘视图中，修复了用于筛选“进行中”任务的状态字段值不匹配的问题。具体变更如下：

1.  **任务分组筛选器修正**: 在 `taskGroups` 响应式数组的定义中，将 `tasksInProgress` 分组的 `tasks` getter 函数内部，用于筛选进行中任务的条件从 `t.status === 'progress'` 修正为 `t.status === 'in_progress'`。这确保了该分组能够正确包含后端返回的、状态为 `'in_progress'` 的任务。
2.  **统计计算修正**: 在 `inProgressCount` 计算属性的定义中，同样将统计进行中任务数量的筛选条件从 `tasks.value.filter(t => t.status === 'progress')` 修正为 `tasks.value.filter(t => t.status === 'in_progress')`。这确保了统计摘要中“进行中”的任务数量计算准确。

**新增行数**: 3, **删除行数**: 3

**影响范围**: Web Dashboard 用户界面。此修复直接影响仪表盘中“进行中”任务分组的显示内容和对应的统计数字。

**源码文件**: [DashboardView.vue](/project/Claude-DevSprite/source?path=web/src/views/DashboardView.vue)

## 修复的问题列表

1.  **任务状态筛选不匹配**: 仪表盘在统计和分组“进行中”的任务时，使用了错误的数据库状态值 `'progress'`，而后端实际存储和返回的任务状态值为 `'in_progress'`。这导致相关的筛选器失效。
2.  **统计信息显示错误**: 由于使用了错误的状态值进行筛选，`inProgressCount` 计算属性无法正确统计进行中任务的数量，可能导致该统计数字显示为 0 或不准确。
3.  **任务分组内容错误**: `taskGroups` 中名为“进行中”的任务分组（`tasksInProgress`）的 `tasks` getter 由于使用了错误的筛选条件，无法获取到实际处于进行中状态的任务，导致该分组显示为空或不完整。

## 根本原因

根本原因是**前后端数据契约不一致**。后端 API 返回的任务（`task`）对象中，表示“进行中”的状态字段值为 `'in_progress'`，而前端 DashboardView.vue 组件在多个位置（统计计算、任务分组）硬编码地使用了错误的值 `'progress'` 进行筛选。这很可能是在早期开发中，前后端对状态枚举值的定义未完全同步，或者前端代码在重构中误用了旧值。

## 修复方案

修复方案是**直接对齐前后端数据契约**。在 `DashboardView.vue` 文件中，将所有用于筛选任务状态 `'progress'` 的代码点，统一更正为与后端一致的 `'in_progress'`。这涉及两个计算属性/函数的内部逻辑，是一个范围清晰、风险可控的修正。

## 影响评估

- **功能恢复**: “进行中”任务的统计和分组显示功能恢复正常。用户现在可以准确看到处于进行中状态的任务数量及其列表。
- **用户体验提升**: 修复了因数据展示错误可能导致的困惑，确保了仪表盘信息的准确性和可靠性。
- **代码质量**: 消除了硬编码的不一致值，使前端逻辑与后端数据保持一致，提升了代码的可维护性。

## 关联文档与源码

- **先前修复**: 本次修复是对 `DashboardView.vue` 组件持续改进的一部分。之前的相关修复包括统计计算修正、数据轮询机制引入等，可参考：
  - [changelog/2026-05-13.md](/project/Claude-DevSprite/source?path=knowledge/changelog/2026-05-13.md) (修复仪表盘统计显示与数据刷新)
  - [changelog/2026-05-14-task-progress-manual-refresh-fix.md](/project/Claude-DevSprite/source?path=knowledge/changelog/2026-05-14-task-progress-manual-refresh-fix.md) (添加数据自动轮询)
- **项目知识库**: 该组件的职责和功能在项目模块分析中有详细描述：
  - [模块分析 - DashboardView.vue](/project/Claude-DevSprite/source?path=knowledge/project-overview/03-modules.md#7-web-前端-web)
- **数据模型**: 任务状态（`status`）的有效值（如 `pending`, `in_progress`, `completed`）应在后端 API 定义和前端常量中保持一致。
