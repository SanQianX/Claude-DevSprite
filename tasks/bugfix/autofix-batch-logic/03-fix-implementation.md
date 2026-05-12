# 03. 修复实现

## 修改文件

| 文件 | 变更 |
|------|------|
| `src/worker/routes/reviews.ts` | fix-batch 端点支持 reviewIds 参数 |
| `web/src/api/dashboard.ts` | batchFixReviews() 支持 reviewIds 参数 |
| `web/src/stores/dashboard.ts` | batchFixReviews() 传递 reviewIds |
| `web/src/views/DashboardView.vue` | 记录新 review IDs 并传递 |

## 后端: reviews.ts

```typescript
// 新增: 从 body 读取 reviewIds
const { reviewIds } = req.body || {};

// 根据 reviewIds 决定处理范围
let reviewsToProcess;
if (Array.isArray(reviewIds) && reviewIds.length > 0) {
  // 只处理指定的 reviews
  reviewsToProcess = reviewIds
    .map((id) => db.getReview(id))
    .filter((r) => r && r.project_id === project.id);
} else {
  // 处理所有 pending reviews (向后兼容)
  reviewsToProcess = db.getPendingReviews(project.id);
}
```

## 前端: DashboardView.vue

```typescript
async function startScan() {
  // 1. 记录扫描前的 pending review IDs
  const oldPendingIds = new Set(
    dashboardStore.reviews
      .filter(r => r.status === 'pending')
      .map(r => r.id)
  )

  // 2. 执行扫描
  const scanResult = await dashboardStore.triggerScan(props.projectName)

  // 3. 找出新发现的 review IDs
  if (autoFixAfterScan.value && scanResult.findingsCount > 0) {
    const newReviewIds = dashboardStore.reviews
      .filter(r => r.status === 'pending' && !oldPendingIds.has(r.id))
      .map(r => r.id)

    // 4. 只修复新发现的 reviews
    const fixResult = await dashboardStore.batchFixReviews(
      props.projectName,
      newReviewIds  // ← 传递新 IDs
    )
  }
}
```

## 向后兼容

- `reviewIds` 为空或不提供 → 处理所有 pending reviews（旧行为）
- 前端调用带 `reviewIds` → 只处理指定 reviews（新行为）
