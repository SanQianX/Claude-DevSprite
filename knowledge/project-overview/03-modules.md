---
title: 项目模块文档
category: modules
createdAt: '2026-05-14T13:00:16.322Z'
updatedAt: '2026-05-14T13:00:16.322Z'
relations:
  - changelog/2026-05-14-route-conflict-dashboard-reviews-fix.md
  - changelog/2026-05-12-autofix-batch-only-new-reviews.md
---
...
### 8. 自动化模块 (Analyzer)
...
#### 8.1 自动修复器 (DesignFixer / AgentFixer)

**职责**: 定期或手动触发，根据代码审查器 (CodeReviewer) 和设计检查器 (DesignScanner) 生成的问题列表，自动应用代码修复并提交。

**核心能力**:
- **修复执行**: 执行具体的代码修改逻辑。
- **进度跟踪**: 在修复过程中维护实时状态，包括：
    - `currentFixDir`: 当前正在处理的文件路径。
    - `currentFixIndex`: 当前处理进度索引。
    - `totalFixes`: 本次任务总修复项数。
  这些状态可通过 `GET /fixer/config` API 端点获取，用于前端仪表板展示。
- **配置管理**: 支持运行时启用/禁用、调整执行间隔。
- **并发控制**: 确保同一时间只有一个修复任务在运行。

**相关源码**:
- [DesignFixer](/project/Claude-DevSprite/source?path=src/analyzer/designFixer.ts) - 处理设计一致性问题。
- [AgentFixer](/project/Claude-DevSprite/source?path=src/analyzer/agentFixer.ts) - 处理其他代码问题。
...
#### 8.2 问题扫描器 (AgentScanner)

**职责**: 自动扫描项目，检测代码实现与设计文档/最佳实践的不一致，并将发现的问题存入数据库作为审查项 (Review)。

**核心能力**:
- **两层 Agent 架构**: 编排器识别问题，工作器深入分析。
- **健壮性保护**: 在内部状态查询 (`isScanning`) 时包含保护逻辑，防止因进程异常退出导致的标志位卡死（例如，当 `isBatchScanning` 为 `true` 但无活跃扫描任务时，自动重置标志位）。
- **问题管理**: 将扫描结果结构化后导入 SQLite `reviews` 表。

**相关源码**:
- [AgentScanner](/project/Claude-DevSprite/source?path=src/analyzer/agentScanner.ts)
...
