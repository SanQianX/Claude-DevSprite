# 多 Agent Team 系统 — 测试计划

## 测试分层策略

```
┌─────────────────────────────────────────────────────────┐
│  E2E 测试（11-12）                                      │
│  完整流程：用户输入 → 多 Team 协作 → 结果验证          │
├─────────────────────────────────────────────────────────┤
│  集成测试（7-10）                                       │
│  模块间协作：文件通信、Team 调度、SSE 推送             │
├─────────────────────────────────────────────────────────┤
│  单元测试（1-6）                                        │
│  单个模块：TeamExecutor、FileProtocol、配置解析等      │
└─────────────────────────────────────────────────────────┘
```

---

## 一、单元测试

### 1.1 TeamExecutor 测试

**目标**：验证 CLI 进程的启动、输出解析、超时控制。

```typescript
// tests/teams/teamExecutor.test.ts

describe('TeamExecutor', () => {

  test('能成功 spawn claude 进程并获取输出', async () => {
    // 前提：机器上已安装 claude CLI
    const executor = new TeamExecutor('dev', {
      model: 'claude-sonnet-4-20250514',
      maxTurns: 3,
      allowedTools: ['Read', 'Glob'],
      timeout: 60000,
    }, '/path/to/test-project');

    const events: AgentEvent[] = [];
    for await (const event of executor.execute('列出项目根目录的文件')) {
      events.push(event);
    }

    // 验证：至少收到 agent_message 和 completed 事件
    expect(events.some(e => e.type === 'agent_message')).toBe(true);
    expect(events.some(e => e.type === 'completed')).toBe(true);
    // 验证：team 字段正确
    expect(events.every(e => e.team === 'dev')).toBe(true);
  });

  test('正确解析 tool_use 事件', async () => {
    // 用 mock 的 CLI 输出测试解析逻辑
    const executor = new TeamExecutor('dev', { ... }, projectPath);

    // 模拟 CLI 输出
    const mockOutput = [
      '{"type":"assistant","message":{"content":"我来读取文件"},"usage":{"input_tokens":100,"output_tokens":50}}',
      '{"type":"tool_use","id":"toolu_123","name":"Read","input":{"file_path":"src/index.ts"}}',
      '{"type":"tool_result","tool_use_id":"toolu_123","content":"// file content..."}',
      '{"type":"assistant","message":{"content":"文件读取完成"},"usage":{"input_tokens":200,"output_tokens":30}}',
    ].join('\n');

    const events = executor.parseOutputStream(mockOutput);

    expect(events).toHaveLength(4);
    expect(events[0].type).toBe('agent_message');
    expect(events[1].type).toBe('tool_call');
    expect(events[1].metadata?.toolName).toBe('Read');
    expect(events[2].type).toBe('tool_result');
    expect(events[3].type).toBe('agent_message');
  });

  test('超时后自动 kill 进程', async () => {
    const executor = new TeamExecutor('dev', {
      ...config,
      timeout: 1000, // 1 秒超时
    }, projectPath);

    const events: AgentEvent[] = [];
    const start = Date.now();

    for await (const event of executor.execute('执行一个非常非常长的任务...')) {
      events.push(event);
    }

    // 验证：在超时时间内结束
    expect(Date.now() - start).toBeLessThan(3000);
    // 验证：收到错误或完成事件
    expect(events.some(e => e.type === 'error' || e.type === 'completed')).toBe(true);
  });

  test('abort() 能中止正在执行的任务', async () => {
    const executor = new TeamExecutor('dev', config, projectPath);

    // 启动后立即中止
    setTimeout(() => executor.abort(), 500);

    const events: AgentEvent[] = [];
    for await (const event of executor.execute('long task')) {
      events.push(event);
    }

    // 验证：进程已终止
    expect(events.some(e => e.type === 'completed' || e.type === 'error')).toBe(true);
  });

  test('allowedTools 限制工具权限', async () => {
    const executor = new TeamExecutor('lead', {
      ...config,
      allowedTools: ['Read', 'Glob'], // 只允许只读
    }, projectPath);

    const events: AgentEvent[] = [];
    for await (const event of executor.execute('尝试写入文件 test.txt')) {
      events.push(event);
    }

    // 验证：Lead 没有执行 Write 工具
    const writeCalls = events.filter(
      e => e.type === 'tool_call' && e.metadata?.toolName === 'Write'
    );
    expect(writeCalls).toHaveLength(0);
  });

  test('处理 CLI 输出中的不完整 JSON 行', () => {
    const executor = new TeamExecutor('dev', config, projectPath);

    // 模拟被截断的输出
    const chunk1 = '{"type":"assistant","message":{"con';
    const chunk2 = 'tent":"hello"},"usage":{"input_tokens":100,"output_tokens":50}}\n';

    // 验证：缓冲区正确拼接，不抛异常
    const events = executor.parseOutputStream(chunk1 + chunk2);
    expect(events).toHaveLength(1);
    expect(events[0].content).toBe('hello');
  });

  test('CLI 不存在时抛出有意义的错误', async () => {
    const executor = new TeamExecutor('dev', config, projectPath);
    // mock spawn 返回不存在的命令
    // 验证：抛出包含 "claude CLI not found" 的错误
  });
});
```

### 1.2 FileProtocol 测试

```typescript
// tests/teams/fileProtocol.test.ts

describe('FileProtocol', () => {
  const testDir = '/tmp/test-project/.Claude-DevSprite/teams';

  beforeEach(() => fs.mkdir(testDir, { recursive: true }));
  afterEach(() => fs.rm(testDir, { recursive: true }));

  test('写入任务 MD 到 inbox', async () => {
    const protocol = new FileProtocol(testDir);
    const task: Task = {
      id: 'task-001',
      type: 'development',
      priority: 'high',
      assignedTo: 'dev',
      title: '实现登录功能',
      description: '添加 JWT 认证',
      acceptanceCriteria: ['POST /api/login 返回 token'],
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    await protocol.writeTask('dev', task);

    const content = await fs.readFile(`${testDir}/dev/inbox/task-001.md`, 'utf-8');
    expect(content).toContain('taskId: "task-001"');
    expect(content).toContain('实现登录功能');
    expect(content).toContain('JWT');
  });

  test('从 inbox 读取任务', async () => {
    const protocol = new FileProtocol(testDir);

    // 先写入
    await protocol.writeTask('dev', { id: 'task-001', ... });

    // 读取
    const tasks = await protocol.readTasks('dev');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('task-001');
    expect(tasks[0].assignedTo).toBe('dev');
  });

  test('写入结果到 outbox', async () => {
    const protocol = new FileProtocol(testDir);
    const result: TaskResult = {
      taskId: 'task-001',
      status: 'completed',
      completedAt: new Date().toISOString(),
      model: 'claude-sonnet-4-20250514',
      summary: '登录功能已实现',
      changedFiles: ['src/auth/login.ts', 'src/auth/middleware.ts'],
    };

    await protocol.writeResult('dev', result);

    const content = await fs.readFile(`${testDir}/dev/outbox/task-001-result.md`, 'utf-8');
    expect(content).toContain('completed');
    expect(content).toContain('src/auth/login.ts');
  });

  test('读取空 inbox 返回空数组', async () => {
    const protocol = new FileProtocol(testDir);
    const tasks = await protocol.readTasks('dev');
    expect(tasks).toEqual([]);
  });

  test('task MD 的 Frontmatter 能被正确解析', async () => {
    const protocol = new FileProtocol(testDir);

    // 写入一个带所有字段的 task
    await protocol.writeTask('test', {
      id: 'task-002',
      type: 'testing',
      priority: 'medium',
      assignedTo: 'test',
      title: '测试登录',
      description: '编写 E2E 测试',
      acceptanceCriteria: ['测试通过'],
      createdAt: '2026-05-03T22:00:00Z',
      status: 'pending',
    });

    const tasks = await protocol.readTasks('test');
    expect(tasks[0].type).toBe('testing');
    expect(tasks[0].priority).toBe('medium');
    expect(tasks[0].createdAt).toBe('2026-05-03T22:00:00Z');
  });
});
```

### 1.3 TeamConfig 测试

```typescript
// tests/teams/teamConfig.test.ts

describe('TeamConfig', () => {
  test('读取有效的 team config.json', async () => {
    const config = await TeamConfig.load('/path/to/teams/dev/config.json');
    expect(config.name).toBe('dev');
    expect(config.model).toContain('claude');
    expect(config.allowedTools).toContain('Read');
    expect(config.allowedTools).toContain('Write');
  });

  test('config 缺少必填字段时抛出验证错误', async () => {
    // model 缺失
    await expect(
      TeamConfig.load('/path/to/invalid-config.json')
    ).rejects.toThrow('model is required');
  });

  test('保存 config 后文件内容正确', async () => {
    const config = new TeamConfig({
      name: 'dev',
      model: 'claude-sonnet-4-20250514',
      maxTurns: 20,
      allowedTools: ['Read', 'Write'],
    });

    await config.save('/tmp/test-config.json');
    const content = JSON.parse(await fs.readFile('/tmp/test-config.json', 'utf-8'));
    expect(content.model).toBe('claude-sonnet-4-20250514');
  });
});
```

### 1.4 TeamManager 单元测试

```typescript
// tests/teams/teamManager.test.ts

describe('TeamManager', () => {
  test('handleChat 将用户消息转发给 Lead', async () => {
    const manager = new TeamManager(projectPath);
    // mock Lead 的 TeamExecutor
    manager.setExecutor('lead', mockExecutor);

    const events: ChatEvent[] = [];
    for await (const event of manager.handleChat('添加登录功能')) {
      events.push(event);
    }

    // 验证：Lead 被调用
    expect(mockExecutor.execute).toHaveBeenCalledWith(
      expect.stringContaining('添加登录功能'),
      expect.any(String)
    );
  });

  test('Lead 分配任务时，task MD 写入对应 team inbox', async () => {
    const manager = new TeamManager(projectPath);

    // mock Lead 返回任务分配事件
    mockExecutor.execute.mockImplementation(async function* () {
      yield { type: 'agent_message', team: 'lead', content: '分配任务给 Dev' };
    });

    // mock FileProtocol
    const writeSpy = jest.spyOn(manager.fileProtocol, 'writeTask');

    for await (const event of manager.handleChat('添加登录功能')) { /* consume */ }

    expect(writeSpy).toHaveBeenCalledWith('dev', expect.objectContaining({
      assignedTo: 'dev',
    }));
  });

  test('并行启动 Dev 和 Test Team', async () => {
    const manager = new TeamManager(projectPath);
    const devSpy = jest.spyOn(manager, 'executeTeam');
    const testSpy = jest.spyOn(manager, 'executeTeam');

    // mock Lead 返回两个任务分配
    // 验证：dev 和 test 的 executeTeam 都被调用
    // 验证：两者是并行的（用 Promise.all 验证时间重叠）
  });
});
```

---

## 二、集成测试

### 2.1 Lead → Dev 完整通信流程

```typescript
// tests/teams/integration/leadToDev.test.ts

describe('Lead → Dev 通信', () => {
  test('完整流程：Lead 写任务 → 读取 inbox → 执行 → 写结果 → Lead 读取', async () => {
    // 1. 初始化真实项目目录（用 test-fixtures）
    const projectPath = await createTestProject();

    // 2. 创建 Lead 和 Dev 的真实 TeamSession
    const leadSession = new TeamSession('lead', leadConfig, projectPath);
    const devSession = new TeamSession('dev', devConfig, projectPath);

    // 3. Lead 分析需求并分配任务
    const leadEvents: AgentEvent[] = [];
    for await (const event of leadSession.execute('给项目添加一个 hello world API 端点')) {
      leadEvents.push(event);
    }

    // 4. 验证 task MD 已写入 dev/inbox
    const inboxFiles = await fs.readdir(`${projectPath}/.Claude-DevSprite/teams/dev/inbox`);
    expect(inboxFiles.length).toBeGreaterThan(0);

    // 5. Dev 读取并执行任务
    const devEvents: AgentEvent[] = [];
    const task = await fileProtocol.readTasks('dev');
    for await (const event of devSession.execute(task[0].description)) {
      devEvents.push(event);
    }

    // 6. 验证：Dev 产生了文件变更
    const outboxFiles = await fs.readdir(`${projectPath}/.Claude-DevSprite/teams/dev/outbox`);
    expect(outboxFiles.length).toBeGreaterThan(0);

    // 7. 验证：变更的文件确实存在
    const result = await fileProtocol.readResults('dev');
    for (const file of result[0].changedFiles) {
      expect(fs.access(`${projectPath}/${file}`)).resolves.toBeUndefined();
    }
  }, 120000); // 2 分钟超时
});
```

### 2.2 SSE 推送测试

```typescript
// tests/teams/integration/sseStream.test.ts

describe('SSE 实时推送', () => {
  test('聊天消息通过 SSE 推送到前端', async () => {
    // 启动测试服务器
    const server = await startTestServer();
    const eventSource = new EventSource(`http://localhost:${server.port}/api/chat/stream`);

    const receivedEvents: any[] = [];
    eventSource.onmessage = (e) => receivedEvents.push(JSON.parse(e.data));

    // 发送聊天消息
    await fetch(`http://localhost:${server.port}/api/chat/send`, {
      method: 'POST',
      body: JSON.stringify({ message: '列出项目文件' }),
    });

    // 等待事件
    await waitFor(() => receivedEvents.length > 0, 30000);

    // 验证：收到 agent_message 类型的事件
    expect(receivedEvents.some(e => e.type === 'agent_message')).toBe(true);

    eventSource.close();
    await server.close();
  });

  test('多个 Team 的事件都通过同一个 SSE 流推送', async () => {
    // 发送一个需要 Lead + Dev 协作的请求
    // 验证：SSE 流中同时包含 team: 'lead' 和 team: 'dev' 的事件
  });
});
```

### 2.3 前端 API 集成测试

```typescript
// tests/teams/integration/api.test.ts

describe('Team API', () => {
  test('GET /api/teams 返回所有 team 配置', async () => {
    const res = await request(app).get('/api/teams');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body.map((t: any) => t.name)).toEqual(['lead', 'dev', 'test']);
  });

  test('PUT /api/teams/dev 更新 team 配置', async () => {
    const res = await request(app)
      .put('/api/teams/dev')
      .send({ model: 'claude-opus-4-20250514', maxTurns: 30 });

    expect(res.status).toBe(200);

    // 验证配置已持久化
    const config = await TeamConfig.load(`${projectPath}/.Claude-DevSprite/teams/dev/config.json`);
    expect(config.model).toBe('claude-opus-4-20250514');
  });

  test('POST /api/teams/dev/test 测试 API 连通性', async () => {
    const res = await request(app).post('/api/teams/dev/test');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/chat/send 返回 SSE 流', async () => {
    const res = await request(app)
      .post('/api/chat/send')
      .send({ message: 'hello' })
      .buffer(false);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
  });
});
```

---

## 三、E2E 测试

### 3.1 完整开发流程测试

```typescript
// tests/teams/e2e/fullDevelopmentFlow.test.ts

describe('E2E: 完整开发流程', () => {

  // 使用一个真实的测试项目（小型 Express 应用）
  let projectPath: string;

  beforeAll(async () => {
    // 复制 test-fixtures/mini-express-app 到临时目录
    projectPath = await copyFixture('mini-express-app');
  });

  test('用户输入 → Lead 分析 → Dev 写代码 → Test 测试 → 知识库更新', async () => {
    // 1. 初始化 .Claude-DevSprite
    await initDevSprite(projectPath);

    // 2. 发送开发请求
    const response = await fetch(`http://localhost:${port}/api/chat/send`, {
      method: 'POST',
      body: JSON.stringify({ message: '添加一个 GET /api/health 端点，返回 {"status":"ok"}' }),
    });

    // 3. 收集所有 SSE 事件
    const events = await collectSSEEvents(response);

    // 4. 验证事件序列
    const leadMessages = events.filter(e => e.team === 'lead');
    const devMessages = events.filter(e => e.team === 'dev');

    expect(leadMessages.length).toBeGreaterThan(0); // Lead 有输出
    expect(devMessages.length).toBeGreaterThan(0);   // Dev 有输出

    // 5. 验证代码已写入
    const healthRoute = await fs.readFile(`${projectPath}/src/routes/health.ts`, 'utf-8');
    expect(healthRoute).toContain('/api/health');
    expect(healthRoute).toContain('ok');

    // 6. 验证开发日志已生成
    const sessions = await fs.readdir(`${projectPath}/.Claude-DevSprite/development`);
    expect(sessions.length).toBeGreaterThan(0);

    const timeline = await fs.readFile(
      `${projectPath}/.Claude-DevSprite/development/${sessions[0]}/timeline.md`, 'utf-8'
    );
    expect(timeline).toContain('Lead');
    expect(timeline).toContain('Dev');

    // 7. 验证知识库已更新（如果配置了自动更新）
    const changelog = await fs.readdir(`${projectPath}/.Claude-DevSprite/knowledge/changelog`);
    expect(changelog.length).toBeGreaterThan(0);
  }, 300000); // 5 分钟超时

  test('生成的代码能通过编译', async () => {
    // 执行 npm run build / tsc
    const result = await exec('npx tsc --noEmit', { cwd: projectPath });
    expect(result.exitCode).toBe(0);
  }, 60000);

  test('生成的代码能通过测试', async () => {
    // 如果 Test Team 写了测试
    const result = await exec('npx vitest run', { cwd: projectPath });
    expect(result.exitCode).toBe(0);
  }, 60000);
});
```

### 3.2 边界情况测试

```typescript
// tests/teams/e2e/edgeCases.test.ts

describe('E2E: 边界情况', () => {

  test('Claude CLI 未安装时给出友好错误', async () => {
    // 暂时修改 PATH 使 claude 不可用
    const manager = new TeamManager(projectPath, { PATH: '/empty' });

    await expect(
      collectAll(manager.handleChat('hello'))
    ).rejects.toThrow('claude CLI not found');
  });

  test('CLI 进程崩溃时正确处理', async () => {
    // mock spawn 返回一个立即退出的进程（exit code 1）
    // 验证：收到 error 事件，不是 hang
  });

  test('任务超时后 Team 能恢复', async () => {
    // 设置很短的 timeout
    // 发送一个复杂任务
    // 验证：超时后能正常处理下一个任务
  });

  test('并发执行多个 Team 不冲突', async () => {
    // 同时启动 Lead、Dev、Test
    // 验证：各自的文件操作不互相干扰
    // 验证：每个 Team 的 inbox/outbox 独立
  });

  test('项目目录包含空格和中文时正常工作', async () => {
    const projectPath = await copyFixture('mini-express-app', '我的 项目');
    // 验证：所有路径操作正常
  });

  test('.Claude-DevSprite 目录不存在时自动创建', async () => {
    const projectPath = await createEmptyDir();
    await initDevSprite(projectPath);
    // 验证：目录结构完整创建
  });

  test('大量任务时 inbox 不溢出', async () => {
    // 连续发送 50 个任务
    // 验证：所有 task MD 都正确写入
    // 验证：不会因为文件数量导致性能问题
  });
});
```

### 3.3 Skills 测试

```typescript
// tests/teams/e2e/skills.test.ts

describe('E2E: Skills 系统', () => {

  test('Playwright Skill 能打开浏览器并截图', async () => {
    // 启动一个测试 HTTP 服务器
    const testServer = await startStaticServer('<h1>Hello</h1>');

    // Test Team 使用 Playwright Skill
    const testSession = new TeamSession('test', {
      ...testConfig,
      skills: ['playwright'],
    }, projectPath);

    const events: AgentEvent[] = [];
    for await (const event of testSession.execute(
      `打开 http://localhost:${testServer.port}，截图保存到 test-results/screenshot.png`
    )) {
      events.push(event);
    }

    // 验证：截图文件已创建
    expect(fs.access(`${projectPath}/test-results/screenshot.png`)).resolves.toBeUndefined();

    await testServer.close();
  }, 120000);

  test('图像分析 Skill 能分析截图内容', async () => {
    // 提供一张已知内容的截图
    // 验证：分析结果包含预期描述
  });
});
```

---

## 四、性能测试

```typescript
// tests/teams/performance/load.test.ts

describe('性能测试', () => {
  test('单个 Team 任务响应时间 < 30 秒（简单任务）', async () => {
    const start = Date.now();
    const events = await collectAll(leadSession.execute('列出 src/ 目录结构'));
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(30000);
  });

  test('三个 Team 并行执行不互相阻塞', async () => {
    const start = Date.now();
    const [devResult, testResult] = await Promise.all([
      collectAll(devSession.execute('创建 src/utils/helper.ts')),
      collectAll(testSession.execute('列出 tests/ 目录')),
    ]);
    const duration = Date.now() - start;

    // 并行时间应小于串行时间之和
    expect(duration).toBeLessThan(60000);
  });
});
```

---

## 五、测试 Fixtures

```
tests/fixtures/
├── mini-express-app/           ← 一个最小的 Express 项目
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts
│   │   └── routes/
│   │       └── index.ts
│   └── .Claude-DevSprite/      ← 预初始化的配置
│       ├── settings.json
│       └── teams/
│           ├── lead/config.json
│           ├── dev/config.json
│           └── test/config.json
│
├── mock-cli-output/            ← 模拟的 CLI 输出
│   ├── simple-response.json
│   ├── tool-use-response.json
│   ├── error-response.json
│   └── truncated-response.json
│
└── team-configs/               ← 测试用的配置
    ├── valid-lead.json
    ├── valid-dev.json
    ├── invalid-missing-model.json
    └── invalid-bad-tools.json
```

---

## 六、Gate 对照表

| Gate | 对应测试 | 验证内容 |
|------|----------|----------|
| GATE-1 | teamConfig.test.ts | 配置读写正确 |
| GATE-2 | teamExecutor.test.ts | CLI 进程启动成功 |
| GATE-3 | teamExecutor.test.ts | stream-json 输出正确解析 |
| GATE-4 | teamExecutor.test.ts | 超时自动 kill |
| GATE-5 | fileProtocol.test.ts | inbox/outbox 读写正确 |
| GATE-6 | leadToDev.test.ts | Lead → Dev 完整通信 |
| GATE-7 | integration tests | 三个 Team 并行执行 |
| GATE-8 | api.test.ts | API 端点响应正确 |
| GATE-9 | sseStream.test.ts | SSE 推送正常 |
| GATE-10 | fullDevelopmentFlow.test.ts | 完整开发流程 |
| GATE-11 | edgeCases.test.ts | 边界情况处理 |
| GATE-12 | fullDevelopmentFlow.test.ts | 开发日志生成 |
