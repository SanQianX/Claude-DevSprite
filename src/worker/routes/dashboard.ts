/**
 * Dashboard API Routes
 * Tasks CRUD for project dashboard
 */

import type { Express, Request, Response } from 'express';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { getDatabase } from '../db';
import type { Task } from '../db';
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
   * POST /api/projects/:name/tasks/batch
   * Create multiple tasks at once (used by chat auto-task creation)
   */
  app.post('/api/projects/:name/tasks/batch', asyncHandler(async (req: Request, res: Response) => {
    const projectName = req.params.name;
    const db = await getDatabase();
    const project = db.getProject(projectName);
    if (!project) throw createError('Project not found', 404);

    const { tasks } = req.body;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw createError('Tasks array is required', 400);
    }

    const VALID_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled'];
    const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

    const created = tasks.map(({ title, description, status, priority, estimated }: any) => {
      if (!title) throw createError('Task title is required', 400);
      return db.createTask({
        project_id: project.id,
        title,
        description: description || null,
        status: VALID_STATUSES.includes(status) ? status : 'backlog',
        priority: VALID_PRIORITIES.includes(priority) ? priority : 'medium',
        estimated: estimated || null,
      });
    });

    logger.info(`Batch created ${created.length} tasks for project ${projectName}`);
    res.status(201).json({ tasks: created });
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

    const VALID_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled'];
    const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

    const task = db.createTask({
      project_id: project.id,
      title,
      description: description || null,
      status: VALID_STATUSES.includes(status) ? status : 'backlog',
      priority: VALID_PRIORITIES.includes(priority) ? priority : 'medium',
      estimated: estimated || null,
    });

    logger.info(`Task created: ${title} for project ${projectName}`);
    res.status(201).json(task);
  }));

  /**
   * PUT /api/projects/:name/tasks/:id
   * Update a task
   */
  app.put('/api/projects/:name/tasks/:id', asyncHandler(async (req: Request, res: Response) => {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) throw createError('Invalid task ID', 400);
    const db = await getDatabase();
    const task = db.getTask(taskId);
    if (!task) throw createError('Task not found', 404);

    const VALID_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled'];
    const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];
    const ALLOWED = ['title', 'description', 'status', 'priority', 'estimated', 'completed_at'];

    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED) {
      if (key in req.body) updates[key] = req.body[key];
    }
    if (updates.status && !VALID_STATUSES.includes(updates.status as string)) {
      throw createError('Invalid status value', 400);
    }
    if (updates.priority && !VALID_PRIORITIES.includes(updates.priority as string)) {
      throw createError('Invalid priority value', 400);
    }
    if (updates.status === 'done' && !updates.completed_at) {
      updates.completed_at = new Date().toISOString();
    }

    db.updateTask(taskId, updates as Partial<Task>);
    res.json({ success: true });
  }));

  /**
   * DELETE /api/projects/:name/tasks/:id
   * Delete a task
   */
  app.delete('/api/projects/:name/tasks/:id', asyncHandler(async (req: Request, res: Response) => {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) throw createError('Invalid task ID', 400);
    const db = await getDatabase();
    const task = db.getTask(taskId);
    if (!task) throw createError('Task not found', 404);

    db.deleteTask(taskId);
    res.json({ success: true });
  }));

}
