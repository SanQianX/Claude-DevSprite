# 01. 问题发现过程

## 发现时间
2026-05-12

## 发现方式
Playwright UI 测试

## 测试脚本
`tasks/tests/test-ui-knowledge.js`

## 问题 #1: 文档列表为空

### 测试输出 (修复前)
```
文档数量: 0
文档内容长度: 6
核心错误: 2
  - Failed to load document: TypeError: Cannot read properties of undefined (reading 'parseInline')
```

### 排查步骤

**Step 1: 检查 API 响应**

```bash
curl http://127.0.0.1:38888/api/projects/Claude-DevSprite/tree
```

**返回**:
```json
{
  "tree": [
    { "type": "file", "path": "knowledge/changelog/20240101.md", "name": "20240101.md" },
    { "type": "dir", "path": "knowledge/changelog", "name": "changelog", "children": [...] },
    ...
  ]
}
```

**发现**: `data.tree` 是一个数组，直接包含文件和目录节点。

**Step 2: 检查前端代码**

文件: `web/src/components/workspace/DocPanel.vue` (第 93 行)

```javascript
if (data.tree?.children) {
  documents.value = flattenTree(data.tree.children)
}
```

**发现**: 代码检查 `data.tree?.children`，但 `data.tree` 是数组，数组没有 `children` 属性。

**根本原因**: API 返回 `{ tree: [...] }` (数组直接在 tree 字段)，但代码期望 `{ tree: { children: [...] } }` (对象包裹)。

---

## 问题 #2: Markdown 渲染崩溃

### 错误信息
```
TypeError: Cannot read properties of undefined (reading 'parseInline')
```

### 排查步骤

**Step 1: 检查渲染代码**

文件: `web/src/components/workspace/DocPanel.vue` (第 75-76 行)

```javascript
renderer.paragraph = function (tokens: any) {
  let text = this.parser.parseInline(tokens) as string
  // ...
}
```

**Step 2: 检查 marked 版本**

```bash
cat web/package.json | grep marked
```

**发现**: 使用 marked v12。

**Step 3: 检查 marked v12 API 变化**

marked v12 中，renderer 的 `this` 上下文不再有 `parser` 属性。`this.parser` 为 undefined。

**根本原因**: marked v12 breaking change — renderer 回调的 `this` 上下文不再包含 `parser`。

## 问题总结

| # | 问题 | 根本原因 | 影响 |
|---|------|----------|------|
| 1 | 文档列表为空 | API 返回数组但代码检查 .children | 用户看不到任何文档 |
| 2 | Markdown 渲染崩溃 | marked v12 renderer API 变化 | 点击文档报错 |
