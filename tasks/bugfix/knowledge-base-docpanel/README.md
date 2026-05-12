# Bug Fix: DocPanel 文档列表为空 + Markdown 渲染崩溃

## 问题概述
工作区文档面板 (DocPanel) 显示 0 个文档，点击文档后内容无法渲染并报错。

## 修复日期
2026-05-12

## 文件清单

| 文件 | 内容 |
|------|------|
| 01-bug-discovery.md | 问题发现过程 |
| 02-fix-implementation.md | 修复实现 |

## 修复结果
- [x] DocPanel 正确显示 33 个文档
- [x] 文档内容正常渲染 (markdown + source links)
- [x] 无控制台错误

---

# 01. 问题发现过程

## 发现方式: Playwright UI 测试

### 测试脚本
`tasks/tests/test-ui-knowledge.js`

### 测试输出 (修复前)
```
文档数量: 0
文档内容长度: 6
核心错误: 2
  - Failed to load document: TypeError: Cannot read properties of undefined (reading 'parseInline')
```

### 测试输出 (修复后)
```
文档数量: 33
文档内容长度: 659
核心错误: 0
```

## Bug #1: 文档列表为空

**文件**: `web/src/components/workspace/DocPanel.vue` (第 93 行)

**问题代码**:
```javascript
if (data.tree?.children) {
  documents.value = flattenTree(data.tree.children)
}
```

**根本原因**: API `/api/projects/:name/tree` 返回 `{ tree: [...] }` (数组直接在 tree 字段)，但代码检查 `data.tree?.children`，而数组没有 `children` 属性。

**修复**:
```javascript
if (Array.isArray(data.tree)) {
  documents.value = flattenTree(data.tree)
} else if (data.tree?.children) {
  documents.value = flattenTree(data.tree.children)
}
```

---

## Bug #2: Markdown 渲染崩溃

**文件**: `web/src/components/workspace/DocPanel.vue` (第 75-76 行)

**问题代码**:
```javascript
renderer.paragraph = function (tokens: any) {
  let text = this.parser.parseInline(tokens) as string
  // ...
}
```

**根本原因**: marked v12 中 renderer 的 `this` 上下文不再有 `parser` 属性，导致 `this.parser` 为 undefined。

**修复**: 移除自定义 renderer，改为渲染后字符串替换:
```javascript
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

---

# 02. 修复实现

## 文件变更

| 文件 | 修改内容 |
|------|----------|
| `web/src/components/workspace/DocPanel.vue` | 修复 tree 数据解析 + 修复 markdown 渲染 |
| `tasks/tests/test-ui-knowledge.js` | 新增 Playwright UI 测试 |

## 测试验证

| 测试项 | 修复前 | 修复后 | 状态 |
|--------|--------|--------|------|
| 文档列表数量 | 0 | 33 | PASS |
| 文档内容加载 | 崩溃 | 659 chars | PASS |
| 控制台错误 | 2 个 | 0 个 | PASS |
| 文件树侧边栏 | 35 知识/120 源码 | 不变 | PASS |
| 目录展开/折叠 | 正常 | 不变 | PASS |
