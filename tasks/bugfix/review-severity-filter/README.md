# AI 审查队列 - 严重性筛选 Bug 修复

## 问题概述

AI 审查队列的严重性筛选按钮存在多个问题，导致用户体验异常。

## 修复日期
2026-05-12

## 修复结果
✅ 已修复所有问题

## UI 测试验证

### 测试环境
- 浏览器: Chromium (Playwright)
- 测试页面: http://127.0.0.1:38888/project/Claude-DevSprite?tab=dashboard
- 审查项总数: 224

### 测试结果

| 测试项 | 修复前 | 修复后 | 状态 |
|--------|--------|--------|------|
| 选择 critical 筛选 | 显示 0 个 | 显示 2 个 | ✅ |
| 选择 warning 筛选 | 显示 0 个 | 显示 59 个 | ✅ |
| 点击批准按钮 | 审查项消失 | 审查项保留 | ✅ |
| 统计数字 | 不正确 | 正确 (192/32/0) | ✅ |
| 重置按钮 | 不存在 | 工作正常 | ✅ |

### 测试截图
`test-review-filter-result.png`

---

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

### Bug #2: 严重性筛选选项与数据库不匹配

**文件**: `web/src/views/DashboardView.vue` (第 94-99 行)

**问题代码**:
```vue
<select class="filter-select" v-model="severityFilter">
  <option value="all">严重性</option>
  <option value="HIGH">HIGH</option>  <!-- ← 错误：数据库是 critical/warning/info -->
  <option value="MED">MED</option>
  <option value="LOW">LOW</option>
</select>
```

**数据库实际值**:
```sql
SELECT severity, COUNT(*) FROM reviews GROUP BY severity;
-- critical: 2
-- warning: 59
-- info: 163
```

**影响**:
- 用户选择 "HIGH" 筛选时，与数据库的 "critical" 不匹配
- 筛选器完全不工作，显示 0 个结果

**修复方案**:
```vue
<select class="filter-select" v-model="severityFilter">
  <option value="all">严重性</option>
  <option value="critical">Critical</option>
  <option value="warning">Warning</option>
  <option value="info">Info</option>
</select>
```

同时更新 CSS 样式：
```css
.severity-critical { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
.severity-warning { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
.severity-info { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
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
| `web/src/views/DashboardView.vue` | 修复筛选选项 + 添加重置按钮 + 更新 CSS |
| `test-review-filter.js` | 添加 Playwright UI 测试 |
