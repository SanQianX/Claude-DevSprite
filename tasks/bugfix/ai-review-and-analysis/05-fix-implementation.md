# 05. 修复实现过程

## 修复架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        修复后架构                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                 │
│  前端                                                          │
│  ├─ DashboardView.vue ─────→ [开始扫描] + [开始分析] + [批准修复]  │
│  │     │                    │           │           │             │
│  │     │ scan-btn           │ analyze   │ fix-btn   │             │
│  │     ↓                    ↓           ↓           │             │
│  ├─ dashboard store ───────→ triggerScan()           │             │
│  │                    ─────→ fixReview()             │             │
│  │                    ─────→ approveReview() (保留)   │             │
│  ├─ dashboard API ─────────→ triggerScan()           │             │
│  │                    ─────→ fixReview()             │             │
│  ├─ analysis API ──────────→ triggerFullAnalysis()   │             │
│          │                                                      │
│          ↓                                                      │
│  后端 (无变更)                                                   │
│  ├─ POST /reviews/scan     ✅ 原有                                │
│  ├─ POST /reviews/:id/fix  ✅ 原有                                │
│  └─ POST /analyze/full     ✅ 原有                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

## 修复 1: API 客户端 — 添加缺失方法

文件: `web/src/api/dashboard.ts`

### 新增 triggerScan()

```typescript
async triggerScan(projectName: string): Promise<{ findingsCount: number }> {
  return unwrap(apiClient.post<{ findingsCount: number }>(
    `/projects/${encodeURIComponent(projectName)}/reviews/scan`
  ))
},
```

### 新增 fixReview()

```typescript
async fixReview(reviewId: number): Promise<{ explanation: string }> {
  return unwrap(apiClient.post<{ explanation: string }>(
    `/reviews/${reviewId}/fix`
  ))
},
```

## 修复 2: Store — 添加新方法

文件: `web/src/stores/dashboard.ts`

### 新增 triggerScan()

```typescript
async function triggerScan(projectName: string) {
  const result = await dashboardApi.triggerScan(projectName)
  await fetchReviews(projectName)  // 刷新列表
  return result
}
```

### 新增 fixReview()

```typescript
async function fixReview(projectName: string, reviewId: number) {
  const result = await dashboardApi.fixReview(reviewId)
  const review = reviews.value.find(r => r.id === reviewId)
  if (review) {
    review.status = 'fixed'
    review.resolved_at = new Date().toISOString()
  }
  return result
}
```

### 更新 return

```typescript
return {
  // ...existing...
  approveReview,
  ignoreReview,
  fixReview,    // 新增
  triggerScan,  // 新增
}
```

## 修复 3: DashboardView — 添加按钮和修改逻辑

文件: `web/src/views/DashboardView.vue`

### 模板变更

**审查队列 section-header — 添加扫描按钮**:
```html
<div class="section-header">
  <div class="section-title">AI 审查队列</div>
  <button class="scan-btn" :disabled="scanning" @click="startScan">
    {{ scanning ? '扫描中...' : '开始扫描' }}
  </button>
</div>
```

**筛选器 — 添加 fixed 选项**:
```html
<option value="all">全部</option>
<option value="pending">待审批</option>
<option value="approved">已批准</option>
<option value="fixed">已修复</option>     <!-- 新增 -->
<option value="ignored">已忽略</option>
```

**审查计数 — 添加 fixed 统计**:
```html
<div class="review-counts">
  待审批: <span>{{ reviewStats.pending }}</span> |
  已批准: <span>{{ reviewStats.approved }}</span> |
  已修复: <span>{{ reviewStats.fixed }}</span> |    <!-- 新增 -->
  已忽略: <span>{{ reviewStats.ignored }}</span>
</div>
```

**批准修复按钮 — 改为调用 fixReview**:
```html
<!-- 修改前 -->
<button class="btn btn-approve" @click.stop="approveReview(review.id)">批准修复</button>

<!-- 修改后 -->
<button class="btn btn-approve" @click.stop="fixReview(review.id)">批准修复</button>
```

**项目信息栏 — 添加分析按钮**:
```html
<div class="project-stats">
  <!-- ... 统计项 ... -->
  <button class="analyze-btn" :disabled="analyzing" @click="startAnalysis">
    {{ analyzing ? '分析中...' : '开始分析' }}
  </button>
</div>
```

### 脚本变更

**新增 ref**:
```typescript
const scanning = ref(false)
const analyzing = ref(false)
```

**新增 import**:
```typescript
import { analysisApi } from '@/api/analysis'
```

**新增 reviewStats fixed 计数**:
```typescript
const reviewStats = computed(() => ({
  pending: reviews.value.filter(r => r.status === 'pending').length,
  approved: reviews.value.filter(r => r.status === 'approved').length,
  fixed: reviews.value.filter(r => r.status === 'fixed').length,     // 新增
  ignored: reviews.value.filter(r => r.status === 'ignored').length,
}))
```

**新增 fixReview 函数**:
```typescript
async function fixReview(id: number) {
  try {
    await dashboardStore.fixReview(props.projectName, id)
  } catch (e) {
    console.error('Fix failed:', e)
  }
}
```

**新增 startScan 函数**:
```typescript
async function startScan() {
  scanning.value = true
  try {
    await dashboardStore.triggerScan(props.projectName)
  } catch (e) {
    console.error('Scan failed:', e)
  } finally {
    scanning.value = false
  }
}
```

**新增 startAnalysis 函数**:
```typescript
async function startAnalysis() {
  analyzing.value = true
  try {
    await analysisApi.triggerFullAnalysis(props.projectName)
  } catch (e) {
    console.error('Analysis failed:', e)
  } finally {
    analyzing.value = false
  }
}
```

### 样式变更

```css
.scan-btn {
  padding: 5px 14px;
  background: #eff6ff;
  color: #3b82f6;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}
.scan-btn:hover { background: #dbeafe; }
.scan-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.analyze-btn {
  padding: 6px 16px;
  background: #7c3aed;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  margin-left: auto;
}
.analyze-btn:hover { background: #6d28d9; }
.analyze-btn:disabled { opacity: 0.5; cursor: not-allowed; }
```

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `web/src/api/dashboard.ts` | 修改 | 添加 triggerScan() 和 fixReview() |
| `web/src/stores/dashboard.ts` | 修改 | 添加 triggerScan 和 fixReview store 方法 |
| `web/src/views/DashboardView.vue` | 修改 | 添加扫描/分析按钮 + 修复 approve 逻辑 + fixed 筛选器 |
