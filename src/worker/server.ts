/**
 * Express HTTP Server
 * Provides API endpoints for Web Dashboard
 */

import express from 'express';
import { join, dirname } from 'path';
import { config } from '../config';
import { registerRoutes } from './routes/index';
import { errorHandler } from './middleware/errorHandler';
import { cors } from './middleware/cors';
import { logger } from '../utils/logger';
import { CommitDetectorManager } from '../detectors';
import { setDetectorManager } from './routes/git';
import { Analyzer } from '../analyzer';
import { setAnalyzer } from './routes/analysis';
import * as fs from 'fs';

let detectorManager: CommitDetectorManager | null = null;
let analyzer: Analyzer | null = null;

export async function startServer(): Promise<void> {
  const app = express();

  // Middleware
  app.use(cors);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logger
  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // API routes
  registerRoutes(app);

  // Initialize analyzer
  analyzer = new Analyzer();
  setAnalyzer(analyzer);

  // Initialize Git detector manager
  if (config.knowledgeRoot && fs.existsSync(config.knowledgeRoot)) {
    try {
      detectorManager = new CommitDetectorManager(config.knowledgeRoot);
      setDetectorManager(detectorManager);

      // Register commit event handler
      detectorManager.onCommit(async (event) => {
        logger.info(`[CommitDetector] Commit detected: ${event.commitHash.substring(0, 7)} - ${event.commitMessage}`);

        // Trigger AI analysis
        if (analyzer) {
          try {
            logger.info(`[CommitDetector] Triggering AI analysis for ${event.commitHash}`);
            const result = await analyzer.analyze(event.repoPath, event.commitHash);

            // Write documents to knowledge directory
            const knowledgePath = join(event.repoPath, 'knowledge');
            if (!fs.existsSync(knowledgePath)) {
              fs.mkdirSync(knowledgePath, { recursive: true });
            }

            for (const doc of result.documents) {
              const docPath = join(knowledgePath, doc.path);
              const docDir = dirname(docPath);

              if (!fs.existsSync(docDir)) {
                fs.mkdirSync(docDir, { recursive: true });
              }

              fs.writeFileSync(docPath, doc.content, 'utf-8');
              logger.info(`[CommitDetector] Wrote document: ${doc.path}`);
            }

            logger.info(`[CommitDetector] Analysis completed: ${result.documents.length} document(s) generated`);
          } catch (error) {
            logger.error('[CommitDetector] AI analysis failed:', error);
          }
        }
      });

      // Start detection
      await detectorManager.start();
    } catch (error) {
      logger.error('Failed to initialize detector manager:', error);
    }
  } else {
    logger.warn(`Knowledge root not found or not accessible: ${config.knowledgeRoot}`);
  }

  // Static files serve web UI
  const webDistPath = join(__dirname, '../../web/dist');
  app.use(express.static(webDistPath));

  // Error handling
  app.use(errorHandler);

  // Start listening
  app.listen(config.port, () => {
    logger.info(`Claude-DevSprite Worker listening on http://localhost:${config.port}`);
  });
}

/**
 * Get the detector manager instance
 */
export function getDetectorManager(): CommitDetectorManager | null {
  return detectorManager;
}

/**
 * Get the analyzer instance
 */
export function getAnalyzer(): Analyzer | null {
  return analyzer;
}
