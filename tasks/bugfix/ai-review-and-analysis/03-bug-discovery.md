# 03. 问题发现过程

## 发现时间
2026-05-12

## 发现方式
Playwright UI 测试 + 代码审查

## 问题 #1: 审查扫描按钮不存在 (Critical)

### 排查步骤

**Step 1: 检查 DashboardView 模板**

文件: `web/src/views/DashboardView.vue`

```html
<!-- 第 82-86 行 -->
<div class="section review-section">
  <div class="section-header">
    <div class="section-title">AI 审查队列</div>
  </div>
  <!-- 没有扫描按钮 -->
```

**发现**: section-header 中只有标题，没有扫描按钮。

**Step 2: 检查 dashboard API 客户端**

文件: `web/src/api/dashboard.ts`

```typescript
export const dashboardApi = {
  getReviews(projectName)         // ✅ 存在
  createReview(projectName, review) // ✅ 存在
  updateReview(projectName, id, updates) // ✅ 存在
  deleteReview(projectName, id)   // ✅ 存在
  // ❌ 没有 triggerScan() 方法
}
```

**发现**: API 客户端没有 `triggerScan()` 方法。

**Step 3: 检查后端端点**

文件: `src/worker/routes/reviews.ts`

```typescript
// 第 53-67 行
app.post('/api/projects/:name/reviews/scan', asyncHandler(async (req, res) => {
  const codeReviewer = getReviewer();
  const findingsCount = await codeReviewer.scanProject(project.id, project.path, project.name);
  res.json({ message: `扫描完成，发现 ${findingsCount} 个问题`, findingsCount });
}));
```

**发现**: 后端端点存在且功能完整，但前端没有调用它。

**Step 4: 全局搜索**

搜索 `scan`、`triggerScan`、`startScan`、`reviews/scan` — 零结果。

**确认**: 整个前端没有任何代码调用扫描端点。

### 测试验证

```bash
# 直接调用后端端点
curl -X POST http://127.0.0.1:38888/api/projects/Claude-DevSprite/reviews/scan
```

**结果**: `{"message":"扫描完成，发现 0 个问题","findingsCount":0}`

**确认**: 后端端点正常工作，问题完全在前端。

---

## 问题 #2: "批准修复"按钮不调用修复 API (Critical)

### 排查步骤

**Step 1: 检查 DashboardView 按钮事件**

文件: `web/src/views/DashboardView.vue` (第 139 行)

```html
<button class="btn btn-approve" @click.stop="approveReview(review.id)">批准修复</button>
```

**Step 2: 检查 approveReview 函数**

```typescript
function approveReview(id: number) {
  dashboardStore.approveReview(props.projectName, id)
}
```

**Step 3: 检查 store 方法**

文件: `web/src/stores/dashboard.ts` (第 60-68 行)

```typescript
async function approveReview(projectName: string, reviewId: number) {
  await dashboardApi.updateReview(projectName, reviewId, { status: 'approved' })
  // 只更新状态字段，不调用修复 API
  const review = reviews.value.find(r => r.id === reviewId)
  if (review) {
    review.status = 'approved'
    review.resolved_at = new Date().toISOString()
  }
}
```

**发现**: `approveReview` 只调用 `PUT /reviews/:id` 更新状态，没有调用 `POST /reviews/:id/fix`。

**Step 4: 检查后端修复端点**

文件: `src/worker/routes/reviews.ts` (第 105-155 行)

```typescript
app.post('/api/reviews/:id/fix', asyncHandler(async (req, res) => {
  const fix = await codeReviewer.generateFix(project.path, review.file_path, { ... });
  await fs.promises.writeFile(fullPath, fix.fixedContent, 'utf-8');
  db.updateReview(id, { status: 'fixed', resolved_at: new Date().toISOString() });
  res.json({ message: '修复已应用', explanation: fix.explanation });
}));
```

**发现**: 修复端点功能完整 (读取文件 → AI 生成修复 → 写入文件 → 更新状态)，但前端没有调用它。

**Step 5: 检查 dashboard API 客户端**

```typescript
export const dashboardApi = {
  // ...
  // ❌ 没有 fixReview() 方法
}
```

**确认**: API 客户端缺少 `fixReview()` 方法。

---

## 问题 #3: 项目分析没有触发按钮 (High)

### 排查步骤

**Step 1: 检查 DashboardView 项目信息栏**

```html
<div class="project-stats">
  <div class="stat-item">...</div>
  <!-- 没有分析按钮 -->
</div>
```

**发现**: 项目信息栏只有统计数据，没有分析按钮。

**Step 2: 检查 analysis API 客户端**

文件: `web/src/api/analysis.ts`

```typescript
export const analysisApi = {
  async getAnalysisStatus(projectName: string) { ... }    // ✅
  async triggerFullAnalysis(projectName: string) { ... }  // ✅ 已定义
}
```

**发现**: `triggerFullAnalysis()` 方法已定义但没有被任何组件调用。

**Step 3: 全局搜索**

搜索 `triggerFullAnalysis`、`analyze/full`、`startAnalysis` — 只在 API 定义中找到。

**确认**: 没有任何组件调用分析触发 API。

---

## 问题总结

| # | 问题 | 严重性 | 根本原因 | 影响 |
|---|------|--------|----------|------|
| 1 | 审查扫描按钮不存在 | Critical | API 客户端无 triggerScan()，UI 无按钮 | 用户无法触发代码审查 |
| 2 | 批准修复只设状态 | Critical | API 客户端无 fixReview()，store 不调用修复 API | 修复功能完全不可用 |
| 3 | 分析无触发按钮 | High | API 已定义但无组件调用 | 用户无法手动触发分析 |
