# 02. 原始设计逻辑

## 系统架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AI 审查 + 项目分析 架构                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                 │
│  前端                                                          │
│  ├─ DashboardView.vue ─────→ 审查队列 + 项目信息栏                │
│  ├─ ProjectCard.vue ───────→ 分析状态显示                         │
│  └─ AnalysisStore ─────────→ SSE 实时进度                         │
│          │                                                      │
│          ↓                                                      │
│  API 层                                                         │
│  ├─ dashboard.ts ──────────→ 审查 CRUD + 扫描                    │
│  └─ analysis.ts ───────────→ 分析状态 + 触发                      │
│          │                                                      │
│          ↓                                                      │
│  后端                                                          │
│  ├─ routes/reviews.ts ─────→ 审查路由 (scan/approve/ignore/fix)  │
│  ├─ routes/analysis.ts ────→ 分析路由 (full/incremental/status)  │
│  ├─ codeReviewer.ts ───────→ AI 审查引擎                         │
│  └─ analysisTracker.ts ────→ 分析进度追踪 (SSE)                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

## 后端端点设计

### 审查端点

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| GET | `/api/projects/:name/reviews` | 列出审查项 | ✅ 已实现 |
| POST | `/api/projects/:name/reviews/scan` | 触发扫描 | ✅ 已实现 (无 UI 调用) |
| PUT | `/api/reviews/:id/approve` | 批准审查 | ✅ 已实现 |
| PUT | `/api/reviews/:id/ignore` | 忽略审查 | ✅ 已实现 |
| POST | `/api/reviews/:id/fix` | 生成 AI 修复 | ✅ 已实现 (无 UI 调用) |

### 分析端点

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| POST | `/api/projects/:name/analyze/full` | 全量分析 (SSE) | ✅ 已实现 (无 UI 调用) |
| POST | `/api/projects/:name/analyze` | 增量分析 | ✅ 已实现 |
| GET | `/api/projects/:name/analysis-status` | 分析状态 | ✅ 已实现 |
| GET | `/api/projects/:name/analysis-log` | 分析历史 | ✅ 已实现 |

## 前端 API 设计

### dashboard.ts API 客户端 (修复前)

```typescript
export const dashboardApi = {
  // Tasks
  getTasks(projectName)           // ✅
  createTask(projectName, task)   // ✅
  updateTask(projectName, id, updates) // ✅
  deleteTask(projectName, id)     // ✅

  // Reviews
  getReviews(projectName)         // ✅
  createReview(projectName, review) // ✅
  updateReview(projectName, id, updates) // ✅
  deleteReview(projectName, id)   // ✅
  // ❌ 缺少: triggerScan()
  // ❌ 缺少: fixReview()
}
```

### analysis.ts API 客户端 (修复前)

```typescript
export const analysisApi = {
  getAnalysisStatus(projectName)    // ✅
  triggerFullAnalysis(projectName)  // ✅ 已定义但无 UI 调用
}
```

## 设计意图分析

### 审查流程设计意图

```
1. 扫描阶段
   用户点击 [开始扫描]
       ↓
   POST /reviews/scan
       ↓
   CodeReviewer.scanProject()
       ├─ 获取未审查的 git commits
       ├─ 对每个 commit 调用 AI 分析
       └─ 将发现存入 reviews 表
       ↓
   返回发现数量

2. 审批阶段
   用户查看审查项列表
       ↓
   点击 [批准修复]
       ↓
   POST /reviews/:id/fix
       ↓
   CodeReviewer.generateFix()
       ├─ 读取源文件
       ├─ 调用 AI 生成修复
       └─ 写入修复后的内容
       ↓
   更新 status = 'fixed'
```

### 分析流程设计意图

```
1. 触发分析
   用户点击 [开始分析]
       ↓
   POST /analyze/full
       ↓
   AnalysisTracker.startAnalysis()
       ↓
   SSE 广播进度 → ProjectCard 显示 "Analyzing"

2. 分析执行
   6 步流水线:
   ├─ collecting_structure (10%)
   ├─ collecting_source_files (25%)
   ├─ collecting_knowledge (40%)
   ├─ building_prompt (55%)
   ├─ calling_ai (75%)
   └─ writing_documents (90%)
       ↓
   AnalysisTracker.completeAnalysis()
       ↓
   SSE 广播完成 → ProjectCard 更新状态
```

## 问题总结

| 功能 | 后端 | 前端 API | 前端 UI | 状态 |
|------|------|----------|---------|------|
| 审查列表 | ✅ | ✅ | ✅ | 正常 |
| 审查扫描 | ✅ | ❌ 无方法 | ❌ 无按钮 | **断裂** |
| 批准修复 | ✅ | ❌ 无方法 | ⚠️ 只设状态 | **断裂** |
| 忽略审查 | ✅ | ✅ | ✅ | 正常 |
| 项目分析 | ✅ | ✅ | ❌ 无按钮 | **断裂** |
| 分析状态 | ✅ | ✅ | ✅ | 正常 |
