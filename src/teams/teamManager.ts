/**
 * TeamManager - Core Scheduler
 * Manages Team lifecycle, task distribution, and result collection
 */

import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { TeamExecutor } from './teamExecutor';
import { TeamConfigManager } from './teamConfig';
import { FileProtocol } from './fileProtocol';
import { getDatabase } from '../worker/db';
import type {
  TeamName,
  TeamConfig,
  TeamStatus,
  Task,
  TaskResult,
  AgentEvent,
  ChatEvent,
} from './types';

const logger = createLogger('team-manager');

export class TeamManager extends EventEmitter {
  private configManager: TeamConfigManager;
  private fileProtocol: FileProtocol;
  private executors: Map<TeamName, TeamExecutor> = new Map();
  private statuses: Map<TeamName, TeamStatus> = new Map();
  private projectPath: string;

  constructor(projectPath: string) {
    super();
    this.projectPath = projectPath;
    this.configManager = new TeamConfigManager(projectPath);
    this.fileProtocol = new FileProtocol(projectPath);

    // Initialize team statuses
    for (const name of ['lead', 'dev', 'test'] as TeamName[]) {
      this.statuses.set(name, { name, status: 'idle' });
    }
  }

  /**
   * Initialize the team system
   */
  async initialize(): Promise<void> {
    await this.configManager.initialize();
    logger.info('TeamManager initialized');
  }

  /**
   * Handle user chat message
   * Routes message to Lead, then coordinates Dev and Test
   */
  async *handleChat(userMessage: string): AsyncGenerator<ChatEvent> {
    logger.info(`Received user message: ${userMessage.slice(0, 100)}`);

    // Step 1: Send to Lead for analysis
    const leadConfig = await this.configManager.load('lead');
    const leadExecutor = this.getOrCreateExecutor('lead', leadConfig);

    this.updateStatus('lead', 'busy', '分析需求');

    const leadEvents: AgentEvent[] = [];

    // Add task marker instruction to prompt so lead outputs [TASK: ...] markers
    const promptWithTaskInstruction = `${userMessage}

---
[SYSTEM] 当你在分析中识别到需要执行的具体任务（如创建文件、修复bug、添加功能等）时，请在回复中使用任务标记格式：
- [TASK: 任务标题]
- [TASK: 任务标题 | priority: high|medium|low|critical | status: todo|in_progress|backlog]
- [TASK: 任务标题 | desc: 简短描述]

示例：
[TASK: 添加用户认证模块 | priority: high | desc: 实现 JWT token 认证]
[TASK: 编写单元测试 | priority: medium]
[TASK: 修复登录页面样式 | priority: low | status: backlog]

这些标记会被系统自动识别并创建为任务。请只在确实需要跟踪的任务上使用标记，不要滥用。[/SYSTEM]`;

    for await (const event of leadExecutor.execute(promptWithTaskInstruction)) {
      leadEvents.push(event);

      // Forward lead events to chat (preserve metadata for tool names)
      yield {
        type: event.type === 'agent_message' ? 'agent_message' : event.type as any,
        team: 'lead',
        content: event.content,
        metadata: event.metadata,
      };
    }

    this.updateStatus('lead', 'idle');

    // Step 2a: Parse [TASK: ...] markers from lead's response and save to DB
    const agentContent = leadEvents
      .filter(e => e.type === 'agent_message')
      .map(e => e.content)
      .join('\n');
    const dbTasks = this.parseTaskMarkersFromContent(agentContent);
    if (dbTasks.length > 0) {
      yield { type: 'system', team: 'lead', content: `AI 建议创建 ${dbTasks.length} 个任务` };
      try {
        const created = await this.saveTasksToDb(dbTasks);
        yield { type: 'system', team: 'lead', content: `已自动创建任务: ${created.map(t => `#${t.id} ${t.title}`).join(', ')}` };
      } catch (err: any) {
        logger.error(`Failed to save tasks to DB: ${err.message}`);
        yield { type: 'error', team: 'lead', content: `自动创建任务失败: ${err.message}` };
      }
    }

    // Step 2: Parse tasks from lead's output
    const tasks = this.parseTasksFromLeadOutput(leadEvents);

    if (tasks.length === 0) {
      return;
    }

    // Step 3: Distribute tasks to Dev and Test
    yield { type: 'system', team: 'lead', content: `已分配 ${tasks.length} 个任务` };

    const devTasks = tasks.filter(t => t.assignedTo === 'dev');
    const testTasks = tasks.filter(t => t.assignedTo === 'test');

    // Execute Dev and Test in parallel
    const promises: Promise<void>[] = [];

    if (devTasks.length > 0) {
      promises.push(this.executeTeamTasks('dev', devTasks));
    }

    if (testTasks.length > 0) {
      promises.push(this.executeTeamTasks('test', testTasks));
    }

    await Promise.all(promises);

    // Step 4: Collect results and update Lead
    const devResults = await this.fileProtocol.readResults('dev');
    const testResults = await this.fileProtocol.readResults('test');

    // Step 5: Lead summarizes results
    const summaryPrompt = this.buildSummaryPrompt(devResults, testResults);
    const summaryExecutor = this.getOrCreateExecutor('lead', leadConfig);

    for await (const event of summaryExecutor.execute(summaryPrompt)) {
      yield {
        type: event.type === 'agent_message' ? 'agent_message' : event.type as any,
        team: 'lead',
        content: event.content,
        metadata: event.metadata,
      };
    }

    yield { type: 'completed', team: 'lead', content: '所有任务完成' };
  }

  /**
   * Execute tasks for a specific team
   */
  private async executeTeamTasks(teamName: TeamName, tasks: Task[]): Promise<void> {
    const config = await this.configManager.load(teamName);
    const executor = this.getOrCreateExecutor(teamName, config);

    this.updateStatus(teamName, 'busy', `执行 ${tasks.length} 个任务`);

    for (const task of tasks) {
      // Write task to inbox
      await this.fileProtocol.writeTask(teamName, task);

      // Execute task
      const context = this.buildTaskContext(task);
      const events: AgentEvent[] = [];

      for await (const event of executor.execute(task.description, context)) {
        events.push(event);
      }

      // Collect results
      const result: TaskResult = {
        taskId: task.id,
        status: 'completed',
        completedAt: new Date().toISOString(),
        model: config.model,
        summary: events.filter(e => e.type === 'agent_message').map(e => e.content).join('\n'),
        changedFiles: this.extractChangedFiles(events),
      };

      await this.fileProtocol.writeResult(teamName, result);
    }

    this.updateStatus(teamName, 'idle');
  }

  /**
   * Get or create executor for a team
   */
  private getOrCreateExecutor(teamName: TeamName, config: TeamConfig): TeamExecutor {
    let executor = this.executors.get(teamName);

    if (!executor) {
      executor = new TeamExecutor(teamName, {
        model: config.model,
        maxTurns: config.maxTurns,
        allowedTools: config.allowedTools,
        disallowedTools: config.disallowedTools,
        timeout: config.timeout,
      }, this.projectPath);

      this.executors.set(teamName, executor);
    }

    return executor;
  }

  /**
   * Update team status
   */
  private updateStatus(teamName: TeamName, status: TeamStatus['status'], currentTask?: string): void {
    const teamStatus: TeamStatus = {
      name: teamName,
      status,
      currentTask,
      lastActivity: new Date().toISOString(),
    };

    this.statuses.set(teamName, teamStatus);
    this.emit('statusChange', teamStatus);
  }

  /**
   * Parse tasks from lead's output
   */
  private parseTasksFromLeadOutput(events: AgentEvent[]): Task[] {
    const tasks: Task[] = [];
    const content = events
      .filter(e => e.type === 'agent_message')
      .map(e => e.content)
      .join('\n');

    // Look for task patterns like "task-001", "task-002", etc.
    const taskPattern = /task-(\d+)/g;
    let match;

    while ((match = taskPattern.exec(content)) !== null) {
      const taskId = match[0];

      // Try to extract task details from context
      const task: Task = {
        id: taskId,
        type: 'development',
        priority: 'medium',
        assignedTo: content.includes('Dev') ? 'dev' : 'test',
        title: `任务 ${taskId}`,
        description: this.extractTaskDescription(content, taskId),
        acceptanceCriteria: [],
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      tasks.push(task);
    }

    return tasks;
  }

  /**
   * Extract task description from lead's output
   */
  private extractTaskDescription(content: string, taskId: string): string {
    // Look for content after the task ID
    const pattern = new RegExp(`${taskId}[:\\s]+(.+?)(?=task-|$)`, 's');
    const match = content.match(pattern);
    return match?.[1]?.trim() || `执行任务 ${taskId}`;
  }

  /**
   * Build context for a task
   */
  private buildTaskContext(task: Task): string {
    return `## 任务信息
- ID: ${task.id}
- 类型: ${task.type}
- 优先级: ${task.priority}
- 分配给: ${task.assignedTo}

## 任务描述
${task.description}

## 验收标准
${task.acceptanceCriteria.map(c => `- ${c}`).join('\n')}
`;
  }

  /**
   * Build summary prompt for lead
   */
  private buildSummaryPrompt(devResults: TaskResult[], testResults: TaskResult[]): string {
    let prompt = '## 任务执行结果汇总\n\n';

    if (devResults.length > 0) {
      prompt += '### 开发团队结果\n';
      for (const result of devResults) {
        prompt += `- 任务 ${result.taskId}: ${result.status}\n`;
        prompt += `  总结: ${result.summary.slice(0, 200)}\n`;
        if (result.changedFiles.length > 0) {
          prompt += `  变更文件: ${result.changedFiles.join(', ')}\n`;
        }
      }
      prompt += '\n';
    }

    if (testResults.length > 0) {
      prompt += '### 测试团队结果\n';
      for (const result of testResults) {
        prompt += `- 任务 ${result.taskId}: ${result.status}\n`;
        prompt += `  总结: ${result.summary.slice(0, 200)}\n`;
      }
      prompt += '\n';
    }

    prompt += '请总结所有任务的执行结果，并给出下一步建议。';

    return prompt;
  }

  /**
   * Extract changed files from events
   */
  private extractChangedFiles(events: AgentEvent[]): string[] {
    const files: Set<string> = new Set();

    for (const event of events) {
      if (event.type === 'tool_call' && event.metadata?.toolName === 'Write') {
        const filePath = event.metadata?.toolArgs?.file_path;
        if (filePath) {
          files.add(filePath);
        }
      }

      if (event.type === 'file_change' && event.metadata?.filePath) {
        files.add(event.metadata.filePath);
      }
    }

    return Array.from(files);
  }

  /**
   * Parse [TASK: ...] markers from agent content
   * Format: [TASK: title] or [TASK: title | priority: high | status: todo | desc: ...]
   */
  private parseTaskMarkersFromContent(content: string): Array<{ title: string; description?: string; priority?: string; status?: string }> {
    const tasks: Array<{ title: string; description?: string; priority?: string; status?: string }> = [];
    const regex = /\[TASK:\s*([^\]]+)\]/gi;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const parts = match[1].split('|').map(s => s.trim());
      const task: { title: string; description?: string; priority?: string; status?: string } = {
        title: parts[0],
      };

      for (const part of parts.slice(1)) {
        const colonIdx = part.indexOf(':');
        if (colonIdx === -1) continue;
        const key = part.slice(0, colonIdx).trim().toLowerCase();
        const value = part.slice(colonIdx + 1).trim();
        switch (key) {
          case 'priority':
            if (['low', 'medium', 'high', 'critical'].includes(value.toLowerCase())) {
              task.priority = value.toLowerCase();
            }
            break;
          case 'status':
            if (['backlog', 'todo', 'in_progress', 'review', 'done'].includes(value.toLowerCase())) {
              task.status = value.toLowerCase();
            }
            break;
          case 'desc':
          case 'description':
            task.description = value;
            break;
        }
      }

      if (task.title) tasks.push(task);
    }

    return tasks;
  }

  /**
   * Save tasks parsed from chat to the database
   */
  private async saveTasksToDb(tasks: Array<{ title: string; description?: string; priority?: string; status?: string }>): Promise<Array<{ id: number; title: string; priority: string; status: string }>> {
    const db = await getDatabase();
    const project = db.getProjectByPath(this.projectPath);
    if (!project) {
      throw new Error(`Project not found for path: ${this.projectPath}`);
    }

    const created: Array<{ id: number; title: string; priority: string; status: string }> = [];
    for (const task of tasks) {
      const result = db.createTask({
        project_id: project.id,
        title: task.title,
        description: task.description || null,
        status: task.status || 'backlog',
        priority: task.priority || 'medium',
        estimated: null,
      });
      created.push({ id: result.id, title: result.title, priority: result.priority, status: result.status });
    }

    logger.info(`Created ${created.length} tasks from chat for project ${project.id}`);
    return created;
  }

  /**
   * Get team status
   */
  getTeamStatus(teamName: TeamName): TeamStatus {
    return this.statuses.get(teamName) || { name: teamName, status: 'offline' };
  }

  /**
   * Get all team statuses
   */
  getAllStatuses(): TeamStatus[] {
    return Array.from(this.statuses.values());
  }

  /**
   * Abort a team's execution
   */
  abortTeam(teamName: TeamName): void {
    const executor = this.executors.get(teamName);
    if (executor) {
      executor.abort();
      this.updateStatus(teamName, 'idle');
    }
  }

  /**
   * Abort all teams
   */
  abortAll(): void {
    for (const [teamName, executor] of this.executors) {
      executor.abort();
      this.updateStatus(teamName, 'idle');
    }
  }
}
