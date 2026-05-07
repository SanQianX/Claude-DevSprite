# 多 Agent Team 协作系统开发计划

## 状态：待用户确认

## 一、需求清单

### 1.1 核心功能
1. **TeamExecutor**: Claude Code CLI 执行器
   - 启动 `claude` 进程
   - 解析 stream-json 输出
   - 超时控制和进程管理

2. **FileProtocol**: 文件通信协议
   - inbox/outbox 读写
   - 任务和结果的序列化
   - 并发安全控制

3. **TeamManager**: 核心调度器
   - 管理三个 Team 的生命周期
   - 任务分配和结果收集
   - 错误处理和恢复

4. **前端聊天界面**: Vue 3 + SSE
   - 实时显示 Agent 活动
   - 任务队列展示
   - Team 状态监控

### 1.2 质量门禁（12 个）
| Gate | 验证内容 | 优先级 |
|------|----------|--------|
| GATE-1 | 配置读写正确 | P0 |
| GATE-2 | CLI 进程启动成功 | P0 |
| GATE-3 | stream-json 输出正确解析 | P0 |
| GATE-4 | 超时自动 kill | P0 |
| GATE-5 | inbox/outbox 读写正确 | P0 |
| GATE-6 | Lead → Dev 完整通信 | P0 |
| GATE-7 | 三个 Team 并行执行 | P1 |
| GATE-8 | API 端点响应正确 | P0 |
| GATE-9 | SSE 推送正常 | P1 |
| GATE-10 | 完整开发流程 | P1 |
| GATE-11 | 边界情况处理 | P2 |
| GATE-12 | 开发日志生成 | P2 |

---

## 二、技术栈选择

### 2.1 后端
- **运行时**: Node.js + TypeScript
- **框架**: Express
- **进程管理**: child_process
- **文件通信**: fs + 文件锁
- **实时推送**: SSE (Server-Sent Events)

### 2.2 前端
- **框架**: Vue 3 + TypeScript
- **构建工具**: Vite
- **状态管理**: Pinia
- **路由**: Vue Router
- **HTTP 客户端**: Axios

### 2.3 测试
- **单元测试**: Vitest
- **集成测试**: Supertest
- **E2E 测试**: Playwright

---

## 三、任务分解

### Phase 1: 基础框架（3 天）
**并行任务**:
- [ ] 设计 Agent: 创建 `src/teams/types.ts` 类型定义
- [ ] 开发 Agent: 创建 `src/teams/teamConfig.ts` 配置读写
- [ ] 测试 Agent: 编写 GATE-1 测试用例

**交付物**:
- 类型定义文件
- 配置读写模块
- 配置测试用例

### Phase 2: TeamExecutor（4 天）
**并行任务**:
- [ ] 设计 Agent: 设计 CLI 执行器接口
- [ ] 开发 Agent: 实现 `src/teams/teamExecutor.ts`
- [ ] 测试 Agent: 编写 GATE-2, GATE-3, GATE-4 测试用例

**交付物**:
- CLI 执行器实现
- 流式 JSON 解析器
- 超时控制机制

### Phase 3: 文件通信（3 天）
**并行任务**:
- [ ] 设计 Agent: 设计文件协议格式
- [ ] 开发 Agent: 实现 `src/teams/fileProtocol.ts`
- [ ] 测试 Agent: 编写 GATE-5 测试用例

**交付物**:
- 文件协议实现
- inbox/outbox 管理
- 并发安全控制

### Phase 4: TeamManager（4 天）
**并行任务**:
- [ ] 设计 Agent: 设计调度器架构
- [ ] 开发 Agent: 实现 `src/teams/teamManager.ts`
- [ ] 测试 Agent: 编写 GATE-6, GATE-7 测试用例

**交付物**:
- 核心调度器
- 任务分配逻辑
- 结果收集机制

### Phase 5: API 集成（3 天）
**并行任务**:
- [ ] 设计 Agent: 设计 API 接口
- [ ] 开发 Agent: 实现 `src/worker/routes/teams.ts`
- [ ] 测试 Agent: 编写 GATE-8 测试用例

**交付物**:
- Team API 路由
- SSE 推送接口
- 错误处理中间件

### Phase 6: 前端聊天界面（5 天）
**并行任务**:
- [ ] 设计 Agent: 设计 UI 组件
- [ ] 开发 Agent: 实现聊天组件
- [ ] 测试 Agent: 编写 GATE-9, GATE-10 测试用例

**交付物**:
- DevChatView 主页面
- ChatMessageList 组件
- TeamStatusPanel 组件

### Phase 7: 集成测试（3 天）
**并行任务**:
- [ ] 设计 Agent: 设计集成测试方案
- [ ] 开发 Agent: 修复集成问题
- [ ] 测试 Agent: 编写 GATE-11, GATE-12 测试用例

**交付物**:
- 集成测试用例
- 边界情况测试
- 开发日志测试

---

## 四、并行任务分配

### 4.1 设计 Agent 任务
1. Phase 1: 类型定义设计
2. Phase 2: CLI 执行器接口设计
3. Phase 3: 文件协议格式设计
4. Phase 4: 调度器架构设计
5. Phase 5: API 接口设计
6. Phase 6: UI 组件设计
7. Phase 7: 集成测试方案设计

### 4.2 开发 Agent 任务
1. Phase 1: 配置读写实现
2. Phase 2: CLI 执行器实现
3. Phase 3: 文件协议实现
4. Phase 4: 核心调度器实现
5. Phase 5: API 路由实现
6. Phase 6: 前端组件实现
7. Phase 7: 集成问题修复

### 4.3 测试 Agent 任务
1. Phase 1: GATE-1 测试用例
2. Phase 2: GATE-2, GATE-3, GATE-4 测试用例
3. Phase 3: GATE-5 测试用例
4. Phase 4: GATE-6, GATE-7 测试用例
5. Phase 5: GATE-8 测试用例
6. Phase 6: GATE-9, GATE-10 测试用例
7. Phase 7: GATE-11, GATE-12 测试用例

---

## 五、里程碑

### 里程碑 1: 基础框架完成（第 3 天）
- ✅ 类型定义完成
- ✅ 配置读写完成
- ✅ GATE-1 通过

### 里程碑 2: 核心执行器完成（第 7 天）
- ✅ CLI 执行器完成
- ✅ 流式解析完成
- ✅ GATE-2, GATE-3, GATE-4 通过

### 里程碑 3: 通信协议完成（第 10 天）
- ✅ 文件协议完成
- ✅ 并发控制完成
- ✅ GATE-5 通过

### 里程碑 4: 调度器完成（第 14 天）
- ✅ 核心调度器完成
- ✅ 任务分配完成
- ✅ GATE-6, GATE-7 通过

### 里程碑 5: API 集成完成（第 17 天）
- ✅ API 路由完成
- ✅ SSE 推送完成
- ✅ GATE-8 通过

### 里程碑 6: 前端完成（第 22 天）
- ✅ 聊天界面完成
- ✅ 实时推送完成
- ✅ GATE-9, GATE-10 通过

### 里程碑 7: 集成测试完成（第 25 天）
- ✅ 集成测试完成
- ✅ 边界测试完成
- ✅ GATE-11, GATE-12 通过

---

## 六、验收标准

### 6.1 功能验收
1. 用户可以通过聊天界面发送开发请求
2. Lead Agent 能够分析需求并分配任务
3. Dev Agent 能够执行开发任务并返回结果
4. Test Agent 能够执行测试任务并返回结果
5. 所有 Agent 的活动通过 SSE 实时推送到前端

### 6.2 质量验收
1. 所有 12 个质量门禁通过
2. 单元测试覆盖率 > 80%
3. 集成测试覆盖核心流程
4. E2E 测试覆盖完整开发流程

### 6.3 性能验收
1. 单个 Team 任务响应时间 < 30 秒（简单任务）
2. 三个 Team 并行执行不互相阻塞
3. SSE 推送延迟 < 1 秒

### 6.4 安全验收
1. CLI 工具白名单生效
2. 路径遍历防护生效
3. 文件锁防止并发冲突

---

## 七、风险与应对

### 7.1 高风险
| 风险 | 应对措施 |
|------|----------|
| CLI 进程崩溃 | 实现进程健康检查和自动恢复 |
| 文件锁死锁 | 使用超时机制和死锁检测 |
| SSE 消息丢失 | 实现消息队列和重连机制 |

### 7.2 中风险
| 风险 | 应对措施 |
|------|----------|
| 测试环境不稳定 | 使用录制的 CLI 输出作为 fixture |
| 前端状态不一致 | 实现客户端状态同步机制 |
| 性能瓶颈 | 实现进程池和资源限制 |

### 7.3 低风险
| 风险 | 应对措施 |
|------|----------|
| 代码维护成本 | 实现完善的文档和注释 |
| 技术债务 | 定期重构和代码审查 |

---

## 八、待用户确认

1. **开发周期**: 25 天是否可接受？
2. **资源分配**: 是否需要增加人手？
3. **优先级调整**: 是否需要调整门禁优先级？
4. **技术选型**: 是否有特殊技术要求？
5. **验收标准**: 是否需要调整验收标准？

---

## 九、附录

### 9.1 术语表
- **Team**: 指 Lead、Dev、Test 中的任意一个
- **CLI**: Claude Code 命令行工具
- **SSE**: Server-Sent Events
- **inbox/outbox**: 文件通信的收发信箱

### 9.2 参考文档
- `docs/designs/01-multi-agent-system.md` - 系统设计方案
- `docs/designs/02-test-plan.md` - 测试计划
- `docs/designs/03-requirement-clarification.md` - 需求澄清文档
- `docs/designs/04-critical-review-meeting.md` - 批判会议记录
