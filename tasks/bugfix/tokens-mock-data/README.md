# Bug Fix: Tokens 消耗显示 Mock 数据问题

## 问题概述

首页 Tokens 栏显示的是硬编码的 Mock 数据，而非真实的 Claude Code token 消耗数据。

## 修复日期
2026-05-12

## 文件清单

| 文件 | 内容 |
|------|------|
| [01-ui-analysis.md](./01-ui-analysis.md) | UI 控件分析 |
| [02-design-intent.md](./02-design-intent.md) | 原始设计逻辑 |
| [03-bug-discovery.md](./03-bug-discovery.md) | 问题发现过程 |
| [04-root-cause.md](./04-root-cause.md) | 根本原因分析 |
| [05-fix-implementation.md](./05-fix-implementation.md) | 修复实现过程 |
| [06-testing.md](./06-testing.md) | 测试验证 |
| [07-summary.md](./07-summary.md) | 总结与改进

## 修复结果

- ✅ 后端集成 ccusage CLI 获取真实数据
- ✅ 前端详情弹窗显示每日模型消耗
- ✅ 预加载所有周期数据，切换瞬间响应
- ✅ 5 分钟缓存避免频繁调用
