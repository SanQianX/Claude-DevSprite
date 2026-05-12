# 03. 问题发现过程

## 发现时间
2026-05-12

## 发现方式
Playwright UI 测试 + 代码审查

## 问题 #1: HomePage 表格列头与数据列不匹配 (High)

### 排查步骤

**Step 1: 检查 HomePage 模板中的 `<thead>`**

文件: `web/src/views/HomePage.vue`

```html
<!-- 修复前 (第 44-51 行) -->
<thead>
  <tr>
    <th style="width:32%">{{ t('home.title') }}</th>
    <th style="width:8%">{{ t('project.repoType') }}</th>
    <th style="width:22%">{{ t('project.lastUpdate') }}</th>
    <th style="width:12%;text-align:center">{{ t('project.status') }}</th>
    <th style="width:8%"></th>
  </tr>
</thead>
```

**发现**: 只有 5 个 `<th>` 列头。

**Step 2: 检查 ProjectCard 组件的 `<td>` 输出**

文件: `web/src/components/home/ProjectCard.vue`

```html
<tr>
  <td>项目名 + 路径</td>
  <td>Git / GitHub</td>
  <td style="text-align:center">{{ project.docCount || 0 }}</td>  <!-- Docs 列 -->
  <td>{{ formatDate(project.lastUpdate) }}</td>
  <td style="text-align:center">● 状态</td>
  <td>操作按钮</td>
</tr>
```

**发现**: ProjectCard 输出 6 个 `<td>` 单元格，但 `<thead>` 只有 5 个 `<th>`。

**Step 3: 确认错位影响**

| `<th>` | `<td>` | 实际显示 |
|--------|--------|----------|
| 项目名称 | 项目名 + 路径 | ✅ 正确 |
| 仓库类型 | Git / GitHub | ✅ 正确 |
| 最近更新 | **Doc 数量 (33)** | ❌ 标题是"最近更新"但显示的是文档数 |
| 状态 | **更新时间** | ❌ 标题是"状态"但显示的是时间 |
| (空) | **分析状态** | ❌ 没有对应的列头 |
| (缺失) | 操作按钮 | ❌ 多出一列没有列头 |

**确认**: 缺少 "Docs" 列头导致整个表格从第 3 列开始全部错位。

**Step 4: 全局搜索确认**

搜索 `project.docs`、`docCount`、`Docs` — 在 ProjectCard 中找到 `docCount` 的渲染。

**确认**: ProjectCard 设计时就包含了 Docs 列，但 HomePage 的 `<thead>` 在某次重构中遗漏了该列头。

---

## 问题 #2: AppHeader 在页面导航时断开全局 SSE 连接 (High)

### 排查步骤

**Step 1: 检查 AppHeader 生命周期**

文件: `web/src/components/layout/AppHeader.vue`

```typescript
import { ref, onMounted, onUnmounted } from 'vue'
// ...

onMounted(() => {
  analysisStore.connectSSE()
})

onUnmounted(() => {
  analysisStore.disconnectSSE()  // ← 问题所在
})
```

**发现**: `onUnmounted` 中调用了 `disconnectSSE()`。

**Step 2: 分析 Vue 3 组件生命周期**

```
用户从 HomePage 导航到 ProjectPage:
  1. ProjectPage 的 AppHeader.onMounted() → connectSSE() ← 新连接建立
  2. HomePage 的 AppHeader.onUnmounted() → disconnectSSE() ← 旧连接断开

⚠️ Vue 3 中，新组件先 mount，旧组件后 unmount!
```

**发现**: 由于 Vue 3 的生命周期顺序 (先 mount 新组件，后 unmount 旧组件)，旧 AppHeader 的 `disconnectSSE()` 会断开新 AppHeader 刚建立的连接。

**Step 3: 检查 SSE 连接管理**

文件: `web/src/stores/analysis.ts`

```typescript
function connectSSE() {
  if (eventSource.value) {
    eventSource.value.close()  // 关闭旧连接
  }
  eventSource.value = new EventSource('/api/analysis/sse')
  // ...
}

function disconnectSSE() {
  eventSource.value?.close()
  eventSource.value = null
}
```

**发现**: `connectSSE()` 已经内置了关闭旧连接的逻辑，所以 `disconnectSSE()` 在 `onUnmounted` 中是多余的，且有害的。

**Step 4: 验证影响**

- 导航后 SSE 连接会短暂中断然后重新建立
- 在中断期间，分析进度状态会丢失 (isRunning 变为 false)
- 如果分析正在运行，指示器会闪烁

**确认**: SSE 连接在每次页面导航时都会被错误断开并重建。

---

## 问题 #3: CodePanel 快速切换文件时的竞态条件 (High)

### 排查步骤

**Step 1: 检查 selectFile 函数**

文件: `web/src/components/workspace/CodePanel.vue`

```typescript
async function selectFile(node: TreeNode) {
  currentFile.value = node  // 立即更新 UI
  loadingFile.value = true

  const res = await fetch(`/api/projects/.../source-file?path=${node.path}`)
  const data = await res.json()

  if (data.content) {
    codeContent.value = data.content
    codeLines.value = data.content.split('\n')
  }

  loadingFile.value = false
}
```

**发现**: 没有任何机制防止旧请求的结果覆盖新请求的结果。

**Step 2: 模拟竞态场景**

```
时间线:
  T0: 用户点击 file-a → fetch(file-a) 开始
  T1: 用户点击 file-b → fetch(file-b) 开始
  T2: fetch(file-b) 完成 → 显示 file-b 内容 ✅
  T3: fetch(file-a) 完成 → 覆盖为 file-a 内容 ❌ (应该被丢弃)
```

**发现**: 如果 file-a 的请求比 file-b 慢完成，file-a 的内容会覆盖 file-b 的内容，导致显示错误。

**Step 3: 检查 loadFile 函数 (由 highlightPath 触发)**

```typescript
async function loadFile(filePath: string, line: number = 0) {
  // 也没有竞态保护
  const res = await fetch(...)
  const data = await res.json()
  // 直接更新状态
}
```

**发现**: `loadFile` 也没有竞态保护。当 `highlightPath` prop 快速变化时，同样会出现竞态。

**Step 4: 检查 fileRequestCounter 是否存在**

搜索 `fileRequestCounter`、`requestId`、`reqId` — 零结果 (修复前)。

**确认**: 整个组件没有任何请求计数器或取消机制。

---

## 问题总结

| # | 问题 | 严重性 | 根本原因 | 影响 |
|---|------|--------|----------|------|
| 1 | 表格列头/数据不匹配 | High | 缺少 Docs 列头 | 表格从第 3 列起全部错位 |
| 2 | SSE 连接导航断开 | High | onUnmounted 调用 disconnectSSE | 分析状态闪烁/丢失 |
| 3 | 文件切换竞态条件 | High | 无请求计数器/取消机制 | 显示错误文件内容 |
