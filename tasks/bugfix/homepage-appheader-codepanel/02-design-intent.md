# 02. 原始设计逻辑

## 系统架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        前端导航 + 数据流架构                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                 │
│  路由层                                                         │
│  ├─ / ──────────────→ HomePage.vue                              │
│  ├─ /project/:name ──→ ProjectLayout.vue                        │
│  │     ├─ tab=dashboard ──→ DashboardView.vue                   │
│  │     ├─ tab=knowledge ──→ KnowledgeBaseView.vue               │
│  │     └─ tab=source ─────→ CodePanel.vue                       │
│  └─ /settings ───────→ SettingsView.vue                         │
│                                                                 │
│  全局组件 (每个页面都有)                                          │
│  ├─ AppHeader.vue ─────→ 搜索 + 语言 + 主题 + SSE 指示器         │
│  └─ ConsolePanel.vue ──→ 日志控制台                              │
│                                                                 │
│  Store 层 (全局单例)                                             │
│  ├─ analysisStore ─────→ SSE 连接 + 分析状态                     │
│  ├─ projectsStore ─────→ 项目列表 CRUD                          │
│  ├─ dashboardStore ────→ 审查/任务数据                           │
│  └─ uiStore ───────────→ 主题/语言/布局                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

## HomePage 表格设计

### ProjectCard 组件输出 (6 列)

```html
<!-- web/src/components/home/ProjectCard.vue -->
<tr>
  <td>项目名 + 路径</td>         <!-- 列 1: 项目名称 -->
  <td>Git / GitHub</td>          <!-- 列 2: 仓库类型 -->
  <td>33</td>                    <!-- 列 3: 文档数量 (居中) -->
  <td>2026-05-12 22:00</td>      <!-- 列 4: 最近更新 -->
  <td>● 正常 / ● Analyzing</td>  <!-- 列 5: 状态 (居中) -->
  <td>[分析] [删除]</td>         <!-- 列 6: 操作按钮 -->
</tr>
```

### 设计意图: 6 列头对齐 6 列数据

```
HomePage.vue <thead>:
  <th>项目名称</th>     → 对齐 ProjectCard 列 1
  <th>仓库类型</th>     → 对齐 ProjectCard 列 2
  <th>Docs</th>         → 对齐 ProjectCard 列 3 (文档数量)
  <th>最近更新</th>     → 对齐 ProjectCard 列 4
  <th>状态</th>         → 对齐 ProjectCard 列 5
  <th></th>             → 对齐 ProjectCard 列 6 (操作按钮)
```

---

## AppHeader SSE 设计

### SSE 连接管理设计意图

```
设计原则: SSE 连接是全局资源，应在 Store 层管理，不应随组件生命周期销毁

正确流程:
  App.onMounted → analysisStore.connectSSE() → 建立连接
      ↓
  页面 A → 页面 B → 页面 C (SSE 连接始终存活)
      ↓
  App.onUnmounted → analysisStore.disconnectSSE() → 应用退出时断开

错误流程 (修复前):
  AppHeader-A.onMounted → connectSSE()
      ↓
  导航到页面 B
      ↓
  AppHeader-A.onUnmounted → disconnectSSE()  ← 错误！
      ↓
  AppHeader-B.onMounted → connectSSE()  ← 重新建立 (浪费)
```

### Store 设计

```typescript
// web/src/stores/analysis.ts
export const useAnalysisStore = defineStore('analysis', () => {
  const eventSource = ref<EventSource | null>(null)

  function connectSSE() {
    if (eventSource.value) {
      eventSource.value.close()  // 关闭旧连接 (幂等)
    }
    eventSource.value = new EventSource('/api/analysis/sse')
    // ...
  }

  function disconnectSSE() {
    eventSource.value?.close()
    eventSource.value = null
  }

  return { connectSSE, disconnectSSE, isRunning, currentProject, stepLabel }
})
```

**关键**: `connectSSE()` 内部已经有关闭旧连接的逻辑，所以重复调用是安全的。

---

## CodePanel 文件加载设计

### 原始设计

```
selectFile(node)
    ↓
fileRequestCounter++           ← 防止竞态 (每请求递增)
    ↓
loadingFile = true
    ↓
fetch(/source-file?path=...)
    ↓
检查 reqId === fileRequestCounter  ← 如果不是最新请求则丢弃结果
    ↓
如果匹配: currentFile = node, codeLines = content.split('\n')
如果不匹配: 忽略响应
    ↓
loadingFile = false (仅当 reqId 匹配)
```

### highlightedLine 重置设计

```typescript
// selectFile 中必须重置高亮行
function selectFile(node: TreeNode) {
  currentFile.value = node
  highlightedLine.value = 0  // ← 必须重置，否则旧文件的高亮行会残留
  // ...
}
```

---

## 数据流总结

```
┌─────────────────────────────────────────────────────────────────────┐
│                        三个组件的数据流                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                 │
│  HomePage:                                                       │
│  projectsStore.fetchProjects()                                   │
│      ↓                                                           │
│  GET /api/projects → projects[]                                  │
│      ↓                                                           │
│  <table> 渲染 ProjectCard                                        │
│      ↓                                                           │
│  ⚠️ 列头/列数据必须对齐                                          │
│                                                                 │
│  AppHeader:                                                      │
│  analysisStore.connectSSE()                                      │
│      ↓                                                           │
│  EventSource('/api/analysis/sse')                                │
│      ↓                                                           │
│  SSE 消息 → isRunning, currentProject, stepLabel                 │
│      ↓                                                           │
│  ⚠️ 连接不应随组件销毁                                            │
│                                                                 │
│  CodePanel:                                                      │
│  selectFile(node)                                                │
│      ↓                                                           │
│  fileRequestCounter++ → fetch → 检查 counter                     │
│      ↓                                                           │
│  ⚠️ 必须防止竞态条件                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────────┘
```
