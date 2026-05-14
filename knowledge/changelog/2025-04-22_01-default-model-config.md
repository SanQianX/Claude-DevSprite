---
title: 变更记录：添加默认模型配置字段
category: changelog
date: 2025-04-22T00:00:00.000Z
createdAt: '2026-05-13T14:58:18.579Z'
updatedAt: '2026-05-13T14:58:18.579Z'
relations: []
---

# 变更记录：添加默认模型配置字段

## 概述

本次提交（commit message: `fix(ui): add Default Model field to Shared Configuration section`）在 Web Dashboard 的 AI 设置界面中，为“共享配置”部分新增了“默认模型”配置字段，增强了配置的完整性和用户控制能力。

## 主要变更

1. **UI 增强**：
   - 在 `SettingsView.vue` 的“Shared Configuration”区域新增了 `Default Model` 表单字段。
   - 该字段使用 `v-model="aiConfig.model"` 双向绑定到 AI 配置的 `model` 属性。
   - 提供了占位符提示（`e.g. claude-sonnet-4-6`）和帮助文本（`form-hint`）。

2. **功能说明**：
   - 新字段允许用户在全局层面设置所有 Agent 默认使用的 AI 模型。
   - 该设置遵循继承与覆盖规则：各 Agent 可以继承此默认设置，或在各自的“per-agent”配置中单独覆盖。
   - 帮助文本明确说明了此层次关系：“Default model for all agents. Overridden by per-agent model settings.”

3. **文档更新**：
   - 与该字段同一区域的“共享配置”说明文字已更新，更清晰地阐述了配置继承逻辑：“Agents inherit these unless overridden per-agent below.”

## 影响与上下文

- **相关组件**：主要修改位于 [`web/src/views/SettingsView.vue`](/project/Claude-DevSprite/source?path=web/src/views/SettingsView.vue) 文件。
- **配置数据流**：此 `aiConfig.model` 字段应被后端读取，并作为 AI 调用时的默认模型参数，供代码审查（CodeReviewer）、设计检查（DesignScanner）以及知识库生成等各类 AI 分析任务使用。
- **设计一致性**：此变更完善了项目的配置体系，使用户能通过 Web 界面统一管理模型设置，与项目旨在提供“零配置使用”和直观管理的目标相一致。

## 对用户的提示

对于部署或更新了此版本的用户：
1. 可以在 Web Dashboard 的 `Settings` > `AI` 标签页中，于“Shared Configuration”部分看到并设置“Default Model”。
2. 此设置将作为所有 Agent 的初始模型。如需为特定 Agent（如扫描器、修复器）使用不同模型，请在下方相应的 per-agent 配置部分进行单独指定。
