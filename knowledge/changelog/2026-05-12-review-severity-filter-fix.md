---
title: 变更记录 - AI 审查队列严重性筛选修复
category: changelog
createdAt: '2026-05-11T17:26:33.004Z'
updatedAt: '2026-05-11T17:26:33.004Z'
relations: []
---

# 变更记录 - AI 审查队列严重性筛选修复

## 提交信息

- **提交类型**: `fix` - 修复
- **提交消息**: `fix(reviews): 修复 AI 审查队列严重性筛选多个问题`
- **修复日期**: 2026-05-12

## 变更内容

### 1. tasks/bugfix/review-severity-filter/README.md

**变更类型**: 新增

**变更详情**:

新增完整的 Bug 修复文档，详细记录了 AI 审查队列严重性筛选功能存在的多个问题及其修复方案。文档涵盖了问题概述、发现的问题列表、根本原因分析、修复方案和影响评估。

**新增行数**: 132, **删除行数**: 0

**影响范围**: 项目知识库文档，为后续维护提供详细参考。

**相关文件**:
- [README.md](/project/Claude-DevSprite/source?path=tasks/bugfix/review-severity-filter/README.md)

### 2. web/src/stores/dashboard.ts

**变更类型**: 修改

**变更详情**:

- **审查状态更新逻辑重构**：修改了 `approveReview` 和 `ignoreReview` 函数的实现。
- **从删除改为更新状态**：不再通过 `filter` 数组方法直接从 `reviews` 中移除审查记录，而是找到对应记录后更新其 `status` 和 `resolved_at` 字段。
- **新增逻辑注释**：明确说明更新状态而非删除，是为了确保前端的 `severityFilter`、`statusFilter` 筛选器以及 `reviewStats` 统计数据能基于完整数据集正确工作。

**新增行数**: 12, **删除行数**: 2

**影响范围**: 前端状态管理核心逻辑。此修复解决了审查操作后，筛选器和统计计数显示不正确的根本问题。

**相关文件**:
- [dashboard.ts](/project/Claude-DevSprite/source?path=web/src/stores/dashboard.ts)

### 3. web/src/views/DashboardView.vue

**变更类型**: 修改

**变更详情**:

- **新增重置筛选按钮**：在筛选器旁添加了一个“重置筛选”按钮，仅在非默认筛选状态下显示（`v-if="statusFilter !== 'all' || severityFilter !== 'all'"`）。按钮点击会触发 `resetFilters` 方法，将所有筛选条件恢复为 `'all'`。
- **优化筛选逻辑**：改进了 `filteredReviews` 计算属性的实现，使用 `includes` 方法替代多重 `===` 判断，代码更简洁且易于扩展。
- **完善事件处理**：为“重置筛选”按钮绑定了 `@click` 事件。

**新增行数**: 29, **删除行数**: 1

**影响范围**: 用户界面交互。提升了筛选器的可用性和用户体验，使用户可以方便地清除筛选条件。

**相关文件**:
- [DashboardView.vue](/project/Claude-DevSprite/source?path=web/src/views/DashboardView.vue)

## 修复的问题列表

本次提交集中修复了以下多个相互关联的问题：

1.  **严重性筛选不生效**：选择特定严重性等级（如 `CRIT`、`HIGH`）后，列表未正确更新。
2.  **筛选器状态不一致**：批准/忽略审查后，已筛选的列表状态会重置或显示错误。
3.  **统计计数错误**：`reviewStats` 中的“待审批”、“已批准”等计数不准确。
4.  **缺少重置功能**：用户无法快速清除所有筛选条件，回到完整列表。
5.  **性能与用户体验**：因频繁删除和重新计算整个数组导致的潜在性能问题。

## 根本原因

核心原因在于 `approveReview` 和 `ignoreReview` 函数直接从 `reviews` 响应式数组中删除了记录。这导致：
- 用于筛选和统计的 `reviews` 数据源不再完整，后续基于此数组的 `filteredReviews` 和 `reviewStats` 计算全部失效。
- 筛选器的 `v-model` 绑定失去了作用，因为数据源已被破坏。

## 修复方案

1.  **状态持久化**：修改审查操作函数，改为更新记录的 `status` 字段，而非从数组中删除。这确保了 `reviews` 数组始终保持所有审查记录，作为筛选和统计的单一、可靠数据源。
2.  **前端筛选增强**：在 UI 层面添加重置按钮，并优化前端筛选计算逻辑，使其仅基于当前 `reviews` 数组的 `status` 和 `severity` 属性进行过滤。

## 影响评估

- **功能恢复**：严重性筛选和状态筛选功能恢复正常工作。
- **数据一致性**：审查操作后的界面状态（列表、筛选结果、统计数字）与后端数据保持一致。
- **用户体验提升**：新增重置按钮，操作流程更顺畅。
- **无破坏性变更**：修复仅涉及前端逻辑，未改变后端 API 接口或数据结构。
