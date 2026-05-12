# 07. 总结与改进

## 修复总结

本次修复解决了 3 个 High 级别的前端缺陷，涵盖表格布局、全局连接管理和异步竞态控制。

### 修复统计

| 指标 | 值 |
|------|-----|
| 修复问题数 | 3 |
| 修改文件数 | 3 |
| 新增代码行 | ~12 |
| 删除代码行 | ~3 |
| 测试用例 | 7 (全部通过) |
| 控制台错误 | 0 |

## 问题分类

### 缺陷模式

| 模式 | 问题 | 修复方式 |
|------|------|----------|
| 组件契约不一致 | HomePage 5 列头 vs ProjectCard 6 列数据 | 添加缺失列头 |
| 资源归属错误 | AppHeader onUnmounted 断开 Store 级 SSE | 移除组件级断开 |
| 并发控制缺失 | CodePanel 无请求版本检查 | 添加 fileRequestCounter |

### 代码变更方向

| 方向 | 变更量 | 说明 |
|------|--------|------|
| 增加 | +12 行 | fileRequestCounter 逻辑 + 注释 |
| 删除 | -3 行 | onUnmounted disconnectSSE |
| 修改 | 1 行 | 添加 Docs `<th>` |

## 改进建议

### 1. 表格组件类型安全

当前 ProjectCard 的列数由模板决定，没有类型约束。建议：

```typescript
// 定义列配置接口
interface ProjectTableColumn {
  key: string
  header: string
  width: string
  align?: 'left' | 'center'
}

// 在 HomePage 和 ProjectCard 共享列配置
const columns: ProjectTableColumn[] = [
  { key: 'name', header: t('home.title'), width: '32%' },
  { key: 'repoType', header: t('project.repoType'), width: '8%' },
  { key: 'docs', header: 'Docs', width: '8%', align: 'center' },
  // ...
]
```

### 2. SSE 连接生命周期管理

当前 SSE 连接由 `connectSSE()` 的幂等性保证安全，但缺少明确的"谁负责断开"语义。建议：

```typescript
// 在 App.vue 中管理 SSE 生命周期
onMounted(() => {
  analysisStore.connectSSE()
})

onUnmounted(() => {
  analysisStore.disconnectSSE()  // 只在应用级组件中断开
})
```

### 3. 异步请求通用化

当前 CodePanel 的竞态控制是手写的。建议提取为通用 composable：

```typescript
// composables/useCancellableFetch.ts
export function useCancellableFetch() {
  const counter = ref(0)

  async function fetchWithCancel<T>(url: string): Promise<{ data: T | null; valid: boolean }> {
    const reqId = ++counter.value
    try {
      const res = await fetch(url)
      const data = await res.json()
      return { data, valid: reqId === counter.value }
    } catch {
      return { data: null, valid: reqId === counter.value }
    }
  }

  return { fetchWithCancel }
}
```

### 4. 视觉回归测试

建议添加 Playwright screenshot comparison 测试：

```javascript
// 验证表格布局
await page.goto('/')
await page.screenshot({ path: 'snapshots/home-table.png' })
// 与基准截图对比，检测列错位
```

## 与之前修复对比

| 维度 | ai-review-and-analysis | homepage-appheader-codepanel |
|------|------------------------|------------------------------|
| 问题类型 | UI 断裂 (API 未连接) | 组件逻辑缺陷 |
| 修复范围 | 3 个功能 (扫描/修复/分析) | 3 个组件 (表格/连接/竞态) |
| 后端变更 | 无 | 无 |
| 前端变更 | API + Store + View | View + Component |
| 根因模式 | API 缺失/错误调用 | 生命周期/并发控制 |
| 修复复杂度 | 中等 (添加 API 链) | 低 (单点修复) |

## 最终状态

```
修复前:
  HomePage 表格: 5 列头 ≠ 6 列数据 → 布局错位
  AppHeader SSE: onUnmounted 断开 → 导航时连接中断
  CodePanel: 无竞态保护 → 快速切换显示错误文件

修复后:
  HomePage 表格: 6 列头 = 6 列数据 → 布局正确
  AppHeader SSE: Store 管理生命周期 → 连接持续存活
  CodePanel: fileRequestCounter → 始终显示最新文件
```
