# 功能缺失: 任务编辑/删除 UI 未暴露

- **Review ID**: 294
- **严重程度**: warning
- **文件**: web/src/views/DashboardView.vue
- **行号**: null
- **分类**: missing-impl

## 问题描述
后端支持任务的编辑 (PUT) 和删除 (DELETE) 端点，前端 store 中也有 updateTask 和 deleteTask 函数，但 Dashboard UI 中没有暴露编辑和删除按钮

## 修复建议
添加编辑/删除按钮到任务卡片 UI