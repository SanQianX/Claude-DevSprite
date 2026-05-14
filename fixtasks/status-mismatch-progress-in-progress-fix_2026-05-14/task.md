# 状态不匹配 - taskGroups 中使用 status='progress' 但 API 只支持 'in_progress'

- **Review ID**: 264
- **严重程度**: warning
- **文件**: web/src/views/DashboardView.vue
- **行号**: 313
- **分类**: state-mismatch

## 问题描述
在 DashboardView.vue 的 taskGroups 计算属性中，代码使用 t.status === 'progress' 来筛选进行中的任务，但后端 API 支持的状态值是 'in_progress' 而不是 'progress'。这会导致进行中的任务无法被正确计入 taskGroups 的"进行中"分组和 inProgressCount。

## 修复建议
将 DashboardView.vue 中第 313 行和第 345 行的 'progress' 替换为 'in_progress'