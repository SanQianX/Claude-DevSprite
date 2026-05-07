/**
 * FileProtocol - File-based Communication Protocol
 * Manages inbox/outbox communication between Teams
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import type { Task, TaskResult, TeamName } from './types';

const logger = createLogger('file-protocol');

export class FileProtocol {
  private basePath: string;

  constructor(projectPath: string) {
    this.basePath = path.join(projectPath, '.Claude-DevSprite', 'teams');
  }

  /**
   * Write task to team's inbox
   */
  async writeTask(teamName: TeamName, task: Task): Promise<void> {
    const inboxDir = path.join(this.basePath, teamName, 'inbox');
    await fs.mkdir(inboxDir, { recursive: true });

    const filePath = path.join(inboxDir, `${task.id}.md`);
    const content = this.taskToMarkdown(task);

    await fs.writeFile(filePath, content, 'utf-8');
    logger.info(`Wrote task ${task.id} to ${teamName}/inbox`);
  }

  /**
   * Read tasks from team's inbox
   */
  async readTasks(teamName: TeamName): Promise<Task[]> {
    const inboxDir = path.join(this.basePath, teamName, 'inbox');

    try {
      const files = await fs.readdir(inboxDir);
      const tasks: Task[] = [];

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const filePath = path.join(inboxDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const task = this.parseTaskMarkdown(content);
        if (task) {
          tasks.push(task);
        }
      }

      logger.info(`Read ${tasks.length} tasks from ${teamName}/inbox`);
      return tasks;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.warn(`Inbox not found for team: ${teamName}`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Write result to team's outbox
   */
  async writeResult(teamName: TeamName, result: TaskResult): Promise<void> {
    const outboxDir = path.join(this.basePath, teamName, 'outbox');
    await fs.mkdir(outboxDir, { recursive: true });

    const filePath = path.join(outboxDir, `${result.taskId}-result.md`);
    const content = this.resultToMarkdown(result);

    await fs.writeFile(filePath, content, 'utf-8');
    logger.info(`Wrote result for task ${result.taskId} to ${teamName}/outbox`);
  }

  /**
   * Read results from team's outbox
   */
  async readResults(teamName: TeamName): Promise<TaskResult[]> {
    const outboxDir = path.join(this.basePath, teamName, 'outbox');

    try {
      const files = await fs.readdir(outboxDir);
      const results: TaskResult[] = [];

      for (const file of files) {
        if (!file.endsWith('-result.md')) continue;

        const filePath = path.join(outboxDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const result = this.parseResultMarkdown(content);
        if (result) {
          results.push(result);
        }
      }

      logger.info(`Read ${results.length} results from ${teamName}/outbox`);
      return results;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.warn(`Outbox not found for team: ${teamName}`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Clear processed tasks from inbox
   */
  async clearInbox(teamName: TeamName): Promise<void> {
    const inboxDir = path.join(this.basePath, teamName, 'inbox');

    try {
      const files = await fs.readdir(inboxDir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          await fs.unlink(path.join(inboxDir, file));
        }
      }
      logger.info(`Cleared inbox for team: ${teamName}`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Clear processed results from outbox
   */
  async clearOutbox(teamName: TeamName): Promise<void> {
    const outboxDir = path.join(this.basePath, teamName, 'outbox');

    try {
      const files = await fs.readdir(outboxDir);
      for (const file of files) {
        if (file.endsWith('-result.md')) {
          await fs.unlink(path.join(outboxDir, file));
        }
      }
      logger.info(`Cleared outbox for team: ${teamName}`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Convert task to markdown format with frontmatter
   */
  private taskToMarkdown(task: Task): string {
    return `---
taskId: "${task.id}"
type: "${task.type}"
priority: "${task.priority}"
assignedTo: "${task.assignedTo}"
status: "${task.status}"
createdAt: "${task.createdAt}"
---

# ${task.title}

## 描述
${task.description}

## 验收标准
${task.acceptanceCriteria.map(c => `- ${c}`).join('\n')}

${task.context ? `## 上下文\n${task.context}` : ''}
`;
  }

  /**
   * Parse task from markdown format
   */
  private parseTaskMarkdown(content: string): Task | null {
    try {
      // Parse frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) return null;

      const frontmatter = frontmatterMatch[1];
      const metadata: Record<string, string> = {};

      for (const line of frontmatter.split('\n')) {
        const match = line.match(/^(\w+):\s*"?(.+?)"?$/);
        if (match) {
          metadata[match[1]] = match[2];
        }
      }

      // Parse body
      const body = content.slice(frontmatterMatch[0].length);
      const titleMatch = body.match(/^#\s+(.+)$/m);
      const descMatch = body.match(/## 描述\n([\s\S]*?)(?=\n##|$)/);
      const criteriaMatch = body.match(/## 验收标准\n([\s\S]*?)(?=\n##|$)/);
      const contextMatch = body.match(/## 上下文\n([\s\S]*?)(?=\n##|$)/);

      return {
        id: metadata.taskId || '',
        type: (metadata.taskType as any) || 'development',
        priority: (metadata.priority as any) || 'medium',
        assignedTo: (metadata.assignedTo as any) || 'dev',
        title: titleMatch?.[1] || '',
        description: descMatch?.[1]?.trim() || '',
        acceptanceCriteria: criteriaMatch?.[1]
          ?.split('\n')
          .filter(line => line.startsWith('- '))
          .map(line => line.slice(2)) || [],
        createdAt: metadata.createdAt || new Date().toISOString(),
        status: (metadata.status as any) || 'pending',
        context: contextMatch?.[1]?.trim(),
      };
    } catch (error) {
      logger.error(`Failed to parse task markdown: ${error}`);
      return null;
    }
  }

  /**
   * Convert result to markdown format
   */
  private resultToMarkdown(result: TaskResult): string {
    return `---
taskId: "${result.taskId}"
status: "${result.status}"
completedAt: "${result.completedAt}"
model: "${result.model}"
---

# 任务结果: ${result.taskId}

## 状态
${result.status === 'completed' ? '✅ 完成' : '❌ 失败'}

## 总结
${result.summary}

## 变更文件
${result.changedFiles.map(f => `- ${f}`).join('\n')}

${result.error ? `## 错误\n${result.error}` : ''}
`;
  }

  /**
   * Parse result from markdown format
   */
  private parseResultMarkdown(content: string): TaskResult | null {
    try {
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) return null;

      const frontmatter = frontmatterMatch[1];
      const metadata: Record<string, string> = {};

      for (const line of frontmatter.split('\n')) {
        const match = line.match(/^(\w+):\s*"?(.+?)"?$/);
        if (match) {
          metadata[match[1]] = match[2];
        }
      }

      const body = content.slice(frontmatterMatch[0].length);
      const summaryMatch = body.match(/## 总结\n([\s\S]*?)(?=\n##|$)/);
      const filesMatch = body.match(/## 变更文件\n([\s\S]*?)(?=\n##|$)/);
      const errorMatch = body.match(/## 错误\n([\s\S]*?)(?=\n##|$)/);

      return {
        taskId: metadata.taskId || '',
        status: (metadata.status as any) || 'completed',
        completedAt: metadata.completedAt || new Date().toISOString(),
        model: metadata.model || '',
        summary: summaryMatch?.[1]?.trim() || '',
        changedFiles: filesMatch?.[1]
          ?.split('\n')
          .filter(line => line.startsWith('- '))
          .map(line => line.slice(2)) || [],
        error: errorMatch?.[1]?.trim(),
      };
    } catch (error) {
      logger.error(`Failed to parse result markdown: ${error}`);
      return null;
    }
  }
}
