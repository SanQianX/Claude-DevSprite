# Bug Fix: 自动修复批量逻辑 - 只修复新发现的问题

## 问题描述

自动修复功能 (`POST /api/projects/:name/reviews/fix-batch`) 会处理项目中**所有待审批**的 review，而不是只处理本次扫描发现的新问题。如果之前积累了 300+ 个旧的 pending review，自动修复会尝试修复全部，导致：
1. 修复了不应该修复的旧问题
2. 进度条计数不正确
3. 大量不必要的 AI 调用

## 修复方案

后端 `fix-batch` 端点新增 `reviewIds` 参数，前端在扫描后只传递新发现的 review ID。

## 修复状态

✅ 已修复并通过 Playwright UI 测试验证 (5/5 passed)
