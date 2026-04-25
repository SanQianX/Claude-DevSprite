/**
 * Internal API Routes
 * POST /_internal/hook - Git hook callback
 */

import type { Express, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { getProjectDiscoveryService } from '../../services/projectDiscovery';
import { getAnalyzer } from './analysis';
import { getDatabase } from '../db';
import { createLogger } from '../../utils/logger';

const logger = createLogger('internal');

export function registerInternalRoutes(app: Express): void {
  /**
   * POST /_internal/hook
   * Git hook notification endpoint
   */
  app.post('/_internal/hook', asyncHandler(async (req: Request, res: Response, next) => {
    const { repo, hash } = req.body;

    if (!repo || !hash) {
      res.status(400).json({ error: 'Missing repo or hash' });
      return;
    }

    try {
      logger.info(`Git hook received: repo=${repo}, hash=${hash}`);

      // Find the project by path
      const projectDiscovery = getProjectDiscoveryService();
      const discoveredProject = projectDiscovery.getProjectByPath(repo);

      if (!discoveredProject) {
        logger.warn(`Project not found for repo path: ${repo}`);
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      // Get the project from database to get the ID
      const db = await getDatabase();
      const project = db.getProjectByPath(repo);

      if (!project) {
        logger.warn(`Project not in database for repo path: ${repo}`);
        res.status(404).json({ error: 'Project not found in database' });
        return;
      }

      // Get the analyzer
      const analyzer = getAnalyzer();
      if (!analyzer) {
        logger.warn('Analyzer not initialized, cannot process hook');
        res.status(503).json({ error: 'Analyzer not ready' });
        return;
      }

      // Queue analysis task (for now, just log it)
      // In a full implementation, this would add to a task queue
      logger.info(`Analysis queued for project ${discoveredProject.name} at commit ${hash}`);

      // Update project in database
      const dbProject = db.getProject(discoveredProject.name);
      if (dbProject) {
        db.updateProject(dbProject.id, {
          last_analysis_commit: hash,
        });
      }

      res.json({ status: 'received', projectName: discoveredProject.name, commitHash: hash });
    } catch (error) {
      logger.error('Error processing git hook', error);
      res.status(500).json({ error: 'Failed to process hook' });
    }
  }));
}
