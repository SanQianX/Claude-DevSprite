/**
 * Git Detector API Routes
 * POST /api/git/hook-notify - Internal endpoint called by post-commit hook
 * GET /api/git/status - Get detector status
 */

import type { Express, Request, Response } from 'express';
import { CommitDetectorManager } from '../../detectors';

// Global detector manager (will be initialized by worker server)
let detectorManager: CommitDetectorManager | null = null;

export function registerGitRoutes(app: Express): void {
  /**
   * POST /api/git/hook-notify
   * Internal endpoint called by post-commit hook script
   */
  app.post('/api/git/hook-notify', async (req: Request, res: Response) => {
    const { repoPath, commitHash } = req.body;

    if (!repoPath || !commitHash) {
      return res.status(400).json({ error: 'Missing repoPath or commitHash' });
    }

    try {
      // If we have a detector manager and it's using post-commit-hook, handle the notification
      if (detectorManager) {
        const activeDetector = (detectorManager as any).activeDetector;
        console.log(`[GitRoutes] Hook notify received: repoPath=${repoPath}, commitHash=${commitHash}, detector=${activeDetector?.name}`);
        if (activeDetector && activeDetector.name === 'post-commit-hook') {
          await activeDetector.handleHookNotification(commitHash);
        }
      } else {
        console.log(`[GitRoutes] Hook notify received but no detector manager`);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('[GitRoutes] Error handling hook notify:', error);
      res.status(500).json({ error: 'Failed to handle hook notification' });
    }
  });

  /**
   * GET /api/git/status
   * Get current detector status
   */
  app.get('/api/git/status', (req: Request, res: Response) => {
    if (!detectorManager) {
      return res.json({
        activeDetector: null,
        fallbackReason: 'Detector manager not initialized',
        isRunning: false,
      });
    }

    const status = detectorManager.getStatus();
    res.json(status);
  });
}

/**
 * Set the detector manager (called by worker server during initialization)
 */
export function setDetectorManager(manager: CommitDetectorManager): void {
  detectorManager = manager;
}
