---
title: 变更记录 - 自动修复器进度跟踪与扫描器状态修复
category: changelog
createdAt: '2026-05-14T13:00:16.322Z'
updatedAt: '2026-05-14T13:00:16.322Z'
relations:
  - changelog/2026-05-14_02-create-delete-review-dead-code-fix.md
  - project-overview/03-modules.md
---

# 变更记录 - 自动修复器进度跟踪与扫描器状态修复

## 提交信息

- **提交类型**: `fix` - 修复/增强
- **提交消息**: `fix(auto): route-conflict-dashboard-reviews-fix_2026-05-14`
- **修复日期**: 2026-05-14

## 变更概要

本次提交为自动修复器 (`AgentFixer`, `DesignFixer`) 增加了详细的运行时进度跟踪状态，并增强了扫描器 (`AgentScanner`) 的状态管理健壮性。同时，更新了 Web Dashboard 的 API 客户端以接收并可能展示这些新状态。这些变更旨在提升自动修复流程的可观察性和系统的容错能力。

## 详细变更

### 1. 自动修复器进度跟踪 (后端)

**变更文件**:
- `src/analyzer/agentFixer.ts`
- `src/analyzer/designFixer.ts`

**变更详情**:

为 `AgentFixer` 和 `DesignFixer` 类添加了以下私有状态字段，用于在修复过程中跟踪实时进度：
- `currentFixDir: string | null`: 当前正在修复的文件或目录路径。
- `currentFixIndex: number`: 当前已处理的修复项索引。
- `totalFixes: number`: 本次修复任务计划处理的总修复项数量。

这些字段被添加到了修复器的 `config` 状态对象中，以便通过 API 暴露给外部（如 Dashboard）。

**影响范围**: 自动修复器模块的内部状态管理。提供了修复过程的细粒度监控能力。

**源码文件**:
- [agentFixer.ts](/project/Claude-DevSprite/source?path=src/analyzer/agentFixer.ts)
- [designFixer.ts](/project/Claude-DevSprite/source?path=src/analyzer/designFixer.ts)

### 2. 扫描器状态保护 (后端)

**变更文件**:
- `src/analyzer/agentScanner.ts`

**变更详情**:

在 `AgentScanner` 类的 `isScanning` getter 中增加了一个保护性检查。当 `isBatchScanning` 标志位为 `true` 但 `activeScanInfo` 为空时（例如，守护进程在扫描过程中被意外终止），该检查会将 `isBatchScanning` 标志位重置为 `false`。

**影响范围**: 扫描器模块的状态管理。防止了因异常退出导致的状态“卡死”问题，增强了系统的健壮性。

**源码文件**:
- [agentScanner.ts](/project/Claude-DevSprite/source?path=src/analyzer/agentScanner.ts)

### 3. Dashboard API 客户端更新 (前端)

**变更文件**:
- `web/src/api/dashboard.ts`

**变更详情**:

更新了 `getFixerConfig` API 函数的返回类型，使其包含从后端新增的修复进度字段：`currentFixDir`, `currentFixIndex`, `totalFixes`。这确保了前端可以获取到最新的修复状态信息，为未来在 Dashboard 上展示修复进度做好了准备。

**影响范围**: 前端 API 客户端层。确保了前端与后端数据模型的同步。

**源码文件**:
- [dashboard.ts](/project/Claude-DevSprite/source?path=web/src/api/dashboard.ts)

## 修复的问题列表

本次提交主要解决了以下潜在问题：

1.  **自动修复过程不透明**：之前无法得知自动修复器正在处理哪个文件、进展到哪一步。新增的状态跟踪字段提供了实时反馈。
2.  **扫描器状态异常风险**：在极端情况下（如进程被 kill），`isBatchScanning` 标志可能残留为 `true`，导致扫描功能被错误锁定。本次增加的保护逻辑解决了这个问题。

## 根本原因

1.  **功能增强需求**：为了提升 Dashboard 的监控能力，需要暴露修复器的内部进度状态。
2.  **边缘情况处理不足**：`AgentScanner` 的状态逻辑未考虑守护进程被强制终止的异常路径，导致标志位可能不一致。

## 修复方案

1.  **状态扩展**：在 `AgentFixer` 和 `DesignFixer` 中新增状态字段，并通过配置接口暴露。
2.  **防御性编程**：在 `AgentScanner` 的 `isScanning` 属性访问器中增加一致性检查和自动修正逻辑。
3.  **前后端同步**：更新前端 API 类型定义以匹配新的后端响应结构。

## 影响评估

- **系统稳定性**：扫描器的状态保护逻辑减少了功能因异常而不可用的风险，提升了系统健壮性。
- **可观察性**：自动修复的进度信息可被 Dashboard 获取，为未来的用户界面增强奠定了基础。
- **向后兼容性**：所有变更均为功能增强或防御性修复，不破坏现有 API 合约。前端仅更新了获取配置的返回类型，未改变调用方式。

## 关联文档与源码

- **模块文档**: `project-overview/03-modules.md` 中关于自动修复器和扫描器的描述应更新，以反映其增强的状态跟踪能力。
- **先前分析**: 本次提交是 `fix(auto): route-conflict-dashboard-reviews-fix` 系列修复的一部分，旨在清理路由冲突并修复相关仪表板审查功能。具体的历史背景可参考 `changelog/2026-05-14_02-create-delete-review-dead-code-fix.md`。
