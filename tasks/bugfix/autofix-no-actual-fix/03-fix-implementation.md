# 03. 修复实现

## 修复方案

两层防御：

### 1. 改进 AI Prompt（第一层）

在 prompt 中明确要求 `file` 字段必须是代码文件路径：

```
【重要】file 字段要求：
- file 必须是上面"实际代码"部分中出现的一个源代码文件路径
- file 必须指向需要修改的源代码文件，不能是"设计文档"等文档名称
- 如果问题纯属设计层面、没有对应的代码文件可修改，将 file 设为空字符串 ""
```

### 2. 文件路径推断（第二层）

即使 AI 仍返回无效路径，后处理会推断正确路径：

```typescript
// 扫描后验证每个 finding 的 file_path
const validFilePaths = new Set(sourceFiles.map(f => f.relativePath));
for (const finding of result.findings) {
  if (finding.file && !validFilePaths.has(finding.file)) {
    const inferred = this.inferFilePath(finding.file, finding.title, finding.description, sourceFiles);
    if (inferred) {
      finding.file = inferred;  // "设计文档" → "src/worker/routes/reviews.ts"
    } else {
      finding.file = '';  // 无法推断 → 空路径 → confirmed
    }
  }
}
```

### inferFilePath 优先级匹配

| 优先级 | 匹配规则 | 示例 |
|--------|---------|------|
| 1 | DesignChecker 关键词 | `designcheck` → `designChecker.ts` |
| 2 | 审查+端点/路由 | `审查+端点` → `routes/reviews.ts` |
| 3 | 聊天+端点/路由 | `聊天+端点` → `routes/teams.ts` |
| 4 | 任务+状态/dashboard | `任务+状态` → `stores/dashboard.ts` |
| 5 | 通用关键词 | `配置` → `config.ts` |
| 6 | 部分路径匹配 | `reviews.ts` → `src/worker/routes/reviews.ts` |

## 修改文件

| 文件 | 变更 |
|------|------|
| `src/analyzer/designChecker.ts` | prompt 改进 + file path 验证 + inferFilePath 方法 |
