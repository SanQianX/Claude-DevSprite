# 首页表格搜索/过滤功能未实现

- **Review ID**: 327
- **严重程度**: info
- **文件**: web/src/views/HomePage.vue
- **行号**: null
- **分类**: missing-impl

## 问题描述
首页表格无搜索/过滤功能，项目数量多时难以快速查找。AppHeader 有搜索功能但路由到 /search，不作用于首页表格

## 修复建议
添加搜索输入框或集成到项目表格