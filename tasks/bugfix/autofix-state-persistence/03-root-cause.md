# 03. 根本原因分析

## Bug 1: autoFixAfterScan 无持久化

**根本原因**: Vue `ref()` 是组件级状态，组件卸载（页面刷新）时销毁。

```typescript
// web/src/views/DashboardView.vue
const autoFixAfterScan = ref(false)  // 每次组件挂载都重置为 false
```

**为什么其他状态没有这个问题**:
- `autoScanEnabled`: 在 `onMounted` 中通过 `fetchScannerConfig()` 从后端 API 恢复
- `scanIntervalMinutes`: 同上，从后端 API 恢复

**对比**:
| 状态 | 持久化方式 | 刷新后 |
|------|-----------|--------|
| autoScanEnabled | 后端 API | ✅ 恢复 |
| scanIntervalMinutes | 后端 API | ✅ 恢复 |
| autoFixAfterScan | 无 | ❌ 丢失 |

## Bug 2: scanning 状态无持久化

**根本原因**: 扫描状态只存储在前端 `ref()` 中，后端 `scannerConfig.isScanning` 虽然记录了扫描状态，但前端 `onMounted` 没有读取它。

```typescript
// web/src/views/DashboardView.vue
onMounted(async () => {
  // ...
  await dashboardStore.fetchScannerConfig()
  autoScanEnabled.value = dashboardStore.scannerConfig.enabled
  scanIntervalMinutes.value = Math.round(dashboardStore.scannerConfig.intervalMs / 60000)
  // ❌ 缺少: if (dashboardStore.scannerConfig.isScanning) scanning.value = true
})
```

**后端已有的数据**:
```typescript
// src/analyzer/designChecker.ts
getConfig(): ScannerConfig {
  return {
    enabled: this.enabled,
    intervalMs: this.scanIntervalMs,
    isScanning: this.isScanning,  // ✅ 后端已经记录了扫描状态
  }
}
```

## 修复策略

| Bug | 策略 | 原因 |
|-----|------|------|
| autoFixAfterScan | localStorage | 用户偏好设置，不需要后端存储 |
| scanning | 从后端 isScanning 恢复 | 扫描状态已在后端维护 |
