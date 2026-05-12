# 02. 根本原因

## 后端

`POST /reviews/fix-batch` 端点无条件调用 `db.getPendingReviews(project.id)`，返回项目中所有 status='pending' 的 review。没有机制指定只处理特定的 review。

## 前端

`startScan()` 调用 `batchFixReviews(projectName)` 时不传递任何参数，后端默认处理全部。

## 进度条

`scanFixProgress.total` 设置为 `scanResult.findingsCount`（新发现数），但实际处理的是所有 pending reviews（可能是 findingCount 的 100 倍），导致进度条永远走不完。
