/**
 * Task Queue
 * Manages background analysis tasks
 */

import { Analyzer } from '../analyzer';
import { AIProvider } from '../analyzer/aiProvider';
import { getDatabase } from './db';
import { getProjectDiscoveryService } from '../services/projectDiscovery';
import { createLogger } from '../utils/logger';

const logger = createLogger('taskQueue');

export interface Task {
  id: string;
  projectId: string;
  commitHash: string;
  commitMessage: string;
  analysisMode: 'incremental' | 'full';
  status: 'queued' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export class TaskQueue {
  private queue: Task[] = [];
  private running = new Map<string, Task>();
  private processing = false;
  private analyzer: Analyzer;

  constructor() {
    this.analyzer = new Analyzer();
  }

  /**
   * Add a task to the queue
   */
  add(task: Omit<Task, 'id' | 'status' | 'createdAt'>): string {
    const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullTask: Task = {
      ...task,
      id,
      status: 'queued',
      createdAt: new Date(),
    };
    this.queue.push(fullTask);

    logger.info(`Task queued: ${id} for project ${task.projectId}, commit ${task.commitHash}`);

    // Auto-start processing
    this.start();
    return id;
  }

  /**
   * Start processing the queue
   */
  async start(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    this.processQueue();
  }

  /**
   * Stop processing the queue
   */
  stop(): void {
    this.processing = false;
  }

  /**
   * Get all tasks (queued and running)
   */
  getTasks(): Task[] {
    return [...this.queue, ...Array.from(this.running.values())];
  }

  /**
   * Get task by ID
   */
  getTask(id: string): Task | undefined {
    return this.queue.find(t => t.id === id) || this.running.get(id);
  }

  /**
   * Process tasks from the queue
   */
  private async processQueue(): Promise<void> {
    while (this.processing && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;

      this.running.set(task.id, task);
      task.status = 'running';
      task.startedAt = new Date();

      logger.info(`Processing task: ${task.id} for project ${task.projectId}`);

      try {
        await this.executeTask(task);

        task.status = 'completed';
        task.completedAt = new Date();
        logger.info(`Task completed: ${task.id}`);
      } catch (error) {
        task.status = 'failed';
        task.completedAt = new Date();
        task.errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Task failed: ${task.id}`, error);
      }

      this.running.delete(task.id);
    }

    this.processing = false;
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: Task): Promise<void> {
    const discovery = getProjectDiscoveryService();
    const project = await discovery.getProject(task.projectId);

    if (!project) {
      throw new Error(`Project not found: ${task.projectId}`);
    }

    logger.info(`Executing ${task.analysisMode} analysis for ${task.projectId}, commit ${task.commitHash}`);

    if (task.analysisMode === 'incremental') {
      // Incremental: analyze a specific commit
      const result = await this.analyzer.analyze(project.path, task.commitHash);

      // Log to database
      try {
        const db = await getDatabase();
        db.createAnalysisLog({
          project_id: task.projectId,
          commit_hash: task.commitHash,
          commit_message: task.commitMessage,
          analysis_mode: 'incremental',
          files_changed: 0,
          model_used: result.modelUsed || '',
          tokens_used: result.tokensUsed || 0,
          duration_ms: result.durationMs || 0,
          status: 'success',
          error_message: null
        });
      } catch (dbErr) {
        logger.warn('Failed to log analysis to database', dbErr);
      }

      logger.info(`Incremental analysis complete: ${result.documents?.length || 0} documents generated`);
    } else {
      // Full analysis: analyze entire project
      const result = await this.analyzer.analyze(project.path, task.commitHash);

      try {
        const db = await getDatabase();
        db.createAnalysisLog({
          project_id: task.projectId,
          commit_hash: task.commitHash,
          commit_message: task.commitMessage,
          analysis_mode: 'full',
          files_changed: 0,
          model_used: result.modelUsed || '',
          tokens_used: result.tokensUsed || 0,
          duration_ms: result.durationMs || 0,
          status: 'success',
          error_message: null
        });
      } catch (dbErr) {
        logger.warn('Failed to log analysis to database', dbErr);
      }

      logger.info(`Full analysis complete: ${result.documents?.length || 0} documents generated`);
    }
  }
}
