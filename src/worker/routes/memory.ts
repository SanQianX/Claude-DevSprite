/**
 * Memory API Routes
 * GET  /api/projects/:name/memory         - Get memory context for a project
 * GET  /api/projects/:name/memory/prompt  - Get memory as formatted AI prompt text
 * POST /api/projects/:name/memory/summary - Generate session summary
 */

import type { Express, Request, Response } from 'express';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { getDevMemory } from '../../services/devMemory';
import { getDatabase } from '../db';
import { createLogger } from '../../utils/logger';

const logger = createLogger('memory');

export function registerMemoryRoutes(app: Express): void {
  /**
   * GET /api/projects/:name/memory
   * Get aggregated memory context for a project
   */
  app.get('/api/projects/:name/memory', asyncHandler(async (req: Request, res: Response) => {
    const projectName = req.params.name;

    const db = await getDatabase();
    const project = db.getProject(projectName);
    if (!project) throw createError('Project not found', 404);

    const memory = getDevMemory();
    const context = await memory.buildContext(projectName);

    res.json(context);
  }));

  /**
   * GET /api/projects/:name/memory/prompt
   * Get memory formatted as AI prompt text
   */
  app.get('/api/projects/:name/memory/prompt', asyncHandler(async (req: Request, res: Response) => {
    const projectName = req.params.name;

    const db = await getDatabase();
    const project = db.getProject(projectName);
    if (!project) throw createError('Project not found', 404);

    const memory = getDevMemory();
    const promptText = await memory.getContextForPrompt(projectName);

    res.json({ prompt: promptText });
  }));

  /**
   * POST /api/projects/:name/memory/summary
   * Generate a session summary from messages
   */
  app.post('/api/projects/:name/memory/summary', asyncHandler(async (req: Request, res: Response) => {
    const projectName = req.params.name;
    const { sessionId, messages } = req.body;

    if (!sessionId || !messages || !Array.isArray(messages)) {
      throw createError('sessionId and messages array are required', 400);
    }

    if (messages.length > 1000) {
      throw createError('Messages array too large (max 1000)', 400);
    }

    const db = await getDatabase();
    const project = db.getProject(projectName);
    if (!project) throw createError('Project not found', 404);

    const memory = getDevMemory();
    const summary = await memory.generateSessionSummary(sessionId, projectName, messages);

    logger.info(`Session summary generated for ${sessionId}`);
    res.json(summary);
  }));
}
