/**
 * DevMemory Service
 * Aggregates session, task, and review information for AI context
 */

import { getDatabase } from '../worker/db';
import { createLogger } from '../utils/logger';

const logger = createLogger('dev-memory');

export interface DevMemoryContext {
  projectName: string;
  summary: string;
  activeTasks: TaskInfo[];
  recentReviews: ReviewInfo[];
  recentSessions: SessionInfo[];
  stats: {
    totalTasks: number;
    pendingTasks: number;
    totalReviews: number;
    pendingReviews: number;
    totalSessions: number;
  };
}

export interface TaskInfo {
  id: number;
  title: string;
  status: string;
  priority: string | null;
  created_at: string;
}

export interface ReviewInfo {
  id: number;
  title: string;
  severity: string;
  status: string;
  file_path: string | null;
  created_at: string;
}

export interface SessionInfo {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  lastActivity: string;
}

export interface SessionSummary {
  sessionId: string;
  projectName: string;
  summary: string;
  keyTopics: string[];
  decisionsMade: string[];
  actionItems: string[];
  createdAt: string;
}

export class DevMemory {
  /**
   * Build a full memory context for a project
   */
  async buildContext(projectName: string): Promise<DevMemoryContext> {
    const db = await getDatabase();
    const project = db.getProject(projectName);

    if (!project) {
      return this.emptyContext(projectName);
    }

    const tasks = db.getTasks(project.id);
    const reviews = db.getReviews(project.id);

    const activeTasks: TaskInfo[] = tasks
      .filter(t => t.status !== 'done' && t.status !== 'cancelled')
      .slice(0, 10)
      .map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority || null,
        created_at: t.created_at,
      }));

    const recentReviews: ReviewInfo[] = reviews
      .slice(0, 10)
      .map(r => ({
        id: r.id,
        title: r.title,
        severity: r.severity,
        status: r.status,
        file_path: r.file_path || null,
        created_at: r.created_at,
      }));

    // Get sessions from database (if available)
    const recentSessions = await this.getRecentSessions(project.id);

    const stats = {
      totalTasks: tasks.length,
      pendingTasks: tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
      totalReviews: reviews.length,
      pendingReviews: reviews.filter(r => r.status === 'pending').length,
      totalSessions: recentSessions.length,
    };

    const summary = this.generateSummary(stats, activeTasks.length, recentReviews.length);

    return {
      projectName,
      summary,
      activeTasks,
      recentReviews,
      recentSessions,
      stats,
    };
  }

  /**
   * Generate a session summary from messages
   */
  async generateSessionSummary(
    sessionId: string,
    projectName: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<SessionSummary> {
    // Extract key topics from messages
    const keyTopics = this.extractKeyTopics(messages);
    const decisionsMade = this.extractDecisions(messages);
    const actionItems = this.extractActionItems(messages);

    const summary = `会话包含 ${messages.length} 条消息，涉及 ${keyTopics.length} 个主题。` +
      (decisionsMade.length > 0 ? `做出了 ${decisionsMade.length} 个决策。` : '') +
      (actionItems.length > 0 ? `有 ${actionItems.length} 个待办事项。` : '');

    const sessionSummary: SessionSummary = {
      sessionId,
      projectName,
      summary,
      keyTopics,
      decisionsMade,
      actionItems,
      createdAt: new Date().toISOString(),
    };

    // Save to database
    await this.saveSessionSummary(sessionSummary);

    return sessionSummary;
  }

  /**
   * Get memory context as a formatted string for AI prompts
   */
  async getContextForPrompt(projectName: string): Promise<string> {
    const ctx = await this.buildContext(projectName);

    const lines: string[] = [];
    lines.push(`## 项目记忆: ${ctx.projectName}`);
    lines.push(ctx.summary);
    lines.push('');

    if (ctx.activeTasks.length > 0) {
      lines.push('### 进行中的任务');
      for (const task of ctx.activeTasks) {
        lines.push(`- [${task.status}] ${task.title} (创建于 ${task.created_at})`);
      }
      lines.push('');
    }

    if (ctx.recentReviews.length > 0) {
      lines.push('### 最近的审查');
      for (const review of ctx.recentReviews) {
        const file = review.file_path ? ` (${review.file_path})` : '';
        lines.push(`- [${review.severity}/${review.status}] ${review.title}${file}`);
      }
      lines.push('');
    }

    if (ctx.recentSessions.length > 0) {
      lines.push('### 最近的会话');
      for (const session of ctx.recentSessions) {
        lines.push(`- ${session.title} (${session.messageCount} 条消息, ${session.lastActivity})`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private emptyContext(projectName: string): DevMemoryContext {
    return {
      projectName,
      summary: '暂无项目记忆数据',
      activeTasks: [],
      recentReviews: [],
      recentSessions: [],
      stats: { totalTasks: 0, pendingTasks: 0, totalReviews: 0, pendingReviews: 0, totalSessions: 0 },
    };
  }

  private generateSummary(stats: DevMemoryContext['stats'], activeTaskCount: number, pendingReviewCount: number): string {
    const parts: string[] = [];

    if (stats.totalTasks > 0) {
      parts.push(`共 ${stats.totalTasks} 个任务，${stats.pendingTasks} 个进行中`);
    }
    if (stats.totalReviews > 0) {
      parts.push(`${stats.pendingReviews} 个待审查`);
    }
    if (stats.totalSessions > 0) {
      parts.push(`${stats.totalSessions} 个会话记录`);
    }

    return parts.length > 0 ? parts.join('，') : '暂无项目记忆数据';
  }

  private async getRecentSessions(projectId: string): Promise<SessionInfo[]> {
    try {
      const db = await getDatabase();
      const rows = db.getRecentSessions(projectId, 10);
      return rows.map((r: any) => ({
        id: r.id,
        title: r.title || '未命名会话',
        messageCount: 0,
        createdAt: r.created_at,
        lastActivity: r.created_at,
      }));
    } catch {
      return [];
    }
  }

  private extractKeyTopics(messages: Array<{ role: string; content: string }>): string[] {
    const topics = new Set<string>();
    for (const msg of messages) {
      if (msg.role === 'user') {
        // Extract short phrases that might be topics
        const words = msg.content.split(/\s+/).slice(0, 5).join(' ');
        if (words.length > 3) topics.add(words);
      }
    }
    return Array.from(topics).slice(0, 10);
  }

  private extractDecisions(messages: Array<{ role: string; content: string }>): string[] {
    const decisions: string[] = [];
    const keywords = ['决定', '确认', '选择', '采用', '使用', 'decide', 'choose', 'use'];
    for (const msg of messages) {
      if (msg.role === 'user') {
        const lower = msg.content.toLowerCase();
        if (keywords.some(k => lower.includes(k))) {
          decisions.push(msg.content.substring(0, 100));
        }
      }
    }
    return decisions.slice(0, 5);
  }

  private extractActionItems(messages: Array<{ role: string; content: string }>): string[] {
    const items: string[] = [];
    const keywords = ['需要', '应该', 'TODO', '待办', 'fix', 'update', '添加', '修改'];
    for (const msg of messages) {
      if (msg.role === 'user') {
        const lower = msg.content.toLowerCase();
        if (keywords.some(k => lower.includes(k))) {
          items.push(msg.content.substring(0, 100));
        }
      }
    }
    return items.slice(0, 5);
  }

  private async saveSessionSummary(summary: SessionSummary): Promise<void> {
    try {
      const db = await getDatabase();
      db.saveSessionSummary(
        summary.sessionId,
        summary.projectName,
        summary.summary,
        summary.keyTopics,
        summary.decisionsMade,
        summary.actionItems
      );
    } catch (error: any) {
      logger.warn(`Failed to save session summary: ${error.message}`);
    }
  }
}

// Singleton
let instance: DevMemory | null = null;

export function getDevMemory(): DevMemory {
  if (!instance) {
    instance = new DevMemory();
  }
  return instance;
}
