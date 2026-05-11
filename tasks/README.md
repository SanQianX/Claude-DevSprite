# 任务列表

## 进行中

（暂无）

---

## 已完成

### TASK-001: 分析首页 Tokens 消耗显示逻辑
- **状态**: ✅ 已完成
- **文件**: [TASK-001-tokens-display-analysis.md](./TASK-001-tokens-display-analysis.md)
- **描述**: 分析首页 TokensBar 组件的数据流和渲染逻辑
- **结论**: 后端为纯 mock 数据，无真实 Token 追踪；前端组件结构完整，支持日/周/月/全部周期切换

### TASK-002: ccusage 集成实现真实 Token 消耗追踪
- **状态**: ✅ 已完成
- **文件**: [TASK-002-ccusage-integration.md](./TASK-002-ccusage-integration.md)
- **描述**: 通过调用 ccusage CLI 获取真实 token 消耗数据，包含详情弹窗和预加载优化
- **实现**: 新增 ccusage.ts 服务层、TokenDetailModal.vue 详情弹窗、预加载所有周期数据

### Bug Fix: Tokens 消耗显示 Mock 数据问题
- **状态**: ✅ 已完成
- **文件夹**: [bugfix-tokens-real-data/](./bugfix-tokens-real-data/)
- **描述**: 完整的 bug 修复文档，从 UI 分析到测试验证
- **文档清单**:
  - 01-ui-analysis.md - UI 控件分析
  - 02-design-intent.md - 原始设计逻辑
  - 03-bug-discovery.md - 问题发现过程
  - 04-root-cause.md - 根本原因分析
  - 05-fix-implementation.md - 修复实现过程
  - 06-testing.md - 测试验证
  - 07-summary.md - 总结与改进
