# 01. UI 控件分析

## 数据流

```
onMounted
    ↓
fetchAll(projectName)
    ├─ fetchTasks() → dashboardStore.tasks ← 项目计划/进度统计的数据源
    └─ fetchReviews() → dashboardStore.reviews ← AI审查队列的数据源

用户点击"批准修复"
    ↓
fixReview(id)
    ├─ dashboardApi.updateReview() → 更新 review 状态
    └─ fetchReviews() → ✅ 刷新审查列表
    └─ fetchTasks() → ❌ 未调用！任务列表不刷新

批量自动修复
    ↓
batchFixReviews(projectName, ids)
    ├─ dashboardApi.batchFixReviews() → 批量修复
    └─ fetchReviews() → ✅ 刷新审查列表
    └─ fetchTasks() → ❌ 未调用！任务列表不刷新
```

## 问题现象

- AI审查修复完毕后，审查队列状态正确更新 (pending→fixed)
- 但"项目计划"的进行中/已完成/待开发数量不变
- "进度统计"的百分比不变

## 根因

`fixReview()` 和 `batchFixReviews()` 只调用了 `fetchReviews()`，没有调用 `fetchTasks()`。
tasks 数据在 `onMounted` 时加载一次后不再刷新。
