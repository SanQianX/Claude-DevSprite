# DesignChecker 扫描 UI 修复

## 问题概述

DesignChecker 功能一致性扫描功能存在两个问题：
1. **Critical**: 手动点击"开始扫描"按钮返回 500 错误 — `createReviewsBatch` 中 `save()` 调用 `db.export()` 干扰了 sql.js 活跃事务
2. **Feature**: 缺少定时扫描间隔配置的 UI 控件

## 修复日期
2026-05-13

## 文档索引

| 文件 | 内容 |
|------|------|
| [01-ui-analysis.md](01-ui-analysis.md) | UI 控件分析 |
| [02-design-intent.md](02-design-intent.md) | 原始设计逻辑 |
| [03-bug-discovery.md](03-bug-discovery.md) | 问题发现过程 |
| [04-root-cause.md](04-root-cause.md) | 根本原因分析 |
| [05-fix-implementation.md](05-fix-implementation.md) | 修复实现过程 |
| [06-testing.md](06-testing.md) | 测试验证 |
| [07-summary.md](07-summary.md) | 总结与改进 |

## 修复文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/worker/db.ts` | 修改 | `createReviewsBatch` 避免在事务内调用 `save()` |
| `src/analyzer/designChecker.ts` | 新建 | DesignChecker 核心类 (含 getConfig/updateConfig) |
| `src/worker/routes/reviews.ts` | 修改 | scan 端点改用 DesignChecker + 添加 scanner config 路由 |
| `src/worker/routes/index.ts` | 修改 | 注册 scanner config 路由 |
| `src/worker/index.ts` | 修改 | 后台扫描改用 DesignChecker |
| `web/src/api/dashboard.ts` | 修改 | 添加 scanner config API 方法 |
| `web/src/stores/dashboard.ts` | 修改 | 添加 scanner config store |
| `web/src/views/DashboardView.vue` | 修改 | 添加定时扫描 UI 控件 |
