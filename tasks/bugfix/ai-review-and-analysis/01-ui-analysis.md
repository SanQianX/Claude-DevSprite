# 01. UI 控件分析

## Dashboard 审查队列组件结构

```
┌─────────────────────────────────────────────────────────────────────┐
│  AI 审查队列                                         [开始扫描]     │
├─────────────────────────────────────────────────────────────────────┤
│  [全部 ▾] [严重性 ▾]  [重置筛选]    待审批: 205 | 已批准: 32 | ...  │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─ review-item ─────────────────────────────────────────────────┐ │
│  │ [Critical] Security: SQL injection in query builder           │ │
│  │ src/utils/query.ts:42                                         │ │
│  │ AI 建议: 使用参数化查询替代字符串拼接                            │ │
│  │ 12:30  [批准修复] [忽略] [讨论] [定位]                          │ │
│  └───────────────────────────────────────────────────────────────┘ │
│  ┌─ review-item ─────────────────────────────────────────────────┐ │
│  │ [Warning] Performance: N+1 query in list handler              │ │
│  │ src/routes/list.ts:87                                         │ │
│  │ AI 建议: 使用 eager loading 或 batch query                     │ │
│  │ 12:25  [批准修复] [忽略] [讨论] [定位]                          │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## 控件清单

| 控件 | 类型 | 功能 | 事件 |
|------|------|------|------|
| `.scan-btn` | button | 触发代码审查扫描 | @click → startScan() |
| `.filter-select` (status) | select | 按状态筛选 (全部/待审批/已批准/已修复/已忽略) | v-model → statusFilter |
| `.filter-select` (severity) | select | 按严重性筛选 (全部/Critical/Warning/Info) | v-model → severityFilter |
| `.filter-reset-btn` | button | 重置筛选条件 | @click → resetFilters() |
| `.review-item` | div | 审查项卡片 | @click → toggleReviewDetail() |
| `.btn-approve` | button | 批准修复 (调用 AI 生成修复) | @click.stop → fixReview() |
| `.btn-ignore` | button | 忽略审查项 | @click.stop → ignoreReview() |
| `.btn-discuss` | button | 跳转到 Chat 讨论 | @click.stop → discussReview() |
| `.btn-locate` | button | 跳转到代码位置 | @click.stop → locateReview() |
| `.review-detail-expanded` | div | 展开的详情面板 | @click.stop |

## Dashboard 项目信息栏

```
┌─────────────────────────────────────────────────────────────────────┐
│  [C] Claude-DevSprite                                               │
│       D:\Claude-DevSprite                                           │
│                          33 文档   120 源文件   1 分析   5月12日     │
│                                                     [开始分析]      │
└─────────────────────────────────────────────────────────────────────┘
```

| 控件 | 类型 | 功能 | 事件 |
|------|------|------|------|
| `.analyze-btn` | button | 触发项目全量分析 | @click → startAnalysis() |
| `.stat-item` | div | 显示项目统计 (文档/源文件/分析次数/上次分析) | 只读 |

## 数据流

```
审查数据流:
DashboardView.onMounted()
    ↓
dashboardStore.fetchAll(projectName)
    ↓
├─ GET /api/projects/:name/tasks  → tasks
└─ GET /api/projects/:name/reviews → reviews
    ↓
filteredReviews computed (statusFilter + severityFilter)
    ↓
DOM 渲染 review-item 列表

扫描触发流:
用户点击 [开始扫描]
    ↓
startScan() → scanning = true
    ↓
dashboardStore.triggerScan(projectName)
    ↓
POST /api/projects/:name/reviews/scan
    ↓
codeReviewer.scanProject() → AI 分析 commits
    ↓
fetchReviews() → 刷新列表
    ↓
scanning = false

修复触发流:
用户点击 [批准修复]
    ↓
fixReview(id) → dashboardStore.fixReview()
    ↓
dashboardApi.fixReview(reviewId)
    ↓
POST /api/reviews/:id/fix
    ↓
codeReviewer.generateFix() → AI 生成修复
    ↓
写入文件 + 更新 status='fixed'
    ↓
reviews 列表更新
```
