# 03. 问题发现过程

## 发现时间
2026-05-13

## 发现方式
Playwright UI 测试 + API 直接调用

## 问题 #1: 手动扫描返回 500 错误 (Critical)

### 排查步骤

**Step 1: 运行 Playwright 测试**

测试文件: `tests/e2e/design-checker-scan.spec.ts`

```
Test 10: scan button triggers scan API
  → 点击 .scan-btn
  → 等待 POST /reviews/scan 响应
  → 期望: status 200
  → 实际: status 500
```

**Step 2: 直接调用 API 验证**

```bash
curl -X POST http://127.0.0.1:38888/api/projects/Claude-DevSprite/reviews/scan
```

**结果**:
```json
{"error":{"message":"cannot rollback - no transaction is active","status":500}}
```

**确认**: 后端扫描端点本身存在 bug，不是前端问题。

**Step 3: 分析错误信息**

错误 `cannot rollback - no transaction is active` 来自 sql.js，说明:
- 代码尝试调用 `rollback()`
- 但此时没有活跃的事务可以回滚
- 事务可能已被意外提交或清除

**Step 4: 检查调用链**

```
POST /api/projects/:name/reviews/scan
    ↓
DesignChecker.scanProject()
    ↓
db.createReviewsBatch(reviews)
    ↓
this.beginTransaction()   ← 开始事务
    ↓
this.createReview(review) ← 每个 review 都调用
    ↓
this.save()               ← ❌ 问题在这里!
    ↓
this.db.export()          ← export() 干扰了活跃事务
    ↓
this.commit()             ← 事务可能已被 export() 提交
    ↓
this.rollback()           ← ❌ 没有活跃事务可回滚
```

---

## 问题 #2: 缺少定时扫描间隔配置 UI (Feature)

### 排查步骤

**Step 1: 检查 DashboardView 模板**

文件: `web/src/views/DashboardView.vue`

```html
<div class="section-header">
  <div class="section-title">AI 审查队列</div>
  <button class="scan-btn" :disabled="scanning" @click="startScan">
    {{ scanning ? '扫描中...' : '开始扫描' }}
  </button>
</div>
```

**发现**: section-header 中只有标题和手动扫描按钮，没有定时扫描配置控件。

**Step 2: 检查后端 DesignChecker**

文件: `src/analyzer/designChecker.ts`

```typescript
export class DesignChecker {
  private scanIntervalMs = 10 * 60 * 1000; // 硬编码 10 分钟
  // ❌ 没有 getConfig() 方法
  // ❌ 没有 updateConfig() 方法
}
```

**发现**: DesignChecker 的扫描间隔是硬编码的，没有动态配置能力。

**Step 3: 检查后端路由**

文件: `src/worker/routes/reviews.ts`

```typescript
// ❌ 没有 GET /api/scanner/config 端点
// ❌ 没有 PUT /api/scanner/config 端点
```

**发现**: 没有获取或更新扫描配置的 API 端点。

**Step 4: 检查前端 API 和 Store**

```typescript
// dashboard.ts API
// ❌ 没有 getScannerConfig() 方法
// ❌ 没有 updateScannerConfig() 方法

// dashboard.ts Store
// ❌ 没有 scannerConfig 状态
// ❌ 没有 fetchScannerConfig() 方法
// ❌ 没有 updateScannerConfig() 方法
```

**确认**: 整个定时扫描配置功能从后端到前端都不存在。

---

## 问题总结

| # | 问题 | 严重性 | 根本原因 | 影响 |
|---|------|--------|----------|------|
| 1 | 手动扫描返回 500 | Critical | `createReviewsBatch` 中 `save()` 干扰 sql.js 事务 | 扫描功能完全不可用 |
| 2 | 无定时扫描配置 UI | Feature | 后端无配置 API，前端无配置控件 | 用户无法配置定时扫描 |
