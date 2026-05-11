# AI 审查队列 - 严重性筛选 Bug 修复

## 问题概述

AI 审查队列的严重性筛选按钮存在多个问题，导致用户体验异常。

## 修复日期
2026-05-12

## 修复结果
✅ 已修复所有问题

## 发现的问题

### Bug #1: Approve/Ignore 后审查项消失

**文件**: `web/src/stores/dashboard.ts` (第 60-68 行)

**问题代码**:
```typescript
async function approveReview(projectName: string, reviewId: number) {
  await dashboardApi.updateReview(projectName, reviewId, { status: 'approved' })
  reviews.value = reviews.value.filter(r => r.id !== reviewId)  // ← 错误！
}

async function ignoreReview(projectName: string, reviewId: number) {
  await dashboardApi.updateReview(projectName, reviewId, { status: 'ignored' })
  reviews.value = reviews.value.filter(r => r.id !== reviewId)  // ← 错误！
}
```

**影响**:
1. 批准/忽略后，审查项从列表中完全消失
2. `reviewStats` 统计不正确（approved/ignored 计数归零）
3. 用户无法看到已处理的审查项
4. 筛选器切换时，已处理的审查项不会出现

**修复方案**:
```typescript
async function approveReview(projectName: string, reviewId: number) {
  await dashboardApi.updateReview(projectName, reviewId, { status: 'approved' })
  // 更新状态而不是删除，这样筛选器和统计才能正确工作
  const review = reviews.value.find(r => r.id === reviewId)
  if (review) {
    review.status = 'approved'
    review.resolved_at = new Date().toISOString()
  }
}

async function ignoreReview(projectName: string, reviewId: number) {
  await dashboardApi.updateReview(projectName, reviewId, { status: 'ignored' })
  // 更新状态而不是删除，这样筛选器和统计才能正确工作
  const review = reviews.value.find(r => r.id === reviewId)
  if (review) {
    review.status = 'ignored'
    review.resolved_at = new Date().toISOString()
  }
}
```

---

### Bug #2: 严重性筛选大小写不匹配

**文件**: `web/src/views/DashboardView.vue` (第 94-99 行)

**问题代码**:
```vue
<select class="filter-select" v-model="severityFilter">
  <option value="all">严重性</option>
  <option value="HIGH">HIGH</option>  <!-- ← 问题：后端可能是 high/High -->
  <option value="MED">MED</option>
  <option value="LOW">LOW</option>
</select>
```

**筛选逻辑** (第 226-232 行):
```typescript
const severityMatch = severityFilter.value === 'all' || r.severity === severityFilter.value
```

**影响**:
- 如果后端返回 `severity: "high"`，用户选择 "HIGH" 筛选不生效
- 筛选器形同虚设

**修复方案**:
```typescript
// 严重性筛选：大小写不敏感比较
const severityMatch = severityFilter.value === 'all' ||
  r.severity?.toUpperCase() === severityFilter.value.toUpperCase()
```

---

### Bug #3: 筛选器无法快速重置

**问题**: 用户选择严重性级别后，需要手动选择 "严重性" 选项才能重置

**修复方案**: 添加"重置筛选"按钮
```vue
<button
  v-if="statusFilter !== 'all' || severityFilter !== 'all'"
  class="filter-reset-btn"
  @click="resetFilters"
>
  重置筛选
</button>
```

```typescript
function resetFilters() {
  statusFilter.value = 'all'
  severityFilter.value = 'all'
}
```

---

### Bug #4: reviewStats 更新时机错误

**问题**: approveReview/ignoreReview 直接删除审查项，导致统计立即变化，但 UI 还没刷新

**影响**: 统计数字闪烁或不准确

**修复**: 已在 Bug #1 中一并修复（更新状态而非删除）

## 文件变更

| 文件 | 修改内容 |
|------|----------|
| `web/src/stores/dashboard.ts` | 修复 approveReview/ignoreReview 逻辑 |
| `web/src/views/DashboardView.vue` | 修复筛选逻辑 + 添加重置按钮 |
