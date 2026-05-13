/**
 * Reviews API Routes
 * GET    /api/projects/:name/reviews       - List reviews (with optional status filter)
 * POST   /api/projects/:name/reviews/scan  - Trigger manual scan
 * POST   /api/reviews/:id/fix              - Generate AI fix for a finding
 */

import type { Express, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { getDatabase } from '../db';
import { CodeReviewer } from '../../analyzer/codeReviewer';
import { DesignScanner } from '../../analyzer/designScanner';
import { DesignFixer } from '../../analyzer/designFixer';
import { createLogger } from '../../utils/logger';

const logger = createLogger('reviews');

const CONFIG_OVERRIDE_FILE = path.join(os.homedir(), '.claude-dev-sprite', 'config.json');

function loadConfigOverride(): Record<string, any> {
  try {
    if (fs.existsSync(CONFIG_OVERRIDE_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_OVERRIDE_FILE, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return {};
}

let reviewer: CodeReviewer | null = null;
let scanner: DesignScanner | null = null;
let fixer: DesignFixer | null = null;

function getReviewer(): CodeReviewer {
  if (!reviewer) {
    reviewer = new CodeReviewer();
  }
  return reviewer;
}

function getScanner(): DesignScanner {
  if (!scanner) {
    const override = loadConfigOverride();
    const scannerModel = override.ai?.scannerModel || override.ai?.model;
    scanner = new DesignScanner({ model: scannerModel });
  }
  return scanner;
}

function getFixer(): DesignFixer {
  if (!fixer) {
    const override = loadConfigOverride();
    const fixerModel = override.ai?.fixerModel || override.ai?.model;
    fixer = new DesignFixer({ model: fixerModel });
  }
  return fixer;
}

export function registerScannerConfigRoutes(app: Express): void {
  /**
   * GET /api/scanner/config
   * Get current scanner configuration
   */
  app.get('/api/scanner/config', asyncHandler(async (_req: Request, res: Response) => {
    const s = getScanner();
    res.json(s.getConfig());
  }));

  /**
   * PUT /api/scanner/config
   * Update scanner configuration (enabled, intervalMs)
   */
  app.put('/api/scanner/config', asyncHandler(async (req: Request, res: Response) => {
    const { enabled, intervalMs } = req.body;
    const s = getScanner();
    s.updateConfig({ enabled, intervalMs });
    res.json({ message: '扫描配置已更新', config: s.getConfig() });
  }));

  /**
   * GET /api/fixer/config
   * Get current fixer configuration
   */
  app.get('/api/fixer/config', asyncHandler(async (_req: Request, res: Response) => {
    const f = getFixer();
    res.json(f.getFixerConfig());
  }));

  /**
   * PUT /api/fixer/config
   * Update fixer configuration (enabled, intervalMs)
   */
  app.put('/api/fixer/config', asyncHandler(async (req: Request, res: Response) => {
    const { enabled, intervalMs } = req.body;
    const f = getFixer();
    f.updateFixerConfig({ enabled, intervalMs });
    res.json({ message: '修复配置已更新', config: f.getFixerConfig() });
  }));
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

    const s = getScanner();
    const findingsCount = await s.scanProject(project.id, project.path, project.name);

    res.json({
      message: `功能一致性扫描完成，发现 ${findingsCount} 个不一致`,
      findingsCount,
    });
  }));

  /**
   * PUT /api/projects/:name/reviews/:id
   * Update a review (approve, ignore, etc.)
   */
  app.put('/api/projects/:name/reviews/:id', asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw createError('Invalid review ID', 400);

    const db = await getDatabase();
    const review = db.getReview(id);
    if (!review) throw createError('Review not found', 404);

    const { status, resolved_at } = req.body;
    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (resolved_at) updates.resolved_at = resolved_at;
    else if (status === 'approved' || status === 'ignored' || status === 'fixed' || status === 'confirmed') {
      updates.resolved_at = new Date().toISOString();
    }

    db.updateReview(id, updates as any);
    res.json({ message: '已更新', review: db.getReview(id) });
  }));

  /**
   * POST /api/projects/:name/reviews/fix-batch
   * Auto-fix reviews for a project:
   *   - If reviewIds provided in body: only process those reviews
   *   - If reviewIds not provided: process all pending reviews
   *   - Reviews with valid file_path: AI generates code fix
   *   - Reviews without valid file_path: mark as confirmed
   */
  app.post('/api/projects/:name/reviews/fix-batch', asyncHandler(async (req: Request, res: Response) => {
    const projectName = req.params.name;
    const { reviewIds } = req.body || {};

    const db = await getDatabase();
    const project = db.getProject(projectName);
    if (!project) throw createError('Project not found', 404);

    // Determine which reviews to process
    let reviewsToProcess;
    if (Array.isArray(reviewIds) && reviewIds.length > 0) {
      // Only process specified reviews
      reviewsToProcess = reviewIds
        .map((id: number) => db.getReview(id))
        .filter((r: any): r is NonNullable<typeof r> => r != null && r.project_id === project.id);
    } else {
      // Process all pending reviews
      reviewsToProcess = db.getPendingReviews(project.id);
    }

    if (reviewsToProcess.length === 0) {
      res.json({ message: '没有待处理的问题', fixed: 0, confirmed: 0, failed: 0, results: [] });
      return;
    }

    const results: Array<{ id: number; action: string; title: string; error?: string }> = [];
    let fixed = 0;
    let confirmed = 0;
    let failed = 0;

    for (const review of reviewsToProcess) {
      try {
        // Check if file_path is valid
        const isValidFilePath = review.file_path
          && /\.(ts|tsx|js|jsx|vue|svelte|py|java|go|rs|cs|css|scss|html|json|yaml|yml)$/.test(review.file_path)
          && fs.existsSync(path.join(project.path, review.file_path));

        if (!isValidFilePath) {
          // Confirm the issue
          db.updateReview(review.id, {
            status: 'confirmed',
            resolved_at: new Date().toISOString(),
          });
          results.push({ id: review.id, action: 'confirmed', title: review.title });
          confirmed++;
        } else {
          // AI generates fix
          const filePath = review.file_path!;
          const codeReviewer = getReviewer();
          const fix = await codeReviewer.generateFix(
            project.path,
            filePath,
            {
              title: review.title,
              description: review.description || review.title,
              suggestion: review.suggestion || undefined,
            }
          );

          if (!fix) {
            results.push({ id: review.id, action: 'failed', title: review.title, error: 'AI 响应异常' });
            failed++;
            continue;
          }

          const fullPath = path.join(project.path, filePath);
          const resolvedPath = path.resolve(fullPath);
          if (!resolvedPath.startsWith(path.resolve(project.path))) {
            results.push({ id: review.id, action: 'failed', title: review.title, error: '路径不安全' });
            failed++;
            continue;
          }

          await fs.promises.writeFile(fullPath, fix.fixedContent, 'utf-8');
          db.updateReview(review.id, { status: 'fixed', resolved_at: new Date().toISOString() });
          results.push({ id: review.id, action: 'fixed', title: review.title });
          fixed++;
        }
      } catch (error: any) {
        results.push({ id: review.id, action: 'failed', title: review.title, error: error.message });
        failed++;
      }
    }

    res.json({
      message: `批量修复完成：${fixed} 个已修复，${confirmed} 个已确认，${failed} 个失败`,
      fixed,
      confirmed,
      failed,
      results,
    });
  }));

  /**
   * POST /api/reviews/:id/fix
   * Handle review action based on source and type:
   *   - source='ai' with file_path: AI generates code fix
   *   - source='design-check' with file_path: AI generates code fix
   *   - source='design-check' without file_path: confirm the issue (no auto-fix)
   */
  app.post('/api/reviews/:id/fix', asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw createError('Invalid review ID', 400);

    const db = await getDatabase();
    const review = db.getReview(id);
    if (!review) throw createError('Review not found', 404);

    const project = db.getProjectById(review.project_id);
    if (!project) throw createError('Project not found', 404);

    // Case 1: No file_path or file_path is not a real code file → confirm the issue
    const isValidFilePath = review.file_path
      && /\.(ts|tsx|js|jsx|vue|svelte|py|java|go|rs|cs|css|scss|html|json|yaml|yml|md)$/.test(review.file_path)
      && fs.existsSync(path.join(project.path, review.file_path));

    if (!isValidFilePath) {
      db.updateReview(id, {
        status: 'confirmed',
        resolved_at: new Date().toISOString(),
      });
      res.json({
        message: '问题已确认',
        explanation: `已标记为"已确认"。${review.file_path ? `文件 "${review.file_path}" 不存在或不是代码文件，` : ''}该问题涉及 ${review.category || '设计层面'}，需要手动处理。`,
        action: 'confirmed',
        review: db.getReview(id),
      });
      return;
    }

    // Case 2: Has valid file_path → AI generates code fix
    const filePath = review.file_path!;
    const codeReviewer = getReviewer();
    const fix = await codeReviewer.generateFix(
      project.path,
      filePath,
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
    const fullPath = path.join(project.path, filePath);

    // Security: check path traversal
    const resolvedPath = path.resolve(fullPath);
    if (!resolvedPath.startsWith(path.resolve(project.path))) {
      throw createError('Path traversal not allowed', 403);
    }

    if (!fs.existsSync(fullPath)) {
      throw createError('源文件不存在', 404);
    }

    await fs.promises.writeFile(fullPath, fix.fixedContent, 'utf-8');

    // Mark review as fixed
    db.updateReview(id, { status: 'fixed', resolved_at: new Date().toISOString() });

    res.json({
      message: '修复已应用',
      explanation: fix.explanation,
      action: 'fixed',
      review: db.getReview(id),
    });
  }));
}