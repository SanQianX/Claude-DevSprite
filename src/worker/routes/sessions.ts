/**
 * Session API Routes
 * REST endpoints for session management (non-real-time operations)
 */

import type { Express, Request, Response } from 'express';
import { createLogger } from '../../utils/logger';
import { asyncHandler, createError } from '../middleware/errorHandler';
import type { SessionManager } from '../sessionManager';

const logger = createLogger('session-routes');

let sessionManager: SessionManager | null = null;

/**
 * Middleware to check session manager is initialized
 */
function requireSessionManager(req: Request, res: Response, next: Function): void {
  if (!sessionManager) {
    return next(createError('Session manager not initialized', 503));
  }
  next();
}

/**
 * Set the session manager instance (called during server initialization)
 */
export function setSessionManager(manager: SessionManager): void {
  sessionManager = manager;
}

/**
 * Register session routes on Express app
 */
export function registerSessionRoutes(app: Express): void {
  // Apply session manager check to all session routes
  app.use('/api/sessions', requireSessionManager);

  /**
   * GET /api/sessions - List sessions for a project
   */
  app.get('/api/sessions', asyncHandler(async (req: Request, res: Response) => {
    const projectPath = req.query.projectPath as string || process.cwd();
    const sessions = sessionManager!.getSessions(projectPath);
    res.json(sessions);
  }));

  /**
   * GET /api/sessions/:id - Get session details
   */
  app.get('/api/sessions/:id', asyncHandler(async (req: Request, res: Response) => {
    const session = sessionManager!.getSession(req.params.id);
    if (!session) {
      throw createError('Session not found', 404);
    }
    res.json(session);
  }));

  /**
   * GET /api/sessions/:id/messages - Get message history
   */
  app.get('/api/sessions/:id/messages', asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.id;
    const afterSeq = req.query.afterSeq ? parseInt(req.query.afterSeq as string, 10) : undefined;

    let messages;
    if (afterSeq !== undefined && !isNaN(afterSeq)) {
      messages = sessionManager!.getMessagesAfter(sessionId, afterSeq);
    } else {
      messages = sessionManager!.getMessages(sessionId);
    }

    res.json(messages);
  }));

  /**
   * PATCH /api/sessions/:id - Update session (title, etc.)
   */
  app.patch('/api/sessions/:id', asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.id;
    const { title } = req.body;

    if (title) {
      const success = sessionManager!.updateSessionTitle(sessionId, title);
      if (!success) {
        throw createError('Session not found', 404);
      }
    }

    const session = sessionManager!.getSession(sessionId);
    res.json(session);
  }));

  /**
   * DELETE /api/sessions/:id - Archive session (soft delete)
   */
  app.delete('/api/sessions/:id', asyncHandler(async (req: Request, res: Response) => {
    const success = sessionManager!.archiveSession(req.params.id);
    if (!success) {
      throw createError('Session not found', 404);
    }
    res.json({ success: true, message: 'Session archived' });
  }));

  logger.info('Session routes registered');
}
