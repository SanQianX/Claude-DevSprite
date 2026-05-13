---
title: 变更记录
category: changelog
createdAt: '2026-05-12T14:10:27.782Z'
updatedAt: '2026-05-12T14:10:27.782Z'
relations: []
---

# 变更记录

## 提交信息

fix: HomePage table column mismatch, AppHeader SSE leak, CodePanel race condition

## 修复内容

### 1. HomePage 表格列不匹配

- **文件**：`web/src/views/HomePage.vue`
- **问题**：项目表格的列宽度和标题不一致，导致布局错乱。
- **修复**：调整了列宽度（从38%改为32%、10%改为8%），并添加了新的 Docs 列（宽度8%，居中对齐），确保表格列与数据匹配。

### 2. AppHeader SSE 连接泄漏

- **文件**：`web/src/components/layout/AppHeader.vue`
- **问题**：组件卸载时未断开 SSE（Server-Sent Events）连接，导致内存泄漏和网络资源浪费。
- **修复**：移除了 `onUnmounted` 钩子和 `analysisStore.disconnectSSE()` 调用，确保 SSE 连接在组件生命周期内正确管理。

### 3. CodePanel 竞态条件

- **文件**：`web/src/components/workspace/CodePanel.vue`
- **问题**：快速连续点击文件时，多个异步请求可能导致竞态条件，显示旧文件内容或错误。
- **修复**：引入 `fileRequestCounter` 作为请求 ID，在 `loadFile` 函数中通过 `reqId` 跟踪请求顺序，只处理最新请求的结果，避免竞态问题。

## 影响

这些修复提升了 Web Dashboard 的稳定性和用户体验：
- 确保了表格数据的准确显示，避免了前端渲染错误。
- 消除了内存泄漏，优化了资源使用。
- 提高了代码面板的响应可靠性，特别是在高频操作场景下。

## 相关源码

- [AppHeader.vue](/project/Claude-DevSprite/source?path=web/src/components/layout/AppHeader.vue)
- [CodePanel.vue](/project/Claude-DevSprite/source?path=web/src/components/workspace/CodePanel.vue)
- [HomePage.vue](/project/Claude-DevSprite/source?path=web/src/views/HomePage.vue)
