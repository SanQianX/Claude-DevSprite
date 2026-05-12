# 01. UI 控件分析

## 自动修复数据流（修复前）

```
用户勾选"自动修复" → 点击"开始扫描"
    ↓
startScan()
    ├─ 1. triggerScan() → POST /reviews/scan → 创建新 pending reviews
    ├─ 2. fetchReviews() → 刷新列表
    └─ 3. batchFixReviews() → POST /reviews/fix-batch
                              ↓
                    获取所有 pending reviews (300+)
                              ↓
                    逐个调用 AI 修复 → 慢！
```

**问题**: 步骤 3 获取所有 pending reviews，包括旧的

## 自动修复数据流（修复后）

```
用户勾选"自动修复" → 点击"开始扫描"
    ↓
startScan()
    ├─ 1. 记录当前 pending review IDs (oldPendingIds)
    ├─ 2. triggerScan() → POST /reviews/scan → 创建新 pending reviews
    ├─ 3. fetchReviews() → 刷新列表
    └─ 4. batchFixReviews(project, newReviewIds)
                              ↓
                    只处理本次新发现的 reviews
                              ↓
                    快速完成！
```

## 后端 API 变更

```
POST /api/projects/:name/reviews/fix-batch

修复前:
  body: {} (空)
  行为: 处理所有 pending reviews

修复后:
  body: { reviewIds: [1, 2, 3] }  ← 新增参数
  行为: 只处理指定的 reviews
  如果 reviewIds 为空或不提供: 处理所有 pending reviews (向后兼容)
```

## 决策逻辑

自动修复遵循与手动"批准修复"相同的决策模型：

| 条件 | 动作 | 状态 |
|------|------|------|
| file_path 有效 + 文件存在 | AI 生成修复 | fixed |
| file_path 无效或文件不存在 | 标记确认 | confirmed |
| AI 响应异常 | 记录失败 | (不变) |
| 路径不安全 | 记录失败 | (不变) |
