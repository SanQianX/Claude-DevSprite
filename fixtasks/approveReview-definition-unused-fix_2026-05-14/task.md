# Dashboard store 的 approveReview 函数定义但未被 UI 调用

- **Review ID**: 280
- **严重程度**: warning
- **文件**: web/src/stores/dashboard.ts
- **行号**: 79
- **分类**: dead-code

## 问题描述
dashboard.ts store 中定义了 approveReview 函数（行79-87），该函数调用 PUT /api/projects/:name/reviews/:id 更新 review 状态为 approved。但根据 FUNCTIONAL-LOGIC-ANALYSIS.md 文档记录，该函数存在但无按钮调用，属于死代码。前端"批准修复"按钮直接调用 POST /reviews/:id/fix（由 fixReview 处理）。

## 修复建议
删除 web/src/stores/dashboard.ts 第79-87行的 approveReview 函数，因为当前设计只有"修复"操作，无单独"批准"操作。