# approveReview 函数未被调用（死代码）

- **Review ID**: 282
- **严重程度**: warning
- **文件**: web/src/stores/dashboard.ts
- **行号**: 79
- **分类**: dead-code

## 问题描述
dashboard.ts store 中定义了 approveReview() 函数，但整个前端代码中没有地方调用它。前端批准修复按钮实际调用的是 fixReview()

## 修复建议
删除 approveReview 函数，或确认其设计意图后实现功能