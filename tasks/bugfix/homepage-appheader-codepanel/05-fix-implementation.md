# 05. 修复实现过程

## 修复架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        修复后架构                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                 │
│  修复 1: HomePage 表格列对齐                                      │
│  ┌──────────────────────────────────────────────────┐             │
│  │  <thead>                                          │             │
│  │    <th>项目名称</th>                               │             │
│  │    <th>仓库类型</th>                               │             │
│  │    <th>Docs</th>           ← 新增                 │             │
│  │    <th>最近更新</th>                               │             │
│  │    <th>状态</th>                                   │             │
│  │    <th></th>                                       │             │
│  │  </thead>                                         │             │
│  │  6 个 <th> === 6 个 <td>  ✅                      │             │
│  └──────────────────────────────────────────────────┘             │
│                                                                 │
│  修复 2: AppHeader SSE 生命周期                                   │
│  ┌──────────────────────────────────────────────────┐             │
│  │  // 修复前                                        │             │
│  │  onMounted → connectSSE()                         │             │
│  │  onUnmounted → disconnectSSE()  ← 移除            │             │
│  │                                                   │             │
│  │  // 修复后                                        │             │
│  │  onMounted → connectSSE()                         │             │
│  │  // SSE 连接由 Store 管理，不随组件销毁             │             │
│  └──────────────────────────────────────────────────┘             │
│                                                                 │
│  修复 3: CodePanel 竞态控制                                       │
│  ┌──────────────────────────────────────────────────┐             │
│  │  const fileRequestCounter = ref(0)                │             │
│  │                                                   │             │
│  │  selectFile(node) {                               │             │
│  │    const reqId = ++fileRequestCounter.value       │             │
│  │    // ... fetch ...                               │             │
│  │    if (reqId === fileRequestCounter.value) {      │             │
│  │      // 只有最新请求才更新 UI                      │             │
│  │    }                                              │             │
│  │  }                                                │             │
│  └──────────────────────────────────────────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

## 修复 1: HomePage 表格 — 添加缺失列头

文件: `web/src/views/HomePage.vue`

### 模板变更

```html
<!-- 修改前 (第 44-51 行) -->
<thead>
  <tr>
    <th style="width:32%">{{ t('home.title') }}</th>
    <th style="width:8%">{{ t('project.repoType') }}</th>
    <th style="width:22%">{{ t('project.lastUpdate') }}</th>
    <th style="width:12%;text-align:center">{{ t('project.status') }}</th>
    <th style="width:8%"></th>
  </tr>
</thead>

<!-- 修改后 -->
<thead>
  <tr>
    <th style="width:32%">{{ t('home.title') }}</th>
    <th style="width:8%">{{ t('project.repoType') }}</th>
    <th style="width:8%;text-align:center">{{ t('project.docs') || 'Docs' }}</th>
    <th style="width:22%">{{ t('project.lastUpdate') }}</th>
    <th style="width:12%;text-align:center">{{ t('project.status') }}</th>
    <th style="width:8%"></th>
  </tr>
</thead>
```

### 变更说明

- 在"仓库类型"和"最近更新"之间插入了新的 `<th>` 列头
- 使用 `{{ t('project.docs') || 'Docs' }}` 支持国际化，回退到 "Docs"
- 居中对齐 (`text-align:center`) 与 ProjectCard 的 docs 列保持一致
- 宽度设为 8%，相应调整"最近更新"列宽度

---

## 修复 2: AppHeader — 移除 SSE 断开逻辑

文件: `web/src/components/layout/AppHeader.vue`

### 脚本变更

```typescript
// 修改前
import { ref, onMounted, onUnmounted } from 'vue'

onMounted(() => {
  analysisStore.connectSSE()
})

onUnmounted(() => {
  analysisStore.disconnectSSE()
})

// 修改后
import { ref, onMounted } from 'vue'

onMounted(() => {
  analysisStore.connectSSE()
})

// Don't disconnect SSE on unmount — the store is global and the connection
// should persist across page navigations. connectSSE() already handles
// closing any existing connection before creating a new one.
```

### 变更说明

- 移除了 `onUnmounted` 导入
- 移除了 `onUnmounted` 钩子及其 `disconnectSSE()` 调用
- 添加注释说明设计意图
- SSE 连接现在完全由 Store 管理，`connectSSE()` 的幂等性保证了重复调用的安全性

---

## 修复 3: CodePanel — 添加请求计数器防止竞态

文件: `web/src/components/workspace/CodePanel.vue`

### 新增 ref

```typescript
const fileRequestCounter = ref(0)
```

### selectFile 函数修改

```typescript
// 修改前
async function selectFile(node: TreeNode) {
  currentFile.value = node
  highlightedLine.value = 0
  emit('fileSelect', node.path)
  loadingFile.value = true

  try {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(props.projectName)}/source-file?path=${encodeURIComponent(node.path)}`
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.content) {
      codeContent.value = data.content
      codeLines.value = data.content.split('\n')
      fetchRelatedDocs(node.path)
    }
  } catch (err) {
    console.error('Failed to load file:', err)
    codeContent.value = '// 加载文件失败'
    codeLines.value = ['// 加载文件失败']
  } finally {
    loadingFile.value = false
  }
}

// 修改后
async function selectFile(node: TreeNode) {
  const reqId = ++fileRequestCounter.value
  currentFile.value = node
  highlightedLine.value = 0
  emit('fileSelect', node.path)
  loadingFile.value = true

  try {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(props.projectName)}/source-file?path=${encodeURIComponent(node.path)}`
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.content && reqId === fileRequestCounter.value) {
      codeContent.value = data.content
      codeLines.value = data.content.split('\n')
      fetchRelatedDocs(node.path)
    }
  } catch (err) {
    if (reqId === fileRequestCounter.value) {
      console.error('Failed to load file:', err)
      codeContent.value = '// 加载文件失败'
      codeLines.value = ['// 加载文件失败']
    }
  } finally {
    if (reqId === fileRequestCounter.value) {
      loadingFile.value = false
    }
  }
}
```

### loadFile 函数修改

```typescript
// 修改后 (添加竞态保护)
async function loadFile(filePath: string, line: number = 0) {
  const reqId = ++fileRequestCounter.value
  loadingFile.value = true
  try {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(props.projectName)}/source-file?path=${encodeURIComponent(filePath)}`
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.content && reqId === fileRequestCounter.value) {
      const node = findNodeInTree(tree.value, filePath)
      currentFile.value = node || { name: filePath.split('/').pop() || filePath, path: filePath, type: 'file' }
      codeContent.value = data.content
      codeLines.value = data.content.split('\n')
      highlightedLine.value = line
      emit('fileSelect', filePath)

      if (line > 0) {
        await nextTick()
        scrollToLine(line)
      }

      fetchRelatedDocs(filePath)
    }
  } catch (err) {
    if (reqId === fileRequestCounter.value) {
      console.error('Failed to load file:', err)
      codeContent.value = '// 加载文件失败'
      codeLines.value = ['// 加载文件失败']
    }
  } finally {
    if (reqId === fileRequestCounter.value) {
      loadingFile.value = false
    }
  }
}
```

### 变更说明

- 每次调用 `selectFile` 或 `loadFile` 前递增 `fileRequestCounter`
- 保存当前请求 ID 到局部变量 `reqId`
- 在更新 UI 前检查 `reqId === fileRequestCounter.value`
- 只有最新请求的结果才会更新 UI
- 错误处理和 loading 状态也受保护

---

## 文件变更清单

| 文件 | 操作 | 说明 | 变更量 |
|------|------|------|--------|
| `web/src/views/HomePage.vue` | 修改 | 添加缺失的 Docs `<th>` 列头 | +1 行 |
| `web/src/components/layout/AppHeader.vue` | 修改 | 移除 onUnmounted disconnectSSE + 注释 | -3 行, +2 注释 |
| `web/src/components/workspace/CodePanel.vue` | 修改 | 添加 fileRequestCounter 防竞态 | +12 行 |
