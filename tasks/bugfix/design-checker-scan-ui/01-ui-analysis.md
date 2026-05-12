# 01. UI 控件分析

## Dashboard 审查队列组件结构 (修复后)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  AI 审查队列     [✓ 定时扫描] [10 分钟 ▾]               [开始扫描]       │
├─────────────────────────────────────────────────────────────────────────┤
│  [全部 ▾] [严重性 ▾]  [重置筛选]    待审批: 5 | 已批准: 0 | ...        │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─ review-item ──────────────────────────────────────────────────────┐ │
│  │ [Critical] missing-impl: 设计文档描述的功能未在代码中实现            │ │
│  │ src/routes/api.ts:0                                                │ │
│  │ AI 建议: 在代码中实现该功能                                         │ │
│  │ 5月13日  [批准修复] [忽略] [讨论] [定位]                            │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## 控件清单

| 控件 | 类型 | 功能 | 事件 |
|------|------|------|------|
| `.scan-toggle input` | checkbox | 启用/禁用定时扫描 | @change → toggleAutoScan() |
| `.scan-toggle-label` | span | 显示"定时扫描"文字 | 只读 |
| `.scan-interval-select` | select | 选择扫描间隔 (5/10/15/30/60 分钟) | @change → updateScanInterval() |
| `.scan-btn` | button | 手动触发一次性扫描 | @click → startScan() |
| `.filter-select` (status) | select | 按状态筛选 | v-model → statusFilter |
| `.filter-select` (severity) | select | 按严重性筛选 | v-model → severityFilter |
| `.filter-reset-btn` | button | 重置筛选条件 | @click → resetFilters() |
| `.review-item` | div | 审查项卡片 | @click → toggleReviewDetail() |
| `.btn-approve` | button | 批准修复 | @click.stop → fixReview() |
| `.btn-ignore` | button | 忽略审查项 | @click.stop → ignoreReview() |
| `.btn-discuss` | button | 跳转到 Chat 讨论 | @click.stop → discussReview() |
| `.btn-locate` | button | 跳转到代码位置 | @click.stop → locateReview() |

## 新增控件布局

```
.section-header
├─ .section-title "AI 审查队列"
└─ .scan-controls
   ├─ .scan-toggle
   │  ├─ input[type=checkbox]  (v-model: autoScanEnabled)
   │  └─ .scan-toggle-label "定时扫描"
   ├─ .scan-interval-select    (v-if: autoScanEnabled, v-model: scanIntervalMinutes)
   │  ├─ option value=5  "5 分钟"
   │  ├─ option value=10 "10 分钟"
   │  ├─ option value=15 "15 分钟"
   │  ├─ option value=30 "30 分钟"
   │  └─ option value=60 "1 小时"
   └─ .scan-btn               (:disabled: scanning)
```

## 数据流

```
扫描配置流:
DashboardView.onMounted()
    ↓
dashboardStore.fetchScannerConfig()
    ↓
GET /api/scanner/config
    ↓
{ enabled: true, intervalMs: 600000, isScanning: false }
    ↓
autoScanEnabled = true
scanIntervalMinutes = 10

定时扫描配置流:
用户切换 [定时扫描] checkbox
    ↓
toggleAutoScan()
    ↓
dashboardStore.updateScannerConfig({ enabled: true/false })
    ↓
PUT /api/scanner/config
    ↓
DesignChecker.updateConfig({ enabled })
    ↓
stopScanner() + startScanner() (如启用)

扫描间隔配置流:
用户选择 [10 分钟 ▾]
    ↓
updateScanInterval()
    ↓
dashboardStore.updateScannerConfig({ intervalMs: 600000 })
    ↓
PUT /api/scanner/config
    ↓
DesignChecker.updateConfig({ intervalMs: 600000 })
    ↓
stopScanner() + startScanner() (新间隔)

手动扫描流:
用户点击 [开始扫描]
    ↓
startScan() → scanning = true
    ↓
dashboardStore.triggerScan(projectName)
    ↓
POST /api/projects/:name/reviews/scan
    ↓
DesignChecker.scanProject()
    ├─ 收集设计文档 (tasks/*.md)
    ├─ 收集知识库文档 (KnowledgeBaseManager)
    ├─ 收集源代码文件 (src/, web/src/)
    ├─ 组装 AI prompt
    ├─ 调用 AI 分析
    └─ 写入 reviews 表 (source='design-check')
    ↓
fetchReviews() → 刷新列表
    ↓
scanning = false
```
