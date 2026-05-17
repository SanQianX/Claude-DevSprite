/**
 * Sync Client
 * Local machine sync client: watches database changes, pushes to server
 */

import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import { getDatabase } from '../worker/db';
import { createLogger } from '../utils/logger';
import type { SyncStateType, FullStateData } from './syncProtocol';

const logger = createLogger('sync-client');

export class SyncClient {
  private agentId: string = '';
  private ws: WebSocket | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private lastSnapshot: string = '';

  /**
   * Start syncing with the server
   */
  start(agentId: string, ws: WebSocket): void {
    this.agentId = agentId;
    this.ws = ws;

    // Send full state on initial connect
    this.sendFullState().catch(err => {
      logger.error(`Failed to send full state: ${err.message}`);
    });

    // Start periodic sync
    this.syncInterval = setInterval(() => {
      this.checkAndSync().catch(err => {
        logger.error(`Sync check failed: ${err.message}`);
      });
    }, config.sync.syncIntervalMs);

    logger.info(`Sync client started (interval: ${config.sync.syncIntervalMs}ms)`);
  }

  /**
   * Stop syncing
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.ws = null;
    logger.info('Sync client stopped');
  }

  /**
   * Generate a consistent color for a project name
   */
  private generateProjectColor(name: string): string {
    const colors = [
      '#E74C3C', '#E67E22', '#F1C40F', '#2ECC71', '#1ABC9C',
      '#3498DB', '#9B59B6', '#E91E63', '#00BCD4', '#FF5722',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Count markdown files recursively
   */
  private countMarkdownFiles(dirPath: string): number {
    let count = 0;
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          count += this.countMarkdownFiles(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          count++;
        }
      }
    } catch {
      // Directory may not exist
    }
    return count;
  }

  /**
   * Get last updated time from markdown files
   */
  private getLastUpdated(dirPath: string): string | null {
    let latest = 0;
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          const sub = this.getLastUpdated(fullPath);
          if (sub) {
            const t = new Date(sub).getTime();
            if (t > latest) latest = t;
          }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const stat = fs.statSync(fullPath);
          if (stat.mtimeMs > latest) latest = stat.mtimeMs;
        }
      }
    } catch {
      // Directory may not exist
    }
    return latest > 0 ? new Date(latest).toISOString() : null;
  }

  /**
   * Check if path is a git repo
   */
  private isGitRepo(projectPath: string): boolean {
    try {
      return fs.existsSync(path.join(projectPath, '.git'));
    } catch {
      return false;
    }
  }

  /**
   * Collect and send full state snapshot
   */
  async sendFullState(): Promise<void> {
    const db = await getDatabase();
    const projects = db.getProjects();

    const data: FullStateData = {
      projects: projects.map(p => {
        const documentCount = this.countMarkdownFiles(p.knowledge_path);
        const lastUpdated = this.getLastUpdated(p.knowledge_path);
        return {
          id: p.id,
          name: p.name,
          path: p.path,
          knowledgePath: p.knowledge_path,
          description: this.isGitRepo(p.path) ? 'Git repository' : 'Local project',
          analysisCount: p.analysis_count,
          lastAnalysisCommit: p.last_analysis_commit,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          documentCount,
          lastUpdated,
          color: this.generateProjectColor(p.name),
        };
      }),
      config: {
        server: config.server,
        knowledge: config.knowledge,
        analysis: config.analysis,
      },
    };

    // Collect tasks and reviews for each project
    const tasks: any[] = [];
    const reviews: any[] = [];
    for (const project of projects) {
      const projectTasks = db.getTasks(project.id);
      tasks.push(...projectTasks.map(t => ({
        id: t.id,
        projectId: t.project_id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        estimated: t.estimated,
        completedAt: t.completed_at,
      })));

      const projectReviews = db.getReviews(project.id);
      reviews.push(...projectReviews.map(r => ({
        id: r.id,
        projectId: r.project_id,
        title: r.title,
        severity: r.severity,
        status: r.status,
        source: r.source,
        filePath: r.file_path,
        line: r.line,
        suggestion: r.suggestion,
      })));
    }

    data.tasks = tasks;
    data.reviews = reviews;

    this.send({ type: 'sync.full', agentId: this.agentId, data });

    // Store snapshot for comparison
    this.lastSnapshot = JSON.stringify(data);
    logger.info(`Full state sent: ${projects.length} projects, ${tasks.length} tasks, ${reviews.length} reviews`);
  }

  /**
   * Check for changes and send incremental updates
   */
  async checkAndSync(): Promise<void> {
    const db = await getDatabase();
    const projects = db.getProjects();

    // Build current state snapshot (compare full state including tasks/reviews)
    const tasks: any[] = [];
    const reviews: any[] = [];
    for (const project of projects) {
      tasks.push(...db.getTasks(project.id).map(t => ({ id: t.id, status: t.status })));
      reviews.push(...db.getReviews(project.id).map(r => ({ id: r.id, status: r.status })));
    }

    const currentState = JSON.stringify({ projects: projects.map(p => p.id), tasks, reviews });

    // Only send if something changed
    if (currentState !== this.lastSnapshot) {
      await this.sendFullState();
    }
  }

  /**
   * Send message to server
   */
  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}

export const syncClient = new SyncClient();
