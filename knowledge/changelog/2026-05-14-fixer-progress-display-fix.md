---
title: 变更记录 - 自动修复器进度状态前端展示修复
category: changelog
createdAt: '2026-05-14T13:03:16.703Z'
updatedAt: '2026-05-14T13:03:16.703Z'
relations:
  - changelog/2026-05-14-route-conflict-dashboard-reviews-fix.md
---

# 变更记录 - 自动修复器进度状态前端展示修复

## 提交信息

- **提交类型**: `fix` - 修复/增强
- **提交消息**: `fix(auto): scanner-fixer-config-routes-missing-fix_2026-05-14`
- **修复日期**: 2026-05-14

## 变更内容

### 1. web/src/stores/dashboard.ts

**变更类型**: 修改

**变更详情**:

扩展了前端自动修复器配置状态 (`fixerConfig`) 的类型定义和初始值，以支持后端新增的进度跟踪字段。

- **类型扩展**: `fixerConfig` 的 `ref` 类型从 `{ enabled: boolean; intervalMs: number; isFixing: boolean }` 扩展为 `{ enabled: boolean; intervalMs: number; isFixing: boolean; currentFixDir: string | null; currentFixIndex: number; totalFixes: number; }`。
- **新增状态字段**:
  - `currentFixDir: string | null`: 记录当前正在修复的文件或目录路径。
  - `currentFixIndex: number`: 记录当前已处理的修复项索引。
  - `totalFixes: number`: 记录本次修复任务计划处理的总修复项数量。
- **默认值更新**: `intervalMs` 默认值从 `5 * 60 * 1000` (5分钟) 调整为 `30 * 60 * 1000` (30分钟)。

**影响范围**: 前端状态管理层 (`dashboard` store)。确保前端能够接收、存储并反映后端修复器运行时产生的实时进度数据。

**源码文件**: [dashboard.ts](/project/Claude-DevSprite/source?path=web/src/stores/dashboard.ts)

### 2. web/src/views/DashboardView.vue

**变更类型**: 修改

**变更详情**:

在仪表盘视图中新增了自动修复器实时进度状态的可视化指示器。

- **新增 UI 组件**:
  - 添加了条件渲染块 (`v-if="fixerStore.isFixing"`)，仅在自动修复器运行时显示。
  - 包含一个脉冲动画条 (`<div class="fixer-pulse"></div>`)，用于视觉上表示“进行中”状态。
  - 显示文本 "修复中 [{{ fixerStore.currentFixIndex }}/{{ fixerStore.totalFixes }}]"，清晰展示修复进度。
  - 显示当前正在处理的目录路径 (`<span class="fixer-current-dir">{{ fixerStore.currentFixDir }}</span>`)。
- **样式集成**: 新增的指示器被插入到扫描器状态区域 (`scan-last-time` 之后，扫描开关之前)，保持了 UI 布局的连贯性。

**影响范围**: 用户界面 (`DashboardView` 组件)。为用户提供了自动修复器运行状态的实时、透明反馈，解决了修复过程“黑箱”问题。

**源码文件**: [DashboardView.vue](/project/Claude-DevSprite/source?path=web/src/views/DashboardView.vue)

## 修复的问题列表

1.  **修复器运行状态不透明**: 用户无法得知自动修复器是否正在运行，也无法了解其处理进度（处理到哪个文件、总共多少项）。
2.  **缺乏实时反馈**: 在自动修复器工作期间，Dashboard 界面没有提供任何动态视觉反馈，可能导致用户误以为系统无响应。

## 根本原因

根本原因是 **后端修复器的进度跟踪状态已就绪，但前端未实现相应的数据消费和展示逻辑**。此前（参考 `changelog/2026-05-14-route-conflict-dashboard-reviews-fix.md`），`AgentFixer` 和 `DesignFixer` 已在内部维护了 `currentFixDir`、`currentFixIndex`、`totalFixes` 状态，并通过 `GET /fixer/config` API 端点暴露。然而，前端 `dashboard` store 和 `DashboardView` 组件未定义对这些新字段的类型支持，也未创建任何 UI 元素来展示它们。

## 修复方案

修复方案分为前后端对齐的两个步骤：

1.  **前端数据模型对齐 (store)**: 扩展 `fixerConfig` 的 TypeScript 类型定义，添加与后端 API 返回值相匹配的三个进度字段，并设置合理的默认初始值。
2.  **前端 UI 增强 (view)**: 在 `DashboardView.vue` 模板中，利用 `v-if` 指令和扩展后的 `fixerStore` 数据，构建一个动态的修复器状态指示器。该指示器结合了图标、进度数字和路径信息，并通过 CSS 动画增强视觉提示。

此方案确保了前后端数据契约的一致性，并将原本隐藏的后台进程状态转化为用户可感知的界面元素。

## 影响评估

- **用户体验提升**: 自动修复器的工作过程变得可视化、可追踪，消除了用户的不确定感，提升了交互的透明度和信任感。
- **监控能力增强**: 为管理员或开发者提供了实时监控修复任务的 UI 途径，有助于快速判断系统是否在正常工作或卡在某个文件上。
- **实现低风险**: 变更仅限于前端展示层的增加和数据类型的扩展，不涉及后端逻辑或核心数据流的修改，回归风险较低。
- **默认间隔调整**: `intervalMs` 默认值的调整（5分钟 -> 30分钟）是配置优化，旨在降低自动修复器的运行频率，可能基于对资源消耗或问题发生频率的重新评估。

## 关联文档与源码

- **后端进度跟踪**: 本次前端展示的实现，依赖于之前提交中后端修复器添加的状态字段。详见：
  - [changelog/2026-05-14-route-conflict-dashboard-reviews-fix.md](/project/Claude-DevSprite/source?path=knowledge/changelog/2026-05-14-route-conflict-dashboard-reviews-fix.md) (后端 `agentFixer.ts`, `designFixer.ts` 变更)
- **模块分析**: 自动修复器 (`DesignFixer`/`AgentFixer`) 的完整职责和状态管理描述，请参阅：
  - [模块分析 - 自动修复器](/project/Claude-DevSprite/source?path=knowledge/project-overview/03-modules.md#81-自动修复器-designfixer--agentfixer)
- **API 端点**: 获取修复器配置的 API `GET /fixer/config`，其返回类型已因本次变更而扩展。

## 总结

本次提交成功将后端自动修复器的实时运行状态，通过前端 UI 组件直观地呈现给用户，完成了修复器状态从“有”到“可见”的关键一步，显著改善了该自动化功能的用户体验和可观测性。
