# 任务编辑/删除 UI 未暴露

- **Review ID**: 287
- **严重程度**: warning
- **文件**: web/src/views/DashboardView.vue
- **行号**: 1
- **分类**: missing-impl

## 问题描述
后端支持任务的编辑（PUT /api/projects/:name/tasks/:id）和删除（DELETE /api/projects/:name/tasks/:id）API，但前端 DashboardView 没有暴露编辑和删除按钮

## 修复建议
在任务列表中添加编辑和删除按钮及相关事件处理