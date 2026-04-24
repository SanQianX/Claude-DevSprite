/**
 * Internal API Routes
 * POST /_internal/hook - Git hook callback
 */

import type { Express, Request, Response } from 'express';

export function registerInternalRoutes(app: Express): void {
  /**
   * POST /_internal/hook
   * Git hook notification endpoint
   */
  app.post('/_internal/hook', async (req: Request, res: Response) => {
    const { repo, hash } = req.body;
    // TODO: Process git hook notification and trigger analysis
    console.log(`Git hook received: repo=${repo}, hash=${hash}`);
    res.json({ status: 'received' });
  });
}
