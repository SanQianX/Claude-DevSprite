# 04. 根本原因分析

## 问题 1: createReviewsBatch 事务失败

### 问题本质

`createReviewsBatch` 方法在事务内调用了 `createReview()`，而 `createReview()` 内部调用了 `this.save()` → `this.db.export()`。在 sql.js 中，`export()` 会读取整个数据库的当前状态，这会干扰活跃的 SQL 事务，导致事务被隐式提交。后续的 `rollback()` 调用因没有活跃事务而失败。

### 详细调用链分析

```
createReviewsBatch(reviews)
    │
    ├─ this.beginTransaction()
    │     执行: this.db.run('BEGIN TRANSACTION')
    │     状态: 事务已开始
    │
    ├─ for (review of reviews)
    │     │
    │     ├─ this.createReview(review)
    │     │     │
    │     │     ├─ this.run(INSERT INTO reviews ...)
    │     │     │     状态: INSERT 在事务内执行 ✅
    │     │     │
    │     │     ├─ this.queryOne(SELECT last_insert_rowid() ...)
    │     │     │     状态: 查询在事务内执行 ✅
    │     │     │
    │     │     └─ this.save()                    ← ❌ 问题根源
    │     │           │
    │     │           └─ const data = this.db.export()
    │     │                 │
    │     │                 └─ sql.js 内部: 读取数据库完整状态
    │     │                       │
    │     │                       └─ 可能隐式提交了活跃事务
    │     │                             状态: 事务可能已被提交
    │     │
    │     └─ (循环继续，下一个 INSERT 可能在新事务中)
    │
    ├─ this.commit()
    │     执行: this.db.run('COMMIT')
    │     执行: this.save() ← 又一次 export()
    │     状态: 如果事务已被提交，COMMIT 是 no-op
    │
    └─ (如果发生错误)
          this.rollback()
          执行: this.db.run('ROLLBACK')
          状态: ❌ 没有活跃事务 → "cannot rollback - no transaction is active"
```

### sql.js 的 export() 行为

sql.js 的 `db.export()` 方法返回数据库的完整二进制快照。根据 sql.js 的实现:

1. `export()` 会读取当前数据库状态
2. 在某些情况下，这可能触发 WAL (Write-Ahead Log) 的检查点
3. 检查点操作可能隐式提交活跃事务

这不是 sql.js 的 bug，而是 `export()` 和事务的交互特性。在事务内调用 `export()` 是不安全的。

### 为什么 CodeReviewer 没有这个问题

CodeReviewer 的 `reviewCommit()` 也是调用 `db.createReviewsBatch()`，但:
- 它处理的是 git diff 结果，通常每个 commit 只有几个文件变更
- 如果 AI 返回空结果 (findings.length === 0)，`createReviewsBatch` 不会被调用
- 在测试环境中，可能没有足够的数据触发此问题

## 问题 2: 缺少定时扫描配置

### 问题本质

DesignChecker 的扫描间隔是硬编码的，没有提供动态配置的 API 和 UI。这是一个功能缺失，不是 bug。

### 缺失链路

```
后端 DesignChecker:
  scanIntervalMs = 10 * 60 * 1000  ← 硬编码
  ❌ 没有 getConfig()
  ❌ 没有 updateConfig()

后端路由:
  ❌ 没有 GET /api/scanner/config
  ❌ 没有 PUT /api/scanner/config

前端 API:
  ❌ 没有 getScannerConfig()
  ❌ 没有 updateScannerConfig()

前端 Store:
  ❌ 没有 scannerConfig 状态
  ❌ 没有 fetchScannerConfig()
  ❌ 没有 updateScannerConfig()

前端 UI:
  ❌ 没有定时扫描 checkbox
  ❌ 没有间隔选择器
```

## 修复策略

| 问题 | 修复方式 | 涉及文件 |
|------|----------|----------|
| 事务失败 | `createReviewsBatch` 使用原始 `run()` 替代 `createReview()`，避免事务内 `save()` | `src/worker/db.ts` |
| 无配置 API | 添加 `getConfig()`/`updateConfig()` + GET/PUT 端点 | `designChecker.ts`, `reviews.ts`, `routes/index.ts` |
| 无配置 UI | 添加 checkbox + select + API/Store 方法 | `DashboardView.vue`, `dashboard.ts`, `dashboard store` |
