/**
 * TeamManager - Core Scheduler
 * Manages Team lifecycle, task distribution, and result collection
 */

import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { TeamExecutor } from './teamExecutor';
import { TeamConfigManager } from './teamConfig';
import { FileProtocol } from './fileProtocol';
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

    for await (const event of leadExecutor.execute(userMessage)) {
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
