/**
 * Config API Routes
 * GET /api/config
 * PUT /api/config
 */

import type { Express, Request, Response } from 'express';

export function registerConfigRoutes(app: Express): void {
  /**
   * GET /api/config
   * Get current configuration
   */
  app.get('/api/config', (req: Request, res: Response) => {
    // TODO: Return current config
    res.json({
      port: 38888,
      dataPath: '~/.claude-dev-sprite',
      projectsPath: '~/.claude-dev-sprite/projects',
    });
  });

  /**
   * PUT /api/config
   * Update configuration
   */
  app.put('/api/config', (req: Request, res: Response) => {
    // TODO: Update and persist config
    res.json({ status: 'ok', config: req.body });
  });
}
