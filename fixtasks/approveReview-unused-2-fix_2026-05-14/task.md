# 未使用的 approveReview 函数

- **Review ID**: 276
- **严重程度**: info
- **文件**: web/src/stores/dashboard.ts
- **行号**: 79
- **分类**: dead-code

## 问题描述
dashboard.ts 中的 approveReview() 函数定义但从未被 UI 调用。前端使用 fixReview() 处理审查项的修复，而 approveReview() 是遗留函数。设计文档说明 PUT /api/reviews/:id/approve 端点是死代码。

## 修复建议
删除 dashboard.ts 中第 79-87 行的 approveReview 函数。