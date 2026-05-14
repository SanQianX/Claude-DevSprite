/**
 * Design Fixer Agent
 * Reads pending design-check reviews and fixes them via AI, then git commits.
 * This agent ONLY fixes — it does not scan.
 */

import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';
import { CodeReviewer } from './codeReviewer';
import type { AIConfig } from './aiProvider';
import { getDatabase } from '../worker/db';
import { createLogger } from '../utils/logger';

const logger = createLogger('design-fixer');

export interface FixerConfig {
  enabled: boolean;
  intervalMs: number;
  isFixing: boolean;
}

export class DesignFixer {
  private codeReviewer: CodeReviewer;
  private fixIntervalMs: number;
  private fixTimer: ReturnType<typeof setInterval> | null = null;
  private isFixing = false;
  private enabled = false;

  constructor(options?: { model?: string; fixIntervalMs?: number; agentConfig?: AIConfig }) {
    this.codeReviewer = new CodeReviewer({ model: options?.model, agentConfig: options?.agentConfig });
    this.fixIntervalMs = options?.fixIntervalMs ?? 5 * 60 * 1000; // 5 minutes default
  }

  getFixerConfig(): FixerConfig {
    return {
      enabled: this.enabled,
      intervalMs: this.fixIntervalMs,
      isFixing: this.isFixing,
    };
  }

  /**
   * Update the fixer configuration at runtime.
   * This method allows dynamic adjustment of the fixer's behavior without restarting the service.
   * When enabled, the fixer will automatically start; when disabled, it will stop.
   * The interval can be updated if it meets the minimum requirement (60000ms).
   *
   * @param config - Configuration options to update
   * @param config.enabled - Whether to enable or disable the fixer (optional)
   * @param config.intervalMs - The interval in milliseconds between fix attempts (optional, minimum 60000ms)
   */
  updateFixerConfig(config: { enabled?: boolean; intervalMs?: number }): void {
    if (config.enabled !== undefined) {
      this.enabled = config.enabled;
    }
    if (config.intervalMs !== undefined && config.intervalMs >= 60000) {
      this.fixIntervalMs = config.intervalMs;
    }
    // Restart fixer with new config
    this.stopFixer();
    if (this.enabled) {
      this.startFixer();
    }
    logger.info(`[DesignFixer] Config updated: enabled=${this.enabled}, interval=${this.fixIntervalMs}ms`);
  }

  startFixer(): void {
    if (this.fixTimer) return;
    if (!this.enabled) {
      logger.info('[DesignFixer] Fixer disabled, not starting');
      return;
    }
    logger.info(`[DesignFixer] Starting background fixer (interval: ${this.fixIntervalMs}ms)`);
    this.fixTimer = setInterval(() => this.fixAllProjects(), this.fixIntervalMs);
  }

  stopFixer(): void {
    if (this.fixTimer) {
      clearInterval(this.fixTimer);
      this.fixTimer = null;
      logger.info('[DesignFixer] Background fixer stopped');
    }
  }

  async fixAllProjects(): Promise<void> {
    if (this.isFixing) {
      logger.info('[DesignFixer] Fix already in progress, skipping');
      return;
    }

    this.isFixing = true;
    try {
      const db = await getDatabase();
      const projects = db.getProjects();

      for (const project of projects) {
        try {
          await this.fixAllPending(project.id, project.path, project.name);
        } catch (error: any) {
          logger.error(`[DesignFixer] Error fixing project ${project.name}: ${error.message}`);
        }
      }
    } finally {
      this.isFixing = false;
    }
  }

  /**
   * Fix all pending design-check reviews for a project
   */
  async fixAllPending(
    projectId: string,
    projectPath: string,
    projectName: string
  ): Promise<{ fixed: number; confirmed: number; failed: number }> {
    const db = await getDatabase();
    const pendingReviews = db.getPendingReviews(projectId)
      .filter((r: any) => r.source === 'design-check');

    if (pendingReviews.length === 0) {
      return { fixed: 0, confirmed: 0, failed: 0 };
    }

    logger.info(`[DesignFixer] Fixing ${pendingReviews.length} pending reviews for "${projectName}"`);

    let fixed = 0;
    let confirmed = 0;
    let failed = 0;
    const fixedFiles: string[] = [];

    for (const review of pendingReviews) {
      try {
        const isValidFilePath = review.file_path
          && /\.(ts|tsx|js|jsx|vue|svelte|py|java|go|rs|cs|css|scss|html|json|yaml|yml)$/.test(review.file_path)
          && fs.existsSync(path.join(projectPath, review.file_path));

        if (!isValidFilePath) {
          db.updateReview(review.id, {
            status: 'confirmed',
            resolved_at: new Date().toISOString(),
          });
          confirmed++;
        } else {
          const filePath = review.file_path!;
          const fix = await this.codeReviewer.generateFix(
            projectPath,
            filePath,
            {
              title: review.title,
              description: review.description || review.title,
              suggestion: review.suggestion || undefined,
            }
          );

          if (!fix) {
            failed++;
            continue;
          }

          const fullPath = path.join(projectPath, filePath);
          const resolvedPath = path.resolve(fullPath);
          if (!resolvedPath.startsWith(path.resolve(projectPath))) {
            failed++;
            continue;
          }

          await fs.promises.writeFile(fullPath, fix.fixedContent, 'utf-8');
          db.updateReview(review.id, { status: 'fixed', resolved_at: new Date().toISOString() });

          // 自动创建任务，状态为”已完成”
          try {
            await db.createTask({
              project_id: review.project_id,
              status: 'completed',
              title: `Fix completed: ${review.title}`,
              description: review.description || review.title,
              priority: 'low',
              estimated: null,
            });
          } catch (taskError: any) {
            logger.error(`[DesignFixer] Failed to create task for review ${review.id}: ${taskError.message}`);
          }

          fixedFiles.push(filePath);
          fixed++;
        }
      } catch (error: any) {
        logger.error(`[DesignFixer] Fix failed for review ${review.id}: ${error.message}`);
        failed++;
      }
    }

    // Git commit if any files were fixed
    if (fixedFiles.length > 0) {
      await this.commitAndPush(projectPath, projectName, fixedFiles);
    }

    logger.info(`[DesignFixer] Project "${projectName}": ${fixed} fixed, ${confirmed} confirmed, ${failed} failed`);
    return { fixed, confirmed, failed };
  }

  /**
   * Git commit and push fixed files
   */
  private async commitAndPush(
    projectPath: string,
    projectName: string,
    fixedFiles: string[]
  ): Promise<void> {
    try {
      const git = simpleGit(projectPath);

      const isRepo = await git.status().then(() => true).catch(() => false);
      if (!isRepo) {
        logger.info(`[DesignFixer] "${projectName}" is not a git repo, skipping commit`);
        return;
      }

      const status = await git.status();
      if (status.staged.length === 0 && status.modified.length === 0 && status.not_added.length === 0) {
        logger.info(`[DesignFixer] No changes to commit for "${projectName}"`);
        return;
      }

      // Stage only the fixed files
      for (const file of fixedFiles) {
        await git.add(file);
      }

      const commitMsg = `fix(auto): design consistency auto-fix (${fixedFiles.length} files)`;
      await git.commit(commitMsg);

      const remotes = await git.getRemotes();
      if (remotes.length > 0) {
        const branch = status.current || 'main';
        await git.push('origin', branch);
        logger.info(`[DesignFixer] Pushed auto-fix commit to "${projectName}" (${branch})`);
      } else {
        logger.info(`[DesignFixer] No remote configured for "${projectName}", commit only`);
      }
    } catch (error: any) {
      logger.error(`[DesignFixer] Git commit/push failed for "${projectName}": ${error.message}`);
    }
  }
}