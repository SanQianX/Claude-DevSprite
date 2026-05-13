# 02. 根本原因

## 数据流（修复前）

```
onMounted → fetchAll() → 加载 tasks + reviews (一次性)
                              ↓
用户修复 review → fixReview() → fetchReviews() ✅
                              → fetchTasks()  ❌ 未调用
                              ↓
tasks 数据过时 → UI 不更新
```

## 两个独立问题

1. **fetchTasks 未调用**: fixReview/batchFixReviews 只刷新 reviews，不刷新 tasks
2. **tasks 和 reviews 独立**: 修复 review 不会改变 task 状态，两者没有关联

## 修复方案

### 前端 Store (dashboard.ts)
- fixReview/batchFixReviews/approveReview/ignoreReview 后调用 fetchTasks()

### 前端 View (DashboardView.vue)
- taskGroups 合并 tasks + reviews:
  - 进行中 = tasks(progress) + reviews(pending/approved)
  - 已完成 = tasks(done) + reviews(fixed/confirmed)
  - 待开发 = tasks(backlog) + reviews(ignored)
- 进度统计基于合并后的总数
- getStatusColor/getTaskMeta 支持 review 类型
