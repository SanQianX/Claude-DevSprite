/**
 * Projects API Routes
 * GET /api/projects
 * GET /api/projects/:name
 * POST /api/projects/discover
 * POST /api/projects/add
 * DELETE /api/projects/:name
 */

import type { Express, Request, Response } from 'express';
import { getProjectDiscoveryService } from '../../services/projectDiscovery';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { createLogger } from '../../utils/logger';

const logger = createLogger('projects');

export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  knowledgePath: string;
  description?: string;
  lastAnalysisCommit?: string;
  lastFullAnalysis?: Date;
  analysisCount: number;
  createdAt: Date;
  updatedAt: Date;
  documentCount?: number;
  lastUpdated?: string;
  color?: string;
}

export function registerProjectRoutes(app: Express): void {
  /**
   * GET /api/projects
   * Get all projects
   */
  app.get('/api/projects', asyncHandler(async (req: Request, res: Response) => {
    try {
      const projectDiscovery = getProjectDiscoveryService();
      const projects = await projectDiscovery.getAllProjects();
      res.json({ projects });
    } catch (error) {
      logger.error('Error getting projects', error);
      throw createError('Failed to get projects', 500, error);
    }
  }));

  /**
   * GET /api/projects/:name
   * Get project details
   */
  app.get('/api/projects/:name', asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;

    try {
      const projectDiscovery = getProjectDiscoveryService();
      const project = await projectDiscovery.getProject(name);

      if (!project) {
        throw createError('Project not found', 404);
      }

      res.json(project);
    } catch (error: unknown) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting project details', error);
      throw createError('Failed to get project details', 500, error);
    }
  }));

  /**
   * POST /api/projects/discover
   * Scan for and discover all projects
   */
  app.post('/api/projects/discover', asyncHandler(async (req: Request, res: Response) => {
    try {
      const projectDiscovery = getProjectDiscoveryService();
      const discoveredProjects = await projectDiscovery.discoverProjects();

      const projects = await projectDiscovery.getAllProjects();

      res.json({
        discovered: discoveredProjects.length,
        total: projects.length,
        projects,
      });
    } catch (error) {
      logger.error('Error discovering projects', error);
      throw createError('Failed to discover projects', 500, error);
    }
  }));

  /**
   * POST /api/projects/add
   * Manually add a project
   */
  app.post('/api/projects/add', asyncHandler(async (req: Request, res: Response) => {
    const { path: projectPath } = req.body;

    if (!projectPath) {
      throw createError('Project path is required', 400);
    }

    try {
      const projectDiscovery = getProjectDiscoveryService();
      const project = await projectDiscovery.addProject(projectPath);

      res.json(project);
    } catch (error) {
      logger.error('Error adding project', error);
      throw createError('Failed to add project', 500, error);
    }
  }));

  /**
   * DELETE /api/projects/:name
   * Remove a project from the system (does NOT delete local files)
   */
  app.delete('/api/projects/:name', asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;

    try {
      const projectDiscovery = getProjectDiscoveryService();
      await projectDiscovery.removeProject(name);

      res.json({ success: true, message: `Project "${name}" removed from system` });
    } catch (error) {
      logger.error('Error removing project', error);
      const message = error instanceof Error ? error.message : 'Failed to remove project';
      throw createError(message, error instanceof Error && 'statusCode' in error ? (error as any).statusCode : 500, error);
    }
  }));

  /**
   * GET /api/projects/:name/tree
   * Get project file tree structure
   * Note: This is now handled by files.ts, but we keep a redirect for compatibility
   */
  app.get('/api/projects/:name/tree', (req: Request, res: Response, next: Function) => {
    // Forward to the files route handler
    next('route');
  });
}
