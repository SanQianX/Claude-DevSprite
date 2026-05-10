/**
 * Dashboard API Routes
 * Tasks and Reviews CRUD for project dashboard
 */

import type { Express, Request, Response } from 'express';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { getDatabase } from '../db';
import { createLogger } from '../../utils/logger';

const logger = createLogger('dashboard');

export function registerDashboardRoutes(app: Express): void {
  /**
   * GET /api/projects/:name/tasks
   * List tasks for a project
   */
  app.get('/api/projects/:name/tasks', asyncHandler(async (req: Request, res: Response) => {
    const projectName = req.params.name;
    const db = await getDatabase();
    const project = db.getProject(projectName);
    if (!project) throw createError('Project not found', 404);

    const tasks = db.getTasks(project.id);
    res.json({ tasks });
  }));

  /**
   * POST /api/projects/:name/tasks
   * Create a new task
   */
  app.post('/api/projects/:name/tasks', asyncHandler(async (req: Request, res: Response) => {
    const projectName = req.params.name;
    const db = await getDatabase();
    const project = db.getProject(projectName);
    if (!project) throw createError('Project not found', 404);

    const { title, description, status, priority, estimated } = req.body;
    if (!title) throw createError('Title is required', 400);

    const task = db.createTask({
      project_id: project.id,
      title,
      description: description || null,
      status: status || 'backlog',
      priority: priority || 'medium',
      estimated: estimated || null,
    });

    logger.info(`Task created: ${title} for project ${projectName}`);
    res.json(task);
  }));

  /**
   * PUT /api/projects/:name/tasks/:id
   * Update a task
   */
  app.put('/api/projects/:name/tasks/:id', asyncHandler(async (req: Request, res: Response) => {
    const taskId = parseInt(req.params.id, 10);
    const db = await getDatabase();
    const task = db.getTask(taskId);
    if (!task) throw createError('Task not found', 404);

    const updates = req.body;
    if (updates.status === 'done' && !updates.completed_at) {
      updates.completed_at = new Date().toISOString();
    }

    db.updateTask(taskId, updates);
    res.json({ success: true });
  }));

  /**
   * DELETE /api/projects/:name/tasks/:id
   * Delete a task
   */
  app.delete('/api/projects/:name/tasks/:id', asyncHandler(async (req: Request, res: Response) => {
    const taskId = parseInt(req.params.id, 10);
    const db = await getDatabase();
    const task = db.getTask(taskId);
    if (!task) throw createError('Task not found', 404);

    db.deleteTask(taskId);
    res.json({ success: true });
  }));

  /**
   * GET /api/projects/:name/reviews
   * List reviews for a project
   */
  app.get('/api/projects/:name/reviews', asyncHandler(async (req: Request, res: Response) => {
    const projectName = req.params.name;
    const db = await getDatabase();
    const project = db.getProject(projectName);
    if (!project) throw createError('Project not found', 404);

    const reviews = db.getReviews(project.id);
    res.json({ reviews });
  }));

  /**
   * POST /api/projects/:name/reviews
   * Create a new review item
   */
  app.post('/api/projects/:name/reviews', asyncHandler(async (req: Request, res: Response) => {
    const projectName = req.params.name;
    const db = await getDatabase();
    const project = db.getProject(projectName);
    if (!project) throw createError('Project not found', 404);

    const { title, severity, location, suggestion, source } = req.body;
    if (!title) throw createError('Title is required', 400);

    const review = db.createReview({
      project_id: project.id,
      title,
      severity: severity || 'LOW',
      location: location || null,
      suggestion: suggestion || null,
      source: source || 'manual',
      status: 'pending',
      commit_hash: null,
      file_path: null,
      line: null,
      category: null,
      description: null,
    });

    logger.info(`Review created: ${title} for project ${projectName}`);
    res.json(review);
  }));

  /**
   * PUT /api/projects/:name/reviews/:id
   * Update a review (approve, ignore, etc.)
   */
  app.put('/api/projects/:name/reviews/:id', asyncHandler(async (req: Request, res: Response) => {
    const reviewId = parseInt(req.params.id, 10);
    const db = await getDatabase();
    const review = db.getReview(reviewId);
    if (!review) throw createError('Review not found', 404);

    const updates = req.body;
    if (updates.status && ['approved', 'ignored'].includes(updates.status)) {
      updates.resolved_at = new Date().toISOString();
    }

    db.updateReview(reviewId, updates);
    res.json({ success: true });
  }));

  /**
   * DELETE /api/projects/:name/reviews/:id
   * Delete a review
   */
  app.delete('/api/projects/:name/reviews/:id', asyncHandler(async (req: Request, res: Response) => {
    const reviewId = parseInt(req.params.id, 10);
    const db = await getDatabase();
    const review = db.getReview(reviewId);
    if (!review) throw createError('Review not found', 404);

    db.deleteReview(reviewId);
    res.json({ success: true });
  }));
}
