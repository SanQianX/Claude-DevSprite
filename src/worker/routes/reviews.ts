/**
 * Reviews API Routes
 * GET    /api/projects/:name/reviews       - List reviews (with optional status filter)
 * POST   /api/projects/:name/reviews/scan  - Trigger manual scan
 * PUT    /api/reviews/:id/approve          - Approve a review finding
 * PUT    /api/reviews/:id/ignore           - Ignore a review finding
 * POST   /api/reviews/:id/fix              - Generate AI fix for a finding
 */

import type { Express, Request, Response } from 'express';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { getDatabase } from '../db';
import { CodeReviewer } from '../../analyzer/codeReviewer';
import { createLogger } from '../../utils/logger';

const logger = createLogger('reviews');

let reviewer: CodeReviewer | null = null;

function getReviewer(): CodeReviewer {
  if (!reviewer) {
    reviewer = new CodeReviewer();
  }
  return reviewer;
}

export function registerReviewRoutes(app: Express): void {
  /**
   * GET /api/projects/:name/reviews
   * List reviews for a project, optionally filtered by status
   */
  app.get('/api/projects/:name/reviews', asyncHandler(async (req: Request, res: Response) => {
    const projectName = req.params.name;
    const status = req.query.status as string | undefined;

    const db = await getDatabase();
    const project = db.getProject(projectName);
    if (!project) throw createError('Project not found', 404);

    const reviews = status === 'pending'
      ? db.getPendingReviews(project.id)
      : db.getReviews(project.id);

    res.json({ reviews });
  }));

  /**
   * POST /api/projects/:name/reviews/scan
   * Trigger a manual code review scan for a project
   */
  app.post('/api/projects/:name/reviews/scan', asyncHandler(async (req: Request, res: Response) => {
    const projectName = req.params.name;

    const db = await getDatabase();
    const project = db.getProject(projectName);
    if (!project) throw createError('Project not found', 404);

    const codeReviewer = getReviewer();
    const findingsCount = await codeReviewer.scanProject(project.id, project.path, project.name);

    res.json({
      message: `扫描完成，发现 ${findingsCount} 个问题`,
      findingsCount,
    });
  }));

  /**
   * PUT /api/reviews/:id/approve
   * Approve a review finding (mark as approved)
   */
  app.put('/api/reviews/:id/approve', asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw createError('Invalid review ID', 400);

    const db = await getDatabase();
    const review = db.getReview(id);
    if (!review) throw createError('Review not found', 404);

    db.updateReview(id, { status: 'approved', resolved_at: new Date().toISOString() });
    res.json({ message: '已批准', review: db.getReview(id) });
  }));

  /**
   * PUT /api/reviews/:id/ignore
   * Ignore a review finding (mark as ignored)
   */
  app.put('/api/reviews/:id/ignore', asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw createError('Invalid review ID', 400);

    const db = await getDatabase();
    const review = db.getReview(id);
    if (!review) throw createError('Review not found', 404);

    db.updateReview(id, { status: 'ignored', resolved_at: new Date().toISOString() });
    res.json({ message: '已忽略', review: db.getReview(id) });
  }));

  /**
   * POST /api/reviews/:id/fix
   * Generate an AI fix for a review finding and apply it
   */
  app.post('/api/reviews/:id/fix', asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw createError('Invalid review ID', 400);

    const db = await getDatabase();
    const review = db.getReview(id);
    if (!review) throw createError('Review not found', 404);
    if (!review.file_path) throw createError('Review has no associated file', 400);

    const project = db.getProjectById(review.project_id);
    if (!project) throw createError('Project not found', 404);

    const codeReviewer = getReviewer();
    const fix = await codeReviewer.generateFix(
      project.path,
      review.file_path,
      {
        title: review.title,
        description: review.description || review.title,
        suggestion: review.suggestion || undefined,
      }
    );

    if (!fix) {
      throw createError('无法生成修复方案（文件过大或 AI 响应异常）', 500);
    }

    // Write the fixed content
    const fs = require('fs');
    const path = require('path');
    const fullPath = path.join(project.path, review.file_path);

    if (!fs.existsSync(fullPath)) {
      throw createError('源文件不存在', 404);
    }

    fs.writeFileSync(fullPath, fix.fixedContent, 'utf-8');

    // Mark review as fixed
    db.updateReview(id, { status: 'fixed', resolved_at: new Date().toISOString() });

    res.json({
      message: '修复已应用',
      explanation: fix.explanation,
      review: db.getReview(id),
    });
  }));
}
