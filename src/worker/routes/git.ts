/**
 * Git Detector API Routes
 * POST /api/git/hook-notify - Internal endpoint called by post-commit hook
 * GET /api/git/status - Get detector status
 */

import type { Express, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { getAllProjectDetectors } from '../detectorRegistry';
import { createLogger } from '../../utils/logger';

const logger = createLogger('git-routes');

export function registerGitRoutes(app: Express): void {
  /**
   * POST /api/git/hook-notify
   * Internal endpoint called by post-commit hook script
   */
  app.post('/api/git/hook-notify', asyncHandler(async (req: Request, res: Response, next) => {
    const { repoPath, commitHash } = req.body;

    if (!repoPath || !commitHash) {
      res.status(400).json({ error: 'Missing repoPath or commitHash' });
      return;
    }

    try {
      // Find the detector for this repo
      const detectors = getAllProjectDetectors();
      let foundDetector = false;

      for (const [projectName, entry] of detectors) {
        // Normalize paths for comparison
        const normalizedRepoPath = repoPath.replace(/\\/g, '/').replace(/\/$/, '');
        const normalizedEntryPath = entry.repoPath.replace(/\\/g, '/').replace(/\/$/, '');

        if (normalizedEntryPath === normalizedRepoPath || normalizedRepoPath.startsWith(normalizedEntryPath)) {
          const activeDetector = (entry.detector as any).activeDetector;
          logger.info(`Hook notify received for project ${projectName}: commitHash=${commitHash}, detector=${activeDetector?.name}`);

          if (activeDetector && activeDetector.name === 'post-commit-hook') {
            await activeDetector.handleHookNotification(commitHash);
          }
          foundDetector = true;
          break;
        }
      }

      if (!foundDetector) {
        logger.warn(`No detector found for repo: ${repoPath}`);
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('Error handling hook notify:', error);
      res.status(500).json({ error: 'Failed to handle hook notification' });
    }
  }));

  /**
   * GET /api/git/status
   * Get current detector status for all projects
   */
  app.get('/api/git/status', (req: Request, res: Response) => {
    const detectors = getAllProjectDetectors();

    if (detectors.size === 0) {
      return res.json({
        activeDetector: null,
        fallbackReason: 'No projects detected',
        isRunning: false,
        projects: [],
      });
    }

    const projects = Array.from(detectors.entries()).map(([name, entry]) => {
      const status = entry.detector.getStatus();
      return {
        name,
        ...status,
      };
    });

    // For backwards compatibility, return first project's detector as primary
    const firstEntry = detectors.values().next().value;
    const primaryStatus = firstEntry ? firstEntry.detector.getStatus() : { activeDetector: null, isRunning: false };

    res.json({
      ...primaryStatus,
      projects,
    });
  });
}
