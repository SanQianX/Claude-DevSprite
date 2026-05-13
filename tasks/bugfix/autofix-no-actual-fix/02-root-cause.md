# 02. 根本原因

## 问题

DesignChecker 的 AI prompt 没有明确要求 `file` 字段必须是可修改的代码文件路径。AI 将 `file` 理解为"问题来源的文档"，返回 `"设计文档"` 而非实际代码文件路径。

## 影响链

```
AI 返回 file: "设计文档"
    ↓
DesignChecker 保存 file_path: "设计文档"
    ↓
fix-batch 检查: /\.(ts|tsx|...)$/.test("设计文档") → false
    ↓
isValidFilePath = false → confirmed (不是 fixed)
    ↓
自动修复: 0 个实际修复
```

## 对比：修复前后

| 时期 | AI 返回的 file | fix-batch 结果 |
|------|---------------|---------------|
| 修复前 | `"设计文档"` | 全部 confirmed (0 fixed) |
| 修复后 | `"src/config.ts"` 等 | 正确 fixed |
