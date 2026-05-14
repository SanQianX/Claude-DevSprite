---
title: 变更记录 - 清理审查创建端点死代码
category: changelog
createdAt: '2026-05-14T06:47:53.688Z'
updatedAt: '2026-05-14T06:47:53.688Z'
relations:
  - changelog/2026-05-14_01-code-reviewer-comment-mismatch-fix.md
  - project-overview/03-modules.md
---

# 变更记录 - 清理审查创建端点死代码

## 提交信息

- **提交类型**: `fix` - 修复/代码清理
- **提交消息**: `fix(auto): create-delete-review-dead-code-fix_2026-05-14`
- **修复日期**: 2026-05-14

## 变更内容

### 1. src/worker/routes/dashboard.ts

**变更类型**: 修改（删除死代码）

**变更详情**:

移除了 `POST /api/projects/:name/reviews` 端点的完整实现。该端点原用于创建新的审查项（review），其逻辑包括验证项目存在、处理请求体参数（title, severity等）、在数据库中创建记录并返回。此端点的路由处理函数 `asyncHandler(async (req: Request, res: Response) => {...})` 及其相关注释（`/** POST /api/projects/:name/reviews... */`）被完全删除，共46行代码。

**影响范围**: 后端 API 路由层。该变更移除了一个未被使用的 API 端点，简化了 `dashboard.ts` 路由文件的代码。

**源码文件**: [src/worker/routes/dashboard.ts](/project/Claude-DevSprite/source?path=src/worker/routes/dashboard.ts)

### 2. web/src/api/dashboard.ts

**变更类型**: 修改（删除死代码）

**变更详情**:

移除了 `createReview` 异步函数。该函数原用于调用上述后端 `POST /api/projects/:name/reviews` 端点，在客户端创建新的审查项。它接收 `projectName` 和包含 `title` 等字段的 `review` 对象参数。该函数的完整定义被删除，共19行代码。

**影响范围**: 前端 API 客户端层。该变更移除了一个未被使用的 API 调用函数，简化了 `dashboard.ts` API 模块的代码。

**源码文件**: [web/src/api/dashboard.ts](/project/Claude-DevSprite/source?path=web/src/api/dashboard.ts)

## 修复的问题列表

本次提交修复了以下问题：

1.  **死代码残留**: 在之前的功能迭代中（如 AI 审查修复、设计检查等），审查项的创建逻辑可能已移至其他流程（如 `AgentScanner` 自动创建），导致 `POST /reviews` 端点和对应的 `createReview` API 函数不再被任何调用者使用。这些未使用的代码构成了“死代码”，增加了代码库的维护负担。
2.  **接口职责不清晰**: 保留一个未被使用的创建端点，可能导致开发者对系统的实际数据流（审查项是如何产生的）产生误解。

## 根本原因

根本原因是**功能实现演进与遗留代码清理不同步**。随着项目发展，审查项的生成机制从“前端手动创建”转变为“后端自动化扫描生成”（通过 `AgentScanner` 和 `DesignFixer` 管道），原有的创建 API 和前端调用逻辑失去了使用场景，但未被及时识别和清理。

## 修复方案

修复方案是直接、安全地删除这些确认为死代码的部分：

1.  **后端清理**: 从 Express 路由注册文件 `dashboard.ts` 中移除 `POST /api/projects/:name/reviews` 的路由处理函数及相关注释。
2.  **前端清理**: 从 API 客户端文件 `dashboard.ts` 中移除 `createReview` 函数定义。
3.  **影响确认**: 此操作是纯删除，不引入新逻辑。通过代码搜索（如 `grep`）确认该端点和函数在前端视图层、状态管理层以及其他路由中无任何引用。

## 影响评估

- **代码质量提升**: 减少了代码行数和 API 表面积，降低了维护复杂度和潜在的混淆。
- **系统行为不变**: 由于被删除的代码从未被实际调用，因此本次变更不会对系统的任何现有功能产生影响。用户通过 Web Dashboard 看到的审查列表、执行的修复操作等均依赖其他活跃的 API（如 `PUT /reviews/:id`、`POST /reviews/:id/fix`）。
- **文档依赖**: 项目概览与模块文档中未发现对此特定 `POST /reviews` 端点的描述，因此无需更新相关文档。但此变更印证了审查项的创建已全面转向自动化管道。

## 关联上下文

本次清理与项目历史中对 API 端点职责的持续澄清一脉相承。例如，在提交 `2026-05-14_01-code-reviewer-comment-mismatch-fix` 中，已对 `PUT /reviews/:id/approve` 和 `PUT /reviews/:id/ignore` 端点的状态进行了澄清。本次提交进一步移除了 `POST` 端点这一死代码，使得审查模块的 API 接口更加精简、职责更加明确。当前审查模块的活跃 API 主要聚焦于**查询**、**状态更新**和**触发修复**。
