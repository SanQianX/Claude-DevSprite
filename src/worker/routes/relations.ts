/**
 * Relations API Routes
 * GET /api/projects/:name/relations
 */

import type { Express, Request, Response } from 'express';

export function registerRelationRoutes(app: Express): void {
  /**
   * GET /api/projects/:name/relations
   * Get all relations
   */
  app.get('/api/projects/:name/relations', (req: Request, res: Response) => {
    const { name, doc } = req.query;
    // TODO: Return relations (filtered by doc if specified)
    res.json({ projectName: name, relations: [] });
  });

  /**
   * GET /api/projects/:name/relations/graph
   * Get relation graph data
   */
  app.get('/api/projects/:name/relations/graph', (req: Request, res: Response) => {
    const { name } = req.params;
    // TODO: Return graph nodes and edges
    res.json({ projectName: name, nodes: [], edges: [] });
  });
}
