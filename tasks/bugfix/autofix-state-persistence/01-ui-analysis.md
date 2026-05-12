# 01. UI 控件分析

## 相关控件

```
┌─────────────────────────────────────────────────────────────────────────┐
│  AI 审查队列     [✓ 定时扫描] [10 分钟 ▾] [☐ 自动修复]   [开始扫描]     │
├─────────────────────────────────────────────────────────────────────────┤
│  审查项列表...                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

| 控件 | 类型 | 状态变量 | 持久化方式 |
|------|------|----------|-----------|
| 定时扫描 checkbox | `.scan-toggle input` | `autoScanEnabled` | 后端 API (scannerConfig) |
| 自动修复 checkbox | `.scan-toggle input` (第二个) | `autoFixAfterScan` | **无** (Bug) |
| 扫描按钮 | `.scan-btn` | `scanning` | **无** (Bug) |

## 数据流（修复前）

```
页面加载 (onMounted):
  ├─ fetchScannerConfig() → autoScanEnabled 恢复 ✅
  ├─ fetchScannerConfig() → scanIntervalMinutes 恢复 ✅
  └─ autoFixAfterScan = ref(false) → 每次重置 ❌
  └─ scanning = ref(false) → 每次重置 ❌

刷新页面:
  ├─ autoScanEnabled: 从后端恢复 → 正确
  ├─ scanIntervalMinutes: 从后端恢复 → 正确
  ├─ autoFixAfterScan: 重置为 false → 丢失 ❌
  └─ scanning: 重置为 false → 丢失 ❌
```

## Bug 1: autoFixAfterScan 无持久化

**现象**: 用户勾选"自动修复"后刷新页面，复选框恢复为未勾选

**代码位置**: `web/src/views/DashboardView.vue`
```typescript
const autoFixAfterScan = ref(false)  // 每次组件挂载都重置为 false
```

**影响**: 用户每次刷新都需要重新勾选

## Bug 2: scanning 状态无持久化

**现象**: 扫描进行中刷新页面，按钮从"扫描中..."恢复为"开始扫描"

**代码位置**: `web/src/views/DashboardView.vue`
```typescript
const scanning = ref(false)  // 每次组件挂载都重置为 false
```

**影响**: 用户刷新后无法知道扫描是否仍在进行
