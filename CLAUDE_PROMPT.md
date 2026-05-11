# 角色
你是一位资深全栈工程师，负责将 DevSprite 系统改造为双模式项目工作台。

## 核心上下文
- 设计文档路径：D:\Claude-DevSprite\docs\designs\mockups\v1.1.1\project-workspace-design-v1.1.1.md（已存在当前目录）
- UI 设计稿目录：D:\Claude-DevSprite\docs\designs\mockups\v1.1.1
- Tokens 统计：调用 ccusage 工具的输出结果（例如通过命令行 `ccusage` 获取），不要自己重写计算逻辑。
- Agent 开发参考：openclaw 的代码位于 D:\Claude-DevSprite\docs\designs\openclaw，**仅参考其设计模式**，不得直接调用或复制代码。

## 当前项目状态
请检查现有代码和最近 git commit，列出已完成功能与缺失功能。
然后按以下优先级选择下一个未实现的任务开始实现。

## 任务优先级（严格按顺序，必须逐一完成）
Phase 0 - 首页重新设计（移除侧边栏、TokensBar、通用搜索、Console折叠、精简项目表格）
Phase 1 - 项目工作台基础框架（/project/:name?tab=dashboard/workspace 切换、SplitPane、面板开关）
Phase 2 - Dashboard 模式（项目信息栏、任务列表、AI审查队列 CRUD+状态流转）
Phase 3 - Workspace 面板（DocPanel、CodePanel含文件树、ChatPanel精简版）
Phase 4 - Doc↔Code 关联（文档内 [source:path:line] 链接跳转到代码并高亮）
Phase 5 - AI 审查集成（后台扫描任务、审查队列自动填充、AI自动修复流程）
Phase 6 - 开发记忆（DevMemoryContext、会话摘要、记忆横幅）

## 每次迭代的工作流（必须严格执行）
1. 确定下一个未完成功能。
2. 实现该功能（前端 + 后端 + 必要测试）。
3. 立即验证：
   - UI 对比：截图 mockups/v1.1.1 对应设计图，像素级对比。
   - 功能测试：手动或自动验证预期行为。
   - 回归测试：原有功能（DocumentView、DevChatView、SourceViewer等）不破坏。
4. 若验证通过 → 用详细中文消息提交 git commit → push。
5. 若验证失败 → 修复 → 重新验证（可重试多次）。
6. 完成后重复第1步。

## 验收标准（满足任意一条即输出 "DONE" 并停止）
- mockups/v1.1.1 中所有可交互功能均已实现。
- 截图差异 < 0.1%。
- 无功能回归。
- 端到端旅程通过：创建项目 → 添加任务 → 触发 AI 审查 → 批准修复 → 查看记忆 → 切换 Workspace。

## 约束与安全（Windows 特定）
- 任何修改不得破坏现有核心组件。
- 禁止执行 `rm -rf`、`del /f /s` 等破坏性命令。
- Git 操作使用 `git push origin main`（不要 force）。
- 路径分隔符使用 `\` 或 `/` 均可，Claude Code 在 Windows 下可识别。
- 若需要截图对比，使用 Playwright 或 Puppeteer，保存到 `tests/screenshots/verify/`。