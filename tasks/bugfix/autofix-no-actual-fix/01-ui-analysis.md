# 01. UI 控件分析

## 自动修复完整数据流

```
用户勾选"自动修复" → 点击"开始扫描"
    ↓
startScan()
    ├─ 1. 记录 oldPendingIds
    ├─ 2. triggerScan() → POST /reviews/scan
    │       ↓
    │   DesignChecker.scanProject()
    │       ├─ 收集设计文档 (tasks/*.md)
    │       ├─ 收集知识库文档
    │       ├─ 收集源代码文件 (src/, web/src/)
    │       ├─ 组装 AI prompt → 调用 AI
    │       ├─ 解析 AI 响应 JSON
    │       └─ 保存 findings → reviews 表
    │           file_path: finding.file ← AI 返回的值
    │
    ├─ 3. fetchReviews() → 刷新列表
    └─ 4. batchFixReviews(project, newReviewIds)
              ↓
        POST /reviews/fix-batch
              ↓
        对每个 review:
          检查 file_path 是否为有效代码文件路径
          ├─ 有效 → AI 生成修复 → fixed
          └─ 无效 → 标记确认 → confirmed
```

## 问题现象

扫描发现 7 个新 issues，自动修复处理后：
- fixed: 0 (没有实际修复任何文件)
- confirmed: 7 (全部标记为"已确认")
- failed: 0

## 根因定位

DesignChecker 的 AI prompt 没有明确要求 `file` 字段必须是**可修改的代码文件路径**。

AI 返回的 findings 中，`file` 字段值为 `"设计文档"` 而非实际代码文件路径：

| ID | title | file_path | 问题 |
|----|-------|-----------|------|
| 637 | 审查修复后未自动创建任务 | "设计文档" | 应指向 src/worker/routes/reviews.ts |
| 638 | 任务状态未自动同步更新 | "设计文档" | 应指向 web/src/stores/dashboard.ts |
| 639 | AI聊天中未实现创建任务功能 | "设计文档" | 应指向 src/teams/ |
| 640 | 审查批准端点未被前端调用 | "设计文档" | 应指向 src/worker/routes/reviews.ts |
| 641 | 遗留的SSE聊天端点未被前端使用 | "设计文档" | 应指向 src/worker/routes/teams.ts |
| 642 | 审查忽略/更新路由路径不一致 | "设计文档" | 应指向 src/worker/routes/reviews.ts |
| 643 | DesignChecker模块为文档未记录的内部功能 | "设计文档" | 应指向 src/analyzer/designChecker.ts |

## fix-batch 判定逻辑

```typescript
const isValidFilePath = review.file_path
  && /\.(ts|tsx|js|jsx|vue|...)$/.test(review.file_path)  // "设计文档" 不匹配
  && fs.existsSync(path.join(project.path, review.file_path));

// "设计文档" → 正则不匹配 → isValidFilePath = false → confirmed
```
