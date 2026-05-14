# 功能缺失: 聊天不会自动创建任务

- **Review ID**: 296
- **严重程度**: warning
- **文件**: web/src/views/DevChatView.vue
- **行号**: null
- **分类**: missing-impl

## 问题描述
设计意图是 AI 聊天中可以根据内容自动创建任务，但实际上聊天不会自动创建任务。任务只能通过 Dashboard 的'添加任务'按钮手动创建

## 修复建议
实现聊天中任务创建触发机制