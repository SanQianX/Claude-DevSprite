# 04. 修复实现

## 修改文件

| 文件 | 修改内容 |
|------|---------|
| `web/src/views/DashboardView.vue` | 添加 localStorage 持久化 + 后端状态恢复 |

## 修复 1: autoFixAfterScan localStorage 持久化

### 代码变更

```typescript
// 修复前:
const autoFixAfterScan = ref(false)

// 修复后: 从 localStorage 读取初始值
const autoFixAfterScan = ref(localStorage.getItem(`autofix-${props.projectName}`) === 'true')

// 添加 watcher 持久化
watch(autoFixAfterScan, (val) => {
  localStorage.setItem(`autofix-${props.projectName}`, String(val))
})
```

### 设计决策

- **存储位置**: `localStorage` (客户端持久化)
- **Key 格式**: `autofix-${projectName}` (按项目隔离)
- **Why localStorage 而非后端 API**: 用户偏好设置，不需要跨设备同步

## 修复 2: scanning 从后端恢复

### 代码变更

```typescript
// onMounted 中添加:
onMounted(async () => {
  // ...existing code...
  await dashboardStore.fetchScannerConfig()
  autoScanEnabled.value = dashboardStore.scannerConfig.enabled
  scanIntervalMinutes.value = Math.round(dashboardStore.scannerConfig.intervalMs / 60000)

  // 新增: 从后端恢复扫描状态
  if (dashboardStore.scannerConfig.isScanning) {
    scanning.value = true
  }
})
```

### 设计决策

- **数据源**: 后端 `scannerConfig.isScanning` (已有字段)
- **Why 不用 localStorage**: 扫描状态是服务端真实状态，不是用户偏好

## 完整数据流（修复后）

```
页面加载 (onMounted):
  ├─ fetchScannerConfig()
  │   ├─ autoScanEnabled = scannerConfig.enabled ✅
  │   ├─ scanIntervalMinutes = scannerConfig.intervalMs ✅
  │   └─ if (scannerConfig.isScanning) scanning = true ✅ (新增)
  └─ autoFixAfterScan = localStorage.getItem('autofix-xxx') ✅ (新增)

刷新页面:
  ├─ autoScanEnabled: 从后端恢复 → 正确 ✅
  ├─ scanIntervalMinutes: 从后端恢复 → 正确 ✅
  ├─ autoFixAfterScan: 从 localStorage 恢复 → 正确 ✅ (修复)
  └─ scanning: 从后端 isScanning 恢复 → 正确 ✅ (修复)
```
