/**
 * Sync Client
 * Local machine sync client: watches database changes, pushes to server
 */

import WebSocket from 'ws';
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
   * Collect and send full state snapshot
   */
  async sendFullState(): Promise<void> {
    const db = await getDatabase();
    const projects = db.getProjects();

    const data: FullStateData = {
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        path: p.path,
        analysisCount: p.analysis_count,
        lastAnalysisCommit: p.last_analysis_commit,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })),
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
        status: t.status,
        priority: t.priority,
      })));

      const projectReviews = db.getReviews(project.id);
      reviews.push(...projectReviews.map(r => ({
        id: r.id,
        projectId: r.project_id,
        title: r.title,
        severity: r.severity,
        status: r.status,
        source: r.source,
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

    // Build current state snapshot
    const currentState: FullStateData = {
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        path: p.path,
        analysisCount: p.analysis_count,
      })),
    };

    const currentSnapshot = JSON.stringify(currentState);

    // Only send if something changed
    if (currentSnapshot !== this.lastSnapshot) {
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
