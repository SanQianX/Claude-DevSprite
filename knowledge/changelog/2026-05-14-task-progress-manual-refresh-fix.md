---
title: 变更记录 - 修复任务进度手动刷新问题
category: changelog
createdAt: '2026-05-14T11:28:56.178Z'
updatedAt: '2026-05-14T11:28:56.178Z'
relations:
  - knowledge/project-overview/03-modules.md
  - knowledge/project-overview/02-architecture.md
  - knowledge/changelog/2026-05-14-task-progress-manual-refresh-fix.md
---

# 变更记录

## 提交信息

- **提交类型**: `fix` - 修复
- **提交消息**: `fix(auto): task-progress-manual-refresh-fix_2026-05-14`
- **修复日期**: 2026-05-14

## 变更内容

### 1. web/src/views/DashboardView.vue

**变更类型**: 修改

**变更详情**:

在仪表盘视图中，新增了对扫描器状态和时间变化的监听，以解决任务进度需要手动刷新的问题。具体变更如下：

1.  **新增 `watch` 导入**: 在 `<script setup>` 中，从 `vue` 包中导入了 `watch` 函数，用于监听响应式数据的变化。
2.  **新增扫描状态监听器**:
    *   使用 `watch` 监听 `dashboardStore.scannerConfig.isScanning` 属性。
    *   当 `isScanning` 从 `true` 变为 `false`（即扫描完成）时，触发 `dashboardStore.fetchAll(props.projectName)` 调用，立即刷新仪表盘数据。
3.  **新增最后扫描时间监听器**:
    *   使用 `watch` 监听 `dashboardStore.scannerStatus.lastScanTime` 属性。
    *   当 `lastScanTime` 变为一个新的、非空的值时（表示一次新的扫描完成），触发 `dashboardStore.fetchAll(props.projectName)` 调用，刷新仪表盘数据。

**新增行数**: 14， **删除行数**: 0

**影响范围**: Web Dashboard 用户界面。此修复增强了仪表盘数据刷新的及时性，使其能自动响应扫描任务的完成。

**源码文件**:
- [DashboardView.vue](/project/Claude-DevSprite/source?path=web/src/views/DashboardView.vue)

## 修复的问题列表

本次提交修复了以下问题：

1.  **任务进度不实时刷新**: 在完成一次代码扫描后，仪表盘的任务进度统计、审查列表等数据不会自动更新。用户必须手动刷新页面才能看到扫描产生的新任务或状态变化，导致体验割裂。
2.  **数据同步不完整**: 虽然之前已引入 WebSocket 连接用于接收 `dashboard.reviews.updated` 等事件，但扫描任务的完成状态（`isScanning` 和 `lastScanTime`）并未被纳入实时推送的事件中，导致数据刷新存在缺口。

## 根本原因

根本原因是 **仪表盘数据刷新的触发机制存在覆盖盲区**。前端虽然通过 WebSocket 监听了一些特定事件（如审查项更新），但未全面覆盖所有可能导致仪表盘数据变化的状态源头。特别是后端 `AgentScanner` 的扫描状态（开始/结束）和扫描完成时间戳的变化，没有与前端的刷新机制建立联系。因此，当一次扫描结束时，前端无法感知并主动拉取最新的任务和审查数据。

## 修复方案

修复方案是在前端 **主动监听关键的状态变化**，而非完全依赖后端推送事件。具体实现：

1.  **监听扫描状态变化**: 在组件挂载后，添加对 `dashboardStore.scannerConfig.isScanning` 的 `watch`。这相当于将扫描器的“运行/停止”状态作为一个前端可感知的信号源。
2.  **监听扫描时间变化**: 添加对 `dashboardStore.scannerStatus.lastScanTime` 的 `watch`。时间戳的更新是一个明确且唯一的完成信号，作为第二重保障。
3.  **触发全量刷新**: 在两个监听器的回调函数中，都调用 `dashboardStore.fetchAll()`，确保在任何扫描完成信号出现时，立即从后端拉取完整的最新数据集。

此方案将数据刷新的驱动源从单一的“WebSocket推送事件”扩展为“状态监听 + 事件推送”的双模式，实现了对扫描完成场景的全覆盖。

## 影响评估

- **功能恢复**: 任务进度和审查列表的自动刷新功能得到修复。扫描任务完成后，仪表盘数据能立即自动更新，用户无需手动操作。
- **用户体验提升**: 界面的实时性和响应性显著增强，消除了数据滞后感，操作流程更加流畅连贯。
- **系统健壮性**: 通过监听存储层的状态变化，而非仅依赖可能遗漏的事件推送，提高了数据同步的可靠性，减少了因遗漏事件导致的同步失败风险。
- **技术一致性**: 修复与既有的 `dashboardStore` 状态管理架构保持一致，利用 Vue 的响应式系统（`watch`）来响应状态变更，实现方式清晰、低侵入。

## 关联文档与源码

- **项目知识库**: 本次修复涉及 Web Dashboard 核心视图及其状态管理。相关组件和架构描述请参阅：
  - [模块分析 - DashboardView.vue](/project/Claude-DevSprite/source?path=knowledge/project-overview/03-modules.md#7-web-前端-web)
  - [系统架构](/project/Claude-DevSprite/source?path=knowledge/project-overview/02-architecture.md)
- **先前修复**: 这是对 `DashboardView.vue` 数据刷新机制的进一步完善。此前已通过引入 WebSocket 实现了基于事件的推送（参考：[changelog/2026-05-14-task-progress-manual-refresh-fix.md](/project/Claude-DevSprite/source?path=knowledge/changelog/2026-05-14-task-progress-manual-refresh-fix.md)），本次修复补充了对扫描状态的直接监听。
- **技术栈**: 本次变更利用了 Vue 3 的 `watch` 响应式 API 和项目现有的 `dashboardStore` 状态管理。
