# 02. 修复实现

## 修复 1: 文档列表为空

文件: `web/src/components/workspace/DocPanel.vue` (第 87-91 行)

### 修改前

```javascript
if (data.tree?.children) {
  documents.value = flattenTree(data.tree.children)
}
```

### 修改后

```javascript
if (Array.isArray(data.tree)) {
  documents.value = flattenTree(data.tree)
} else if (data.tree?.children) {
  documents.value = flattenTree(data.tree.children)
}
```

### 说明

添加 `Array.isArray(data.tree)` 检查，兼容 API 返回数组的情况。保留原有的 `.children` 检查作为 fallback。

---

## 修复 2: Markdown 渲染崩溃

文件: `web/src/components/workspace/DocPanel.vue`

### 修改前

```javascript
import { Marked, Renderer } from 'marked'

const renderer = new Renderer()
renderer.paragraph = function (tokens: any) {
  let text = this.parser.parseInline(tokens) as string
  // 自定义处理...
  return `<p>${text}</p>`
}
const localMarked = new Marked({ renderer })
```

### 修改后

```javascript
import { Marked } from 'marked'

const localMarked = new Marked()

function processSourceLinks(html: string): string {
  return html.replace(
    /\[source:([^\]]+?):(\d+)\]/g,
    '<a class="source-link" data-path="$1" data-line="$2" href="#">📍 $1:$2</a>'
  )
}

// 使用时:
const rawHtml = localMarked.parse(data.content) as string
renderedContent.value = DOMPurify.sanitize(processSourceLinks(rawHtml))
```

### 说明

1. 移除自定义 Renderer (marked v12 不再支持 `this.parser`)
2. 改用默认 Marked 实例
3. 用后处理字符串替换函数 `processSourceLinks()` 替代 renderer 钩子
4. 保持 DOMPurify XSS 防护

---

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `web/src/components/workspace/DocPanel.vue` | 修改 | 修复 tree 数据解析 + 修复 markdown 渲染 |
| `tasks/tests/test-ui-knowledge.js` | 新增 | Playwright UI 测试 |

## 测试验证

| 测试项 | 修复前 | 修复后 | 状态 |
|--------|--------|--------|------|
| 文档列表数量 | 0 | 33 | PASS |
| 文档内容加载 | 崩溃 | 659 chars | PASS |
| 控制台错误 | 2 个 | 0 个 | PASS |
| 文件树侧边栏 | 35 知识/120 源码 | 不变 | PASS |
| 目录展开/折叠 | 正常 | 不变 | PASS |
