# 05. 总结

## 修复统计

| 指标 | 值 |
|------|-----|
| 修复问题数 | 1 |
| 修改文件数 | 2 |
| 测试方式 | Playwright UI 截图验证 |

## 问题描述

AI审查修复完毕后，项目计划和进度统计的UI不更新。

## 根本原因

1. fixReview/batchFixReviews 只刷新 reviews，不刷新 tasks
2. tasks 和 reviews 是独立系统，修复 review 不改变 task 状态

## 修复方案

### Store (dashboard.ts)
4 个 review 操作函数添加 `fetchTasks()` 调用

### View (DashboardView.vue)
- taskGroups 合并 tasks + reviews 数据
- 进度统计基于合并总数
- getStatusColor/getTaskMeta 支持 review 类型

## 修复前后对比

```
修复前:
  进行中: 0  (只有 tasks，全部 backlog)
  已完成: 0
  待开发: 3
  进度: 0%

修复后:
  进行中: 382 (pending/approved reviews)
  已完成: 395 (fixed/confirmed reviews)
  待开发: 4 (backlog tasks + ignored reviews)
  进度: 51%
```
