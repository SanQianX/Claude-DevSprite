# 需求澄清文档

## 状态：待讨论

## 探索性问题

### Q1: Claude Code CLI 的 stream-json 输出格式

现有设计假设 `claude --output-format stream-json` 输出 `{"type":"assistant",...}`, `{"type":"tool_use",...}` 等事件。但 CLI 的实际输出格式可能与假设不同。

**需要确认**：
- 实际的 JSON 行格式是什么？每个 type 的字段有哪些？
- 是否有 `tool_result` 事件？还是只有 `tool_use` 和 `assistant`？
- 输出是每行一个 JSON，还是可能有多行 JSON？

**验证方法**：实际运行 `claude --print --output-format stream-json -p "hello"` 观察输出。

### Q2: 多 Team 并行执行的资源限制

三个 Team 同时 spawn claude CLI 进程，意味着同时有 3 个 AI 对话在运行。

**需要确认**：
- 每个 CLI 进程的内存/CPU 占用预估？
- API 的并发限制（Rate Limit）如何处理？
- 是否需要限制同时运行的 Team 数量？
- 用户机器配置较低时如何降级？

### Q3: 前端聊天的交互模式

**需要确认**：
- 用户发送消息后，AI 是否会反过来问问题（多轮对话）？
- 还是每次都是单轮指令执行？
- 如果是多轮对话，对话历史如何管理？是持久化还是只在内存中？

### Q4: Team Skills 的加载机制

Test Team 需要 Playwright 等 Skills。

**需要确认**：
- Skills 是 npm 包还是自定义模块？
- Skills 的初始化时机（Team 启动时还是首次使用时）？
- Skills 如何与 Claude Code CLI 集成？CLI 本身不支持自定义 tools，Skills 是通过 Bash 命令间接调用的吗？

### Q5: 开发日志的粒度

**需要确认**：
- 日志记录每次 AI 对话的完整内容，还是只记录关键决策和文件变更？
- 完整对话可能非常长（几十 KB），是否需要截断？
- 日志文件的保留策略（自动清理旧日志？）

### Q6: 安全性 — CLI 工具白名单

`--allowedTools` 限制了 CLI 可用的工具，但：

**需要确认**：
- `--allowedTools` 是否支持通配符？如 `Bash(npm:*)` 是否真的只允许 npm 开头的命令？
- `--disallowedTools` 的优先级是否高于 `--allowedTools`？
- CLI 是否有内置的安全机制防止路径遍历？

### Q7: 错误处理与恢复

**需要确认**：
- CLI 进程崩溃（exit code != 0）时，是否自动重试？
- 超时后是直接 kill 还是先发送 SIGTERM 等待优雅退出？
- 某个 Team 失败是否影响其他 Team 继续执行？
- Lead 如何感知 Team 的失败并做出决策？

### Q8: 知识库迁移策略

现有 `knowledge/` 目录需要迁移到 `.Claude-DevSprite/knowledge/`。

**需要确认**：
- 是否需要自动迁移脚本？
- 迁移后旧路径是否保留（向后兼容）？
- 现有的 Git Commit 检测器路径如何更新？

### Q9: 前端与后端的实时通信

**需要确认**：
- SSE 还是 WebSocket？现有设计用 SSE，但 WebSocket 是否更适合双向通信？
- 前端断线重连机制？
- 多个浏览器标签页同时打开时如何处理？

### Q10: 测试策略 — 如何 mock CLI 进程

**需要确认**：
- 单元测试中如何 mock `spawn('claude', ...)` ？
- 是否需要录制真实的 CLI 输出作为 fixture？
- E2E 测试是否需要真实的 Claude API 调用？（涉及费用）

### Q11: .Claude-DevSprite 与 .claude 的关系

**需要确认**：
- `.Claude-DevSprite/` 是否放在 `.claude/` 内部？还是独立的同级目录？
- Claude Code 的 `.claude/settings.json` 中的配置是否与 `.Claude-DevSprite/settings.json` 有冲突？

### Q12: 现有功能的兼容性

**需要确认**：
- 现有的 Git Commit 检测 → 知识库更新流程是否需要改动？
- 现有的 Web Dashboard 路由是否需要调整？
- 现有的 `/api/` 路由是否全部保留？

---

## 待用户确认的问题

以下问题需要用户直接回答：

1. **Q3**: 前端聊天是对话式还是单轮指令？
2. **Q4**: Skills 是 npm 包还是自定义模块？
3. **Q5**: 开发日志记录完整对话还是摘要？
4. **Q8**: 旧 knowledge/ 是否需要迁移？
5. **Q11**: .Claude-DevSprite 放在哪里？
