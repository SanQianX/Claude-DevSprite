# 多模型 Agent Team 协作系统 — 完整设计方案

## 一、系统定位

Claude-DevSprite 从一个"知识库自动生成工具"升级为一个**多模型 AI 开发协作平台**：

| 能力 | v0.1（当前） | v0.2（目标） |
|------|-------------|-------------|
| 知识库生成 | ✅ 单模型 | ✅ 多模型 |
| 代码开发 | ❌ | ✅ 聊天式开发 |
| 自动测试 | ❌ | ✅ 浏览器测试 + 截图 |
| 团队协作 | ❌ | ✅ Lead/Dev/Test 三角色 |
| 前端管理 | 文档浏览 | 文档 + 聊天 + Team 配置 |

---

## 二、架构全景

```
┌─────────────────────────────────────────────────────────────────────┐
│                         前端 Dashboard (Vue 3)                       │
│                                                                     │
│  ┌──────────┐  ┌──────────────────────┐  ┌───────────────────────┐  │
│  │ 知识库    │  │  开发聊天界面         │  │  Team 管理            │  │
│  │ 浏览器   │  │  ┌─────────────────┐ │  │  - API 配置           │  │
│  │          │  │  │ 对话消息流       │ │  │  - Skills 配置        │  │
│  │          │  │  │ Agent 活动日志   │ │  │  - 模型选择           │  │
│  │          │  │  │ 文件变更 diff    │ │  │  - 能力开关           │  │
│  │          │  │  └─────────────────┘ │  │                       │  │
│  │          │  │  ┌─────────────────┐ │  │                       │  │
│  │          │  │  │ 输入框 [发送]   │ │  │                       │  │
│  │          │  │  └─────────────────┘ │  │                       │  │
│  └──────────┘  └──────────────────────┘  └───────────────────────┘  │
│        ↕ SSE           ↕ SSE                    ↕ REST              │
└─────────────────────────────────────────────────────────────────────┘
                           ↓ HTTP + SSE
┌─────────────────────────────────────────────────────────────────────┐
│                    后端 Worker Server (Express)                      │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Chat API (/api/chat)                                       │    │
│  │  接收用户消息 → 转发给 Lead → 流式返回所有 Agent 活动       │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  TeamManager（核心调度器）                                    │    │
│  │                                                             │    │
│  │  ┌──────────┐   ┌──────────┐   ┌──────────┐               │    │
│  │  │ Lead     │   │ Dev      │   │ Test     │               │    │
│  │  │ Session  │   │ Session  │   │ Session  │               │    │
│  │  │          │   │          │   │          │               │    │
│  │  │ model: A │   │ model: B │   │ model: C │               │    │
│  │  │ prompt:  │   │ prompt:  │   │ prompt:  │               │    │
│  │  │ 协调者   │   │ 开发者   │   │ 测试者   │               │    │
│  │  └────┬─────┘   └────┬─────┘   └────┬─────┘               │    │
│  │       │              │              │                      │    │
│  │       ↓              ↓              ↓                      │    │
│  │  ┌─────────────────────────────────────────────────────┐   │    │
│  │  │  AIClient（通用 AI 接口）                            │   │    │
│  │  │  支持 OpenAI 兼容 API（DeepSeek / GPT / Claude 等）  │   │    │
│  │  └─────────────────────────────────────────────────────┘   │    │
│  │       │              │              │                      │    │
│  │       ↓              ↓              ↓                      │    │
│  │  ┌─────────────────────────────────────────────────────┐   │    │
│  │  │  ToolExecutor（工具执行器）                           │   │    │
│  │  │  - 文件读写 (read_file / write_file / edit_file)    │   │    │
│  │  │  - 命令执行 (run_command)                           │   │    │
│  │  │  - 浏览器控制 (browser_open / screenshot)           │   │    │
│  │  │  - 测试执行 (run_tests)                             │   │    │    │
│  │  └─────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  FileProtocol（文件通信协议）                                │    │
│  │  读写 .Claude-DevSprite/teams/*/inbox|outbox/*.md          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  KnowledgeManager（知识库管理）                              │    │
│  │  Git commit 触发 → 更新 knowledge/ + development/          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  SSE Stream（实时推送）                                      │    │
│  │  推送: Agent 消息 / 文件变更 / 任务状态 / 错误              │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    用户项目目录                                      │
│                                                                     │
│  project/                                                           │
│  ├── .Claude-DevSprite/              ← 系统管理目录                 │
│  │   ├── knowledge/                  ← 知识库                      │
│  │   ├── development/                ← 开发文档                    │
│  │   │   ├── session-{id}/           ← 每次开发会话               │
│  │   │   │   ├── lead-tasks.md       ← Lead 下达的任务记录        │
│  │   │   │   ├── dev-feedback.md     ← Dev 执行反馈              │
│  │   │   │   ├── test-feedback.md    ← Test 执行反馈             │
│  │   │   │   ├── timeline.md         ← 时间线日志                │
│  │   │   │   └── summary.md          ← 会话总结                  │
│  │   │   └── ...                     ← 历史会话                   │
│  │   ├── teams/                      ← Team 配置 + 通信           │
│  │   │   ├── lead/                   ← Lead: tasks/ logs/        │
│  │   │   ├── dev/                    ← Dev: inbox/ outbox/ logs/ │
│  │   │   └── test/                   ← Test: inbox/ outbox/ logs/│
│  │   └── settings.json               ← 全局配置                  │
│  │                                                                 │
│  ├── src/                            ← 项目源代码                  │
│  └── ...                                                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 三、核心模块设计

### 3.1 AgentEvent — 统一事件类型

所有 Team 的 Claude Code CLI 输出都转换为统一的 `AgentEvent`，前端只认这个格式。

```typescript
// src/teams/types.ts

interface AgentEvent {
  type: 'agent_message' | 'tool_call' | 'tool_result' | 'file_change' | 'error' | 'completed';
  team: 'lead' | 'dev' | 'test';
  content: string;
  metadata?: {
    toolName?: string;
    toolArgs?: Record<string, any>;
    filePath?: string;
    fileAction?: 'created' | 'modified' | 'deleted';
    duration?: number;
    tokenUsage?: { prompt: number; completion: number };
  };
}
```

### 3.2 TeamExecutor — Claude Code CLI 执行器

每个 Team 通过独立的 `claude` CLI 子进程执行任务。利用 Claude Code 自带的项目感知、工具链和自主规划能力。

#### 启动方式

使用 `child_process.spawn` 启动：

```bash
claude \
  --print \                          # 非交互模式，执行完退出
  --output-format stream-json \      # 流式 JSON 输出
  --model <model> \                  # 指定模型
  --max-turns 15 \                   # 限制工具调用轮次
  --allowedTools "Read,Write,Edit,Bash(git:*),Bash(npm:*),Bash(npx:*)" \
  -p "你需要完成的任务描述"
```

#### 实现

```typescript
// src/teams/teamExecutor.ts

import { spawn, ChildProcess } from 'child_process';

interface TeamExecutorConfig {
  model: string;                    // e.g. "claude-sonnet-4-20250514"
  maxTurns: number;                 // e.g. 20
  allowedTools: string[];           // e.g. ["Read","Write","Edit","Bash(npm:*)"]
  disallowedTools?: string[];       // e.g. ["Bash(rm *)"]
  timeout?: number;                 // 超时毫秒数，默认 600000 (10min)
}

class TeamExecutor {
  private process: ChildProcess | null = null;
  private config: TeamExecutorConfig;
  private projectPath: string;
  private teamName: string;

  constructor(teamName: string, config: TeamExecutorConfig, projectPath: string) {
    this.teamName = teamName;
    this.config = config;
    this.projectPath = projectPath;
  }

  async *execute(prompt: string, context?: string): AsyncIterable<AgentEvent> {
    const args = [
      '--print',
      '--output-format', 'stream-json',
      '--model', this.config.model,
      '--max-turns', String(this.config.maxTurns),
    ];

    if (this.config.allowedTools.length > 0) {
      args.push('--allowedTools', this.config.allowedTools.join(','));
    }

    // 组装完整 prompt（含上下文）
    const fullPrompt = context
      ? `## 上下文\n${context}\n\n## 任务\n${prompt}`
      : prompt;
    args.push('-p', fullPrompt);

    this.process = spawn('claude', args, {
      cwd: this.projectPath,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let buffer = '';

    // 按行解析 stream-json 输出
    for await (const chunk of this.process.stdout!) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop()!; // 保留不完整的行

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          const mapped = this.mapEvent(event);
          if (mapped) yield mapped;
        } catch { /* 忽略非 JSON 行 */ }
      }
    }

    yield { type: 'completed', team: this.teamName as any, content: '任务执行完成' };
  }

  abort(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }

  /** 将 Claude Code CLI 事件映射为统一 AgentEvent */
  private mapEvent(cliEvent: any): AgentEvent | null {
    switch (cliEvent.type) {
      case 'assistant':
        return {
          type: 'agent_message',
          team: this.teamName as any,
          content: cliEvent.message?.content || '',
          metadata: {
            tokenUsage: cliEvent.usage
              ? { prompt: cliEvent.usage.input_tokens, completion: cliEvent.usage.output_tokens }
              : undefined,
          },
        };

      case 'tool_use':
        return {
          type: 'tool_call',
          team: this.teamName as any,
          content: `调用工具: ${cliEvent.name}`,
          metadata: {
            toolName: cliEvent.name,
            toolArgs: cliEvent.input,
          },
        };

      case 'tool_result':
        return {
          type: 'tool_result',
          team: this.teamName as any,
          content: typeof cliEvent.content === 'string'
            ? cliEvent.content.slice(0, 500) // 截断过长结果
            : JSON.stringify(cliEvent.content).slice(0, 500),
          metadata: {
            toolName: cliEvent.tool_use_id,
          },
        };

      default:
        return null;
    }
  }
}
```

#### 事件映射表

| CLI 输出 type | AgentEvent | 说明 |
|---------------|------------|------|
| `assistant` | `agent_message` | AI 的思考/回复 |
| `tool_use` | `tool_call` | 开始调用工具（含参数） |
| `tool_result` | `tool_result` | 工具执行结果 |
| 文件写入检测 | `file_change` | 通过监控文件系统或解析工具结果 |
| 进程退出 | `completed` | 任务结束 |

#### 安全性

- `--allowedTools` 白名单：每个 Team 配置不同的工具权限
- `--disallowedTools` 黑名单：禁止危险命令
- `cwd` 限定在项目目录
- `timeout` 超时自动 kill 进程
- 不同 Team 的推荐权限：

| Team | allowedTools | 说明 |
|------|-------------|------|
| Lead | `Read,Glob,Grep,WebSearch` | 只读，不修改代码 |
| Dev | `Read,Write,Edit,Bash(npm:*),Bash(npx:*),Bash(git:*)` | 完整开发能力 |
| Test | `Read,Bash(npm test),Bash(npx playwright:*),Bash(npx vitest:*)` | 测试 + 浏览器 |

### 3.3 TeamSession — Team 会话

每个 Team 是一个独立的会话，封装 TeamExecutor 并管理对话上下文。

```typescript
// src/teams/teamSession.ts

class TeamSession {
  private teamName: 'lead' | 'dev' | 'test';
  private executor: TeamExecutor;

  constructor(teamName: string, config: TeamConfig, projectPath: string) {
    this.teamName = teamName;
    this.executor = new TeamExecutor(teamName, {
      model: config.model,
      maxTurns: config.maxTurns || 15,
      allowedTools: config.allowedTools,
      disallowedTools: config.disallowedTools,
      timeout: config.timeout || 600000,
    }, projectPath);
  }

  /** 执行任务，流式返回事件 */
  async *execute(prompt: string, context?: string): AsyncIterable<AgentEvent> {
    yield* this.executor.execute(prompt, context);
  }

  abort(): void { this.executor.abort(); }
}
```

### 3.4 TeamManager — 核心调度器

```typescript
// src/teams/teamManager.ts

class TeamManager {
  private sessions: Map<string, TeamSession> = new Map();
  private sseBroadcaster: SSEBroadcaster;

  // 处理用户聊天消息
  async handleChat(userMessage: string, session: DevSession): AsyncGenerator<ChatEvent> {
    // 1. 创建或获取 Lead session
    // 2. Lead 分析用户需求
    // 3. 如果 Lead 决定分配任务:
    //    a. 写 task MD 到 dev/inbox 和 test/inbox
    //    b. 启动 Dev session 和 Test session 并行执行
    //    c. 收集结果，写到 outbox
    //    d. Lead 读取结果，整合回复
    // 4. 通过 SSE 流式推送所有活动到前端
  }

  // 启动开发会话
  async startDevSession(projectPath: string): Promise<DevSession> { ... }

  // 获取 Team 状态
  getTeamStatus(teamName: string): TeamStatus { ... }
}
```

### 3.5 FileProtocol — 文件通信协议

```typescript
// src/teams/fileProtocol.ts

class FileProtocol {
  private basePath: string; // .Claude-DevSprite/teams

  // Lead 写任务到 Team 的 inbox
  async writeTask(teamName: string, task: Task): Promise<void> {
    const filePath = `${this.basePath}/${teamName}/inbox/${task.id}.md`;
    const content = this.taskToMarkdown(task);
    await fs.writeFile(filePath, content);
  }

  // Team 写结果到自己的 outbox
  async writeResult(teamName: string, result: TaskResult): Promise<void> {
    const filePath = `${this.basePath}/${teamName}/outbox/${result.taskId}-result.md`;
    const content = this.resultToMarkdown(result);
    await fs.writeFile(filePath, content);
  }

  // Lead 读取 Team 的 outbox
  async readResults(teamName: string): Promise<TaskResult[]> { ... }

  // Team 读取自己的 inbox
  async readTasks(teamName: string): Promise<Task[]> { ... }
}
```

---

## 四、Team 配置系统

### 4.1 全局配置

```json
// .Claude-DevSprite/settings.json
{
  "version": "0.2.0",
  "projectName": "my-app",
  "teams": {
    "lead": {
      "enabled": true,
      "displayName": "Lead 协调者",
      "description": "分析需求、拆解任务、协调团队"
    },
    "dev": {
      "enabled": true,
      "displayName": "开发团队",
      "description": "编写代码、实现功能"
    },
    "test": {
      "enabled": true,
      "displayName": "测试团队",
      "description": "编写测试、UI 测试、截图验证"
    }
  },
  "communication": {
    "protocol": "file-based",
    "pollInterval": 3000,
    "taskTimeout": 300000
  },
  "knowledge": {
    "autoUpdateOnCommit": true,
    "knowledgePath": ".Claude-DevSprite/knowledge",
    "developmentPath": ".Claude-DevSprite/development"
  }
}
```

### 4.2 Team 配置

每个 Team 直接配置 Claude Code CLI 参数。不同 Team 可通过 `model` 字段使用不同的 Claude 模型。

#### Lead Team

```json
// .Claude-DevSprite/teams/lead/config.json
{
  "name": "lead",
  "displayName": "Lead 协调者",
  "model": "claude-sonnet-4-20250514",
  "maxTurns": 15,
  "allowedTools": ["Read", "Glob", "Grep", "WebSearch"],
  "timeout": 600000,
  "skills": []
}
```

#### Dev Team

```json
// .Claude-DevSprite/teams/dev/config.json
{
  "name": "dev",
  "displayName": "开发团队",
  "model": "claude-sonnet-4-20250514",
  "maxTurns": 20,
  "allowedTools": ["Read", "Write", "Edit", "Bash(npm:*)", "Bash(npx:*)", "Bash(git:*)"],
  "disallowedTools": ["Bash(rm *)", "Bash(git push --force)"],
  "timeout": 600000,
  "skills": []
}
```

#### Test Team

```json
// .Claude-DevSprite/teams/test/config.json
{
  "name": "test",
  "displayName": "测试团队",
  "model": "claude-sonnet-4-20250514",
  "maxTurns": 15,
  "allowedTools": ["Read", "Glob", "Grep", "Bash(npm test)", "Bash(npx vitest:*)", "Bash(npx playwright:*)"],
  "timeout": 600000,
  "skills": ["playwright"],
  "skillConfig": {
    "playwright": {
      "browser": "chromium",
      "headless": true,
      "viewport": { "width": 1280, "height": 720 }
    }
  }
}
```

### 4.3 Skills 系统

每个 Skill 是一个可插拔的能力模块：

```
src/teams/skills/
├── skillRegistry.ts          ← Skill 注册表
├── types.ts                  ← Skill 接口定义
├── playwright/
│   ├── index.ts              ← Playwright Skill 入口
│   ├── browserTools.ts       ← browser_open, browser_click, browser_type
│   ├── screenshotTools.ts    ← screenshot
│   └── package.json          ← 依赖声明
├── imageAnalysis/
│   ├── index.ts              ← 图像分析 Skill
│   └── visionClient.ts       ← 调用视觉模型 API
└── git/
    ├── index.ts              ← Git 操作 Skill
    └── tools.ts              ← git_status, git_diff, git_commit
```

```typescript
// src/teams/skills/types.ts

interface Skill {
  name: string;
  description: string;
  tools: ToolDefinition[];           // 该 Skill 提供的工具
  initialize(config: any): Promise<void>;  // 初始化（如启动浏览器）
  cleanup(): Promise<void>;               // 清理资源
}
```

---

## 五、前端设计

### 5.1 页面布局

```
┌─────────────────────────────────────────────────────────────────┐
│  Claude-DevSprite    [项目: my-app]     [设置] [Team 管理]     │
├──────────┬──────────────────────────────────┬───────────────────┤
│          │                                  │                   │
│  侧边栏   │         主内容区                 │   右侧面板        │
│          │                                  │                   │
│ 📁 知识库 │  ┌────────────────────────────┐  │  Team 状态        │
│  ├ 概览   │  │                            │  │  ┌─────────────┐  │
│  ├ 架构   │  │  聊天消息流                │  │  │ Lead: 🟢 空闲│  │
│  ├ 模块   │  │                            │  │  │ Dev:  🟢 空闲│  │
│  └ 变更   │  │  👤: 添加用户登录功能       │  │  │ Test: 🟢 空闲│  │
│          │  │                            │  │  └─────────────┘  │
│ 📋 开发   │  │  🤖 Lead: 分析需求中...     │  │                   │
│  ├ 日志   │  │  🤖 Lead: 已分配 task-001   │  │  最近文件变更     │
│  ├ 会话   │  │     给 Dev Team            │  │  ┌─────────────┐  │
│  └ 记录   │  │  🤖 Lead: 已分配 task-002   │  │  │ + src/auth/ │  │
│          │  │     给 Test Team           │  │  │ + src/api/  │  │
│ ⚙️ Team   │  │  🔧 Dev: 正在编写代码...    │  │  │ ~ README.md │  │
│  ├ Lead   │  │  🔧 Dev: 已创建 3 个文件    │  │  └─────────────┘  │
│  ├ Dev    │  │  🔧 Test: 正在编写测试...   │  │                   │
│  └ Test   │  │  🔧 Test: 截图分析中...     │  │  任务队列         │
│          │  │  🤖 Lead: 所有任务完成      │  │  ┌─────────────┐  │
│          │  │  🤖 Lead: 已更新知识库       │  │  │ ✅ task-001 │  │
│          │  │                            │  │  │ ✅ task-002 │  │
│          │  ├────────────────────────────┤  │  │ ⏳ task-003 │  │
│          │  │ [输入消息...]          [发送]│  │  └─────────────┘  │
│          │  └────────────────────────────┘  │                   │
└──────────┴──────────────────────────────────┴───────────────────┘
```

### 5.2 关键组件

```
web/src/
├── views/
│   ├── DevChatView.vue              ← 开发聊天主页面
│   ├── TeamManageView.vue           ← Team 配置管理
│   └── DevSessionView.vue           ← 历史会话查看
│
├── components/
│   ├── chat/
│   │   ├── ChatMessageList.vue      ← 消息流（支持多种消息类型）
│   │   ├── ChatInput.vue            ← 输入框 + 发送
│   │   ├── ChatMessage.vue          ← 单条消息（用户/Agent/工具/文件变更）
│   │   ├── ToolCallCard.vue         ← 工具调用展示卡片
│   │   ├── FileDiffCard.vue         ← 文件变更 diff 展示
│   │   └── AgentActivityFeed.vue    ← Agent 活动流
│   │
│   ├── teams/
│   │   ├── TeamStatusPanel.vue      ← Team 状态面板
│   │   ├── TeamConfigForm.vue       ← API 配置表单
│   │   ├── SkillSelector.vue        ← Skills 选择器
│   │   ├── TaskQueue.vue            ← 任务队列展示
│   │   └── TeamLogViewer.vue        ← Team 日志
│   │
│   └── dev-session/
│       ├── SessionTimeline.vue      ← 开发时间线
│       ├── LeadTaskList.vue         ← Lead 任务列表
│       └── TeamFeedbackPanel.vue    ← Team 反馈面板
│
├── api/
│   ├── chat.ts                      ← 聊天 API（SSE 流式）
│   ├── teams.ts                     ← Team 管理 API
│   └── devSession.ts                ← 开发会话 API
│
└── stores/
    ├── chat.ts                      ← 聊天状态
    ├── teams.ts                     ← Team 状态
    └── devSession.ts                ← 开发会话状态
```

---

## 六、开发日志系统

### 6.1 目录结构

```
.Claude-DevSprite/development/
├── session-20260503-001/            ← 每次开发会话
│   ├── metadata.json                ← 会话元数据
│   ├── lead-tasks.md                ← Lead 下达的所有任务
│   ├── dev-feedback.md              ← Dev Team 的执行反馈
│   ├── test-feedback.md             ← Test Team 的执行反馈
│   ├── timeline.md                  ← 完整时间线
│   ├── file-changes.md              ← 文件变更汇总
│   └── summary.md                   ← 会话总结
│
├── session-20260503-002/
│   └── ...
│
└── index.md                         ← 会话索引
```

### 6.2 会话记录格式

```markdown
<!-- timeline.md -->
# 开发会话时间线

### 示例时间线
- 用户输入: "给项目添加用户登录功能"

## 22:00:05 — Lead 分析需求
- Lead: 分析用户需求，识别需要 JWT 认证、登录 API、中间件

## 22:00:15 — Lead 分配任务
- task-001 → Dev Team: "实现 JWT 认证和登录 API"
- task-002 → Test Team: "编写登录功能测试用例"

## 22:00:20 — Dev Team 开始执行
- Dev (deepseek-coder): 正在分析项目结构...
- Dev: 调用 read_file("src/config.ts")
- Dev: 调用 write_file("src/auth/login.ts", ...)
- Dev: 调用 write_file("src/auth/middleware.ts", ...)
- Dev: 调用 run_command("npm install jsonwebtoken")

## 22:01:30 — Dev Team 完成
- 变更文件: src/auth/login.ts, src/auth/middleware.ts, src/routes/auth.ts
- 状态: ✅ 完成

## 22:01:35 — Test Team 开始执行
- Test (gpt-4o): 正在编写测试...
- Test: 调用 write_file("tests/auth.test.ts", ...)
- Test: 调用 run_command("npx vitest run tests/auth.test.ts")
- Test: 调用 browser_open("http://localhost:3000/login")
- Test: 调用 screenshot("test-results/login-page.png")
- Test: 调用 analyze_screenshot("test-results/login-page.png", "登录表单是否正常显示？")

## 22:03:00 — Test Team 完成
- 测试结果: 5 passed, 0 failed
- UI 截图: 正常

## 22:03:10 — Lead 整合结果
- Lead: 所有任务完成，更新知识库
- Lead: 调用 write_file(".Claude-DevSprite/knowledge/changelog/...", ...)
```

---

## 七、API 设计

### 7.1 新增路由

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/chat/send` | POST | 发送聊天消息，返回 SSE 流 |
| `/api/chat/history` | GET | 获取聊天历史 |
| `/api/teams` | GET | 获取所有 Team 列表 |
| `/api/teams/:name` | GET | 获取单个 Team 配置 |
| `/api/teams/:name` | PUT | 更新 Team 配置 |
| `/api/teams/:name/status` | GET | 获取 Team 运行状态 |
| `/api/teams/:name/test` | POST | 测试 Team API 连通性 |
| `/api/dev-sessions` | GET | 获取开发会话列表 |
| `/api/dev-sessions/:id` | GET | 获取会话详情 |
| `/api/dev-sessions/:id/timeline` | GET | 获取会话时间线 |

### 7.2 聊天 API（SSE 流式）

```
POST /api/chat/send
Body: { "message": "给项目添加用户登录功能", "sessionId": "xxx" }
Response: SSE stream

event: agent_message
data: {"team":"lead","type":"thinking","content":"分析用户需求..."}

event: agent_message
data: {"team":"lead","type":"task_assigned","taskId":"task-001","assignedTo":"dev"}

event: tool_call
data: {"team":"dev","tool":"read_file","args":{"path":"src/config.ts"}}

event: tool_result
data: {"team":"dev","tool":"read_file","result":"..."}

event: file_change
data: {"team":"dev","action":"created","path":"src/auth/login.ts"}

event: agent_message
data: {"team":"dev","type":"completed","content":"已创建 3 个文件"}

event: agent_message
data: {"team":"lead","type":"summary","content":"开发完成，已更新知识库"}
```

---

## 八、实现阶段

### Phase 1：基础框架（.Claude-DevSprite 目录 + 配置）

**新增文件**：
- `src/teams/types.ts` — 类型定义
- `src/teams/teamConfig.ts` — 配置读写
- `src/teams/skillRegistry.ts` — Skill 注册
- `src/worker/routes/teams.ts` — Team API
- `.Claude-DevSprite/settings.json` — 默认配置

**改动文件**：
- `src/config.ts` — 添加 .Claude-DevSprite 路径配置
- `src/worker/routes/index.ts` — 注册新路由

### Phase 2：TeamExecutor（Claude Code CLI 执行器）

**新增文件**：
- `src/teams/types.ts` — AgentEvent 类型定义
- `src/teams/teamExecutor.ts` — Claude Code CLI 执行器

### Phase 3：Team 会话 + 文件通信

**新增文件**：
- `src/teams/teamSession.ts` — Team 会话
- `src/teams/teamManager.ts` — 核心调度器
- `src/teams/fileProtocol.ts` — 文件通信协议
- `src/teams/taskDispatcher.ts` — 任务分发
- `src/teams/resultCollector.ts` — 结果收集

### Phase 4：开发日志

**新增文件**：
- `src/teams/devSessionManager.ts` — 开发会话管理
- `src/teams/devLogger.ts` — 开发日志记录

### Phase 5：Skills 系统

**新增文件**：
- `src/teams/skills/playwright/` — Playwright 浏览器 Skill
- `src/teams/skills/imageAnalysis/` — 图像分析 Skill

**新增依赖**：
- `playwright` — 浏览器自动化
- `sharp` 或调用外部视觉 API

### Phase 6：前端聊天界面

**新增文件**：
- `web/src/views/DevChatView.vue`
- `web/src/components/chat/` — 聊天组件
- `web/src/components/teams/` — Team 配置组件
- `web/src/api/chat.ts`
- `web/src/stores/chat.ts`
- `web/src/stores/teams.ts`

**改动文件**：
- `web/src/router/index.ts` — 添加新路由
- `web/src/components/layout/AppSidebar.vue` — 添加导航项

### Phase 7：知识库迁移 + 集成

- 将 `knowledge/` 迁移到 `.Claude-DevSprite/knowledge/`
- 更新现有 detector/analyzer 路径配置
- 集成测试

---

## 九、与现有系统的关系

```
现有系统（v0.1）                    新增系统（v0.2）
─────────────────                   ─────────────────
Git Commit 检测  ─────────────────→ 触发知识库更新（已有）
                                   触发 Lead 分析是否需要开发（新增）

AI 分析引擎      ─────────────────→ 生成知识文档（已有）
                                   AIClient 通用调用（新增）

知识库管理       ─────────────────→ storageManager 读写（已有）
                                   迁移到 .Claude-DevSprite/knowledge/（改动）

Worker Server    ─────────────────→ 现有 9 个路由（已有）
                                   + /api/chat, /api/teams, /api/dev-sessions（新增）

前端 Dashboard   ─────────────────→ 知识库浏览（已有）
                                   + 聊天开发（新增）
                                   + Team 管理（新增）
```
