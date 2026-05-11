---
title: 变更记录
category: changelog
createdAt: '2026-05-11T14:15:40.252Z'
updatedAt: '2026-05-11T14:15:40.252Z'
relations: []
---

# 变更记录

## 提交信息

- **提交类型**: `test` - 测试相关
- **提交消息**: `[Auto-Fix] Phase 1: 添加首页15个Playwright E2E测试用例`

## 变更内容

### 1. playwright.config.ts

**变更类型**: 新增

**变更详情**:
- 创建了 Playwright E2E 测试的项目配置文件。
- **核心配置**:
  - 测试目录 (`testDir`)：指定为 `./tests/e2e`。
  - 超时设置 (`timeout`)：每个测试用例最大执行时间设为 60 秒。
  - 重试策略 (`retries`)：设置为 0，即不自动重试失败的测试。
  - 基础 URL (`baseURL`)：指向本地开发服务器 `http://localhost:5173`。
  - 运行模式 (`headless`)：配置为无头模式（`true`）。
  - 失败时的截图与追踪：配置了 `screenshot: 'only-on-failure'` 和 `trace: 'retain-on-failure'`，便于调试。
- **项目配置**：定义了一个名为 `chromium` 的项目，仅使用 Chromium 浏览器执行测试。
- 新增行数: 19， 删除行数: 0

**影响范围**: 建立了前端 E2E 测试的基础环境和执行策略。

### 2. tests/e2e/home.spec.ts

**变更类型**: 新增

**变更详情**:
- 为 Web Dashboard 的首页 (`/`) 创建了完整的端到端（E2E）测试套件。
- **测试结构**:
  - 使用 `test.describe` 组织测试，描述为 `'Home Page (/)'`。
  - 使用 `test.beforeEach` 钩子，在每个测试前自动导航到首页并等待页面加载完成（使用 `waitForLoadState('load')`，而非 `networkidle`，以避免 SSE 连接导致的超时）。
- **测试用例 (共15个)**：
  1. `home-01`: 验证页面加载和项目列表表格（或空状态）的可见性。
  2. `home-02`: 验证搜索输入框存在。
  3. `home-03`: 验证“新建项目”按钮存在。
  4. `home-04`: 验证项目列表表格表头（如“项目名称”、“最近提交”、“状态”）的显示。
  5. `home-05`: 测试搜索功能：输入关键词后，验证列表是否被过滤。
  6. `home-06`: 测试“新建项目”按钮的点击交互。
  7. `home-07`: 验证项目行的交互（如点击某一行）。
  8. `home-08`: 验证项目状态标签的显示。
  9. `home-09`: 验证“最近提交”时间显示。
  10. `home-10`: 测试空列表状态（在搜索无结果或项目为空时）。
  11. `home-11`: 验证响应式布局（例如在不同视口宽度下）。
  12. `home-12`: 测试加载状态（`loading-container`）的消失。
  13. `home-13`: 验证页面标题或核心标题元素的存在。
  14. `home-14`: 测试导航到项目详情页。
  15. `home-15`: 验证“快速分析”或其他特定功能按钮的存在。
- 新增行数: 259， 删除行数: 0

**影响范围**: 为首页的核心用户交互场景提供了自动化测试覆盖，提升了 Web Dashboard 前端的质量保障水平。

## 分析说明

本次提交是 `[Auto-Fix] Phase 1` 的一部分，主要目标是为项目的 Web Dashboard（基于 Vue 3 + Vite）的首页添加 E2E 测试用例。测试使用了业界标准的 Playwright 框架，覆盖了页面加载、元素可见性、搜索交互、按钮功能、状态显示等关键场景。

这些测试直接验证了 `web/src/views/ProjectView.vue`（首页视图）及其相关组件的功能是否正常工作。测试代码的引入，标志着项目开始建立前端自动化质量验证体系，与之前已有的后端逻辑和 AI 分析流程形成互补，共同保障产品交付质量。

由于变更内容为新增测试代码，不涉及项目架构、核心模块或技术栈的改变，因此无需更新 `project-overview` 目录下的架构、模块或技术栈文档。

## 相关文件

- [playwright.config.ts](/project/Claude-DevSprite/source?path=playwright.config.ts)
- [tests/e2e/home.spec.ts](/project/Claude-DevSprite/source?path=tests/e2e/home.spec.ts)
