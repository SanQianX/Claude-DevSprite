/**
 * Analysis API Routes
 * POST /api/projects/:name/analyze
 * GET /api/projects/:name/analysis-log
 * GET /api/projects/:name/analysis-status
 */

import type { Express, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { config } from '../../config';
import { Analyzer } from '../../analyzer';
import { createError } from '../middleware/errorHandler';
import { createLogger } from '../../utils/logger';

const logger = createLogger('analysis');

// Global analyzer instance
let analyzer: Analyzer | null = null;

export function registerAnalysisRoutes(app: Express): void {
  /**
   * POST /api/projects/:name/analyze
   * Trigger manual analysis
   */
  app.post('/api/projects/:name/analyze', async (req: Request, res: Response) => {
    const { name } = req.params;
    const { commitHash, mode } = req.body;

    try {
      const projectPath = path.join(config.knowledgeRoot, name);

      if (!fs.existsSync(projectPath)) {
        throw createError('Project not found', 404);
      }

      // Initialize analyzer if needed
      if (!analyzer) {
        analyzer = new Analyzer();
      }

      // If commitHash is not provided, get the latest commit
      let targetCommitHash = commitHash;
      if (!targetCommitHash) {
        // Use simple-git to get latest commit
        const simpleGit = (await import('simple-git')).default;
        const git = simpleGit(projectPath);
        const log = await git.log({ maxCount: 1 });
        targetCommitHash = log.latest?.hash;
      }

      if (!targetCommitHash) {
        throw createError('No commit hash found', 400);
      }

      logger.info(`[AnalysisRoutes] Starting analysis for ${name} at commit ${targetCommitHash}`);

      // Perform analysis
      const result = await analyzer.analyze(projectPath, targetCommitHash);

      // Write documents to knowledge directory
      const knowledgePath = path.join(projectPath, 'knowledge');
      if (!fs.existsSync(knowledgePath)) {
        fs.mkdirSync(knowledgePath, { recursive: true });
      }

      for (const doc of result.documents) {
        const docPath = path.join(knowledgePath, doc.path);
        const docDir = path.dirname(docPath);

        if (!fs.existsSync(docDir)) {
          fs.mkdirSync(docDir, { recursive: true });
        }

        fs.writeFileSync(docPath, doc.content, 'utf-8');
        logger.info(`[AnalysisRoutes] Wrote document: ${doc.path}`);
      }

      res.json({
        projectName: name,
        status: 'completed',
        commitHash: targetCommitHash,
        documentsGenerated: result.documents.length,
        modelUsed: result.modelUsed,
        tokensUsed: result.tokensUsed,
        durationMs: result.durationMs,
      });
    } catch (error: any) {
      if (error.statusCode) {
        throw error;
      }
      logger.error('[AnalysisRoutes] Analysis failed:', error);
      throw createError('Analysis failed', 500, error);
    }
  });

  /**
   * GET /api/projects/:name/analysis-log
   * Get analysis history
   */
  app.get('/api/projects/:name/analysis-log', (req: Request, res: Response) => {
    const { name } = req.params;
    const { limit } = req.query;

    // For now, return empty array
    // In a full implementation, this would query the database for analysis history
    res.json({
      projectName: name,
      logs: [],
      limit: limit ? parseInt(limit as string) : 10,
    });
  });

  /**
   * GET /api/projects/:name/analysis-status
   * Get current analysis status
   */
  app.get('/api/projects/:name/analysis-status', (req: Request, res: Response) => {
    const { name } = req.params;

    // For now, return idle status
    // In a full implementation, this would check if an analysis is currently running
    res.json({
      projectName: name,
      status: 'idle',
      lastAnalysis: null,
      queuedAnalyses: 0,
    });
  });
}

/**
 * Get the global analyzer instance
 */
export function getAnalyzer(): Analyzer | null {
  return analyzer;
}

/**
 * Set the global analyzer instance
 */
export function setAnalyzer(a: Analyzer): void {
  analyzer = a;
}
