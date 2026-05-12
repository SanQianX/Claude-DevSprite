# 05. 修复实现过程

## 修复架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          修复后架构                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  前端                                                                  │
│  ├─ DashboardView.vue ─────→ scan-controls                             │
│  │     ├─ scan-toggle ─────→ toggleAutoScan()                          │
│  │     ├─ scan-interval ───→ updateScanInterval()                      │
│  │     └─ scan-btn ────────→ startScan()                               │
│  │          │                                                          │
│  │          ↓                                                          │
│  ├─ dashboard store ───────→ scannerConfig                             │
│  │                    ─────→ fetchScannerConfig()                       │
│  │                    ─────→ updateScannerConfig()                      │
│  ├─ dashboard API ─────────→ getScannerConfig()                        │
│  │                    ─────→ updateScannerConfig()                      │
│          │                                                              │
│          ↓                                                              │
│  后端                                                                  │
│  ├─ routes/reviews.ts ─────→ GET /api/scanner/config                    │
│  │                    ─────→ PUT /api/scanner/config                    │
│  │                    ─────→ POST /reviews/scan (不变)                  │
│  ├─ routes/index.ts ───────→ registerScannerConfigRoutes               │
│  ├─ designChecker.ts ──────→ getConfig() + updateConfig()              │
│  └─ db.ts ─────────────────→ createReviewsBatch (修复事务问题)          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 修复 1: db.ts — createReviewsBatch 事务安全

文件: `src/worker/db.ts`

### 修改前

```typescript
createReviewsBatch(reviews: Array<...>): void {
  this.beginTransaction();
  try {
    for (const review of reviews) {
      this.createReview(review);  // ← 调用 save() 干扰事务
    }
    this.commit();
  } catch (err) {
    this.rollback();
    throw err;
  }
}
```

### 修改后

```typescript
createReviewsBatch(reviews: Array<...>): void {
  this.beginTransaction();
  try {
    for (const review of reviews) {
      const now = new Date().toISOString();
      // 使用原始 run() 而非 createReview()，避免 save() 干扰事务
      this.run(
        `INSERT INTO reviews (project_id, title, severity, location, suggestion, source, status, commit_hash, file_path, line, category, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [review.project_id, review.title, review.severity, review.location || null, review.suggestion || null, review.source || 'ai', review.status, review.commit_hash || null, review.file_path || null, review.line || null, review.category || null, review.description || null, now, now]
      );
    }
    this.commit();  // commit() 内部调用 save()
  } catch (err) {
    this.rollback();
    throw err;
  }
}
```

**关键变更**: 用内联的 `this.run(INSERT...)` 替代 `this.createReview(review)`，避免了事务内的 `save()` 调用。`commit()` 内部已经调用了 `save()`，所以数据持久化不受影响。

## 修复 2: DesignChecker — 添加配置方法

文件: `src/analyzer/designChecker.ts`

### 新增 ScannerConfig 接口

```typescript
export interface ScannerConfig {
  enabled: boolean;
  intervalMs: number;
  isScanning: boolean;
}
```

### 新增 enabled 字段

```typescript
export class DesignChecker {
  private enabled = true;  // 新增
  // ...
}
```

### 新增 getConfig() 方法

```typescript
getConfig(): ScannerConfig {
  return {
    enabled: this.enabled,
    intervalMs: this.scanIntervalMs,
    isScanning: this.isScanning,
  };
}
```

### 新增 updateConfig() 方法

```typescript
updateConfig(config: { enabled?: boolean; intervalMs?: number }): void {
  if (config.enabled !== undefined) {
    this.enabled = config.enabled;
  }
  if (config.intervalMs !== undefined && config.intervalMs >= 60000) {
    this.scanIntervalMs = config.intervalMs;
  }
  // 重启扫描器以应用新配置
  this.stopScanner();
  if (this.enabled) {
    this.startScanner();
  }
}
```

### 修改 startScanner()

```typescript
startScanner(): void {
  if (this.scanTimer) return;
  if (!this.enabled) {         // 新增检查
    logger.info('[DesignChecker] Scanner disabled, not starting');
    return;
  }
  // ... 原有逻辑
}
```

## 修复 3: 后端路由 — 添加 scanner config 端点

文件: `src/worker/routes/reviews.ts`

### 新增 registerScannerConfigRoutes()

```typescript
export function registerScannerConfigRoutes(app: Express): void {
  // GET /api/scanner/config
  app.get('/api/scanner/config', asyncHandler(async (req, res) => {
    const checker = getDesignChecker();
    res.json(checker.getConfig());
  }));

  // PUT /api/scanner/config
  app.put('/api/scanner/config', asyncHandler(async (req, res) => {
    const { enabled, intervalMs } = req.body;
    const checker = getDesignChecker();
    checker.updateConfig({ enabled, intervalMs });
    res.json({ message: '扫描配置已更新', config: checker.getConfig() });
  }));
}
```

文件: `src/worker/routes/index.ts`

```typescript
import { registerReviewRoutes, registerScannerConfigRoutes } from './reviews';

export function registerRoutes(app: Express): void {
  // ...
  registerReviewRoutes(app);
  registerScannerConfigRoutes(app);  // 新增
}
```

## 修复 4: 前端 API — 添加 scanner config 方法

文件: `web/src/api/dashboard.ts`

```typescript
// Scanner config
async getScannerConfig(): Promise<{ enabled: boolean; intervalMs: number; isScanning: boolean }> {
  return unwrap(apiClient.get<{ enabled: boolean; intervalMs: number; isScanning: boolean }>(
    '/scanner/config'
  ))
},

async updateScannerConfig(config: { enabled?: boolean; intervalMs?: number }): Promise<{ config: { enabled: boolean; intervalMs: number; isScanning: boolean } }> {
  return unwrap(apiClient.put<{ config: { enabled: boolean; intervalMs: number; isScanning: boolean } }>(
    '/scanner/config',
    config as Record<string, unknown>
  ))
},
```

## 修复 5: 前端 Store — 添加 scanner config 状态

文件: `web/src/stores/dashboard.ts`

```typescript
const scannerConfig = ref<{ enabled: boolean; intervalMs: number; isScanning: boolean }>({
  enabled: true,
  intervalMs: 10 * 60 * 1000,
  isScanning: false,
})

async function fetchScannerConfig() {
  try {
    const config = await dashboardApi.getScannerConfig()
    scannerConfig.value = config
  } catch { /* keep defaults */ }
}

async function updateScannerConfig(config: { enabled?: boolean; intervalMs?: number }) {
  const result = await dashboardApi.updateScannerConfig(config)
  scannerConfig.value = result.config
  return result.config
}
```

## 修复 6: 前端 UI — 添加扫描控制控件

文件: `web/src/views/DashboardView.vue`

### 模板变更

```html
<div class="section-header">
  <div class="section-title">AI 审查队列</div>
  <div class="scan-controls">
    <label class="scan-toggle">
      <input type="checkbox" v-model="autoScanEnabled" @change="toggleAutoScan" />
      <span class="scan-toggle-label">定时扫描</span>
    </label>
    <select v-if="autoScanEnabled" class="scan-interval-select"
            v-model="scanIntervalMinutes" @change="updateScanInterval">
      <option :value="5">5 分钟</option>
      <option :value="10">10 分钟</option>
      <option :value="15">15 分钟</option>
      <option :value="30">30 分钟</option>
      <option :value="60">1 小时</option>
    </select>
    <button class="scan-btn" :disabled="scanning" @click="startScan">
      {{ scanning ? '扫描中...' : '开始扫描' }}
    </button>
  </div>
</div>
```

### 脚本变更

```typescript
const autoScanEnabled = ref(true)
const scanIntervalMinutes = ref(10)

async function toggleAutoScan() {
  await dashboardStore.updateScannerConfig({ enabled: autoScanEnabled.value })
}

async function updateScanInterval() {
  await dashboardStore.updateScannerConfig({ intervalMs: scanIntervalMinutes.value * 60 * 1000 })
}

// onMounted 中加载配置
await dashboardStore.fetchScannerConfig()
autoScanEnabled.value = dashboardStore.scannerConfig.enabled
scanIntervalMinutes.value = Math.round(dashboardStore.scannerConfig.intervalMs / 60000)
```

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/worker/db.ts` | 修改 | `createReviewsBatch` 使用原始 `run()` 避免事务内 `save()` |
| `src/analyzer/designChecker.ts` | 修改 | 添加 `ScannerConfig`, `getConfig()`, `updateConfig()`, `enabled` 字段 |
| `src/worker/routes/reviews.ts` | 修改 | 添加 `registerScannerConfigRoutes()` |
| `src/worker/routes/index.ts` | 修改 | 注册 `registerScannerConfigRoutes` |
| `web/src/api/dashboard.ts` | 修改 | 添加 `getScannerConfig()`, `updateScannerConfig()` |
| `web/src/stores/dashboard.ts` | 修改 | 添加 `scannerConfig` 状态和方法 |
| `web/src/views/DashboardView.vue` | 修改 | 添加定时扫描 UI 控件 |
