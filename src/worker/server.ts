/**
 * Express HTTP Server
 * Provides API endpoints for Web Dashboard and WebSocket for real-time chat
 */

import express from 'express';
import http from 'http';
import { join, dirname } from 'path';
import { config } from '../config';
import { registerRoutes } from './routes/index';
import { registerSessionRoutes, setSessionManager } from './routes/sessions';
import { errorHandler } from './middleware/errorHandler';
import { cors } from './middleware/cors';
import { logger } from '../utils/logger';
import { CommitDetectorManager } from '../detectors';
import { Analyzer } from '../analyzer';
import * as fs from 'fs';
import { getProjectDiscoveryService } from '../services/projectDiscovery';
import { registerProjectDetector } from './detectorRegistry';
import { sseBroadcaster } from './sseBroadcaster';
import { analysisTracker } from './analysisTracker';
import { WsServer } from './wsServer';
import { SessionManager } from './sessionManager';

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

  // SSE stream endpoint for real-time analysis progress
  app.get('/api/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    sseBroadcaster.addClient(res);

    // Send initial state
    const currentState = analysisTracker.getState();
    res.write(`data: ${JSON.stringify({ type: 'analysis_progress', ...currentState, timestamp: Date.now() })}\n\n`);

    // Keep-alive every 30 seconds to prevent proxy timeouts
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(keepAlive);
    });
  });

  // API routes
  registerRoutes(app);

  // Initialize session manager and WebSocket server
  const sessionManager = new SessionManager();
  setSessionManager(sessionManager);
  registerSessionRoutes(app);

  // Initialize analyzer
  analyzer = new Analyzer();

  // Initialize project discovery and detectors
  const discovery = getProjectDiscoveryService();

  if (config.projectDiscovery.autoDiscover) {
    logger.info('[Server] Auto-discovering projects...');
    try {
      const projects = await discovery.discoverProjects();
      logger.info(`[Server] Discovered ${projects.length} project(s)`);

      // Set up detectors for each project
      for (const project of projects) {
        await setupProjectDetector(project.path, project.name);
      }
    } catch (error) {
      logger.error('[Server] Project discovery failed:', error);
    }
  }

  // Static files serve web UI
  const webDistPath = join(__dirname, '../../web/dist');
  app.use(express.static(webDistPath));

  // SPA fallback - serve index.html for any non-API route
  app.get('*', (_req, res, next) => {
    // Only handle non-API routes (browser navigation)
    if (_req.path.startsWith('/api/')) {
      return next();
    }
    const indexPath = join(webDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });

  // Error handling
  app.use(errorHandler);

  // Create HTTP server (needed for WebSocket attachment)
  const httpServer = http.createServer(app);

  // Initialize and attach WebSocket server
  const wsServer = new WsServer(sessionManager);
  wsServer.attach(httpServer);

  // Start listening
  httpServer.listen(config.server.port, () => {
    logger.info(`Claude-DevSprite Worker listening on http://localhost:${config.server.port}`);
    logger.info(`WebSocket server available at ws://localhost:${config.server.port}/ws`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    wsServer.shutdown();
    httpServer.close(() => {
      logger.info('Server shut down');
      process.exit(0);
    });
  });
}

import { getAllProjectDetectors as getAllDetectors } from './detectorRegistry';

async function setupProjectDetector(repoPath: string, projectName: string): Promise<void> {
  if (getAllDetectors().has(projectName)) {
    return; // Already set up
  }

  try {
    const detectorManager = new CommitDetectorManager(repoPath);

    // Register commit event handler
    detectorManager.onCommit(async (event) => {
      logger.info(`[CommitDetector] Commit detected in ${projectName}: ${event.commitHash.substring(0, 7)} - ${event.commitMessage}`);

      if (analyzer) {
        analysisTracker.startAnalysis(projectName, event.commitHash, 'incremental');
        try {
          logger.info(`[CommitDetector] Triggering AI analysis for ${projectName}`);
          analysisTracker.updateStep('analyzing', 20);
          const result = await analyzer.analyze(event.repoPath, event.commitHash);

          // Write documents to project's knowledge directory
          const knowledgePath = join(event.repoPath, config.knowledge.directoryName);
          if (!fs.existsSync(knowledgePath)) {
            fs.mkdirSync(knowledgePath, { recursive: true });
          }

          analysisTracker.updateStep('writing_documents', 80);
          for (const doc of result.documents) {
            const docPath = join(knowledgePath, doc.path);
            const docDir = dirname(docPath);

            if (!fs.existsSync(docDir)) {
              fs.mkdirSync(docDir, { recursive: true });
            }

            fs.writeFileSync(docPath, doc.content, 'utf-8');
            logger.info(`[CommitDetector] Wrote document: ${doc.path}`);
          }

          analysisTracker.completeAnalysis();
          logger.info(`[CommitDetector] Analysis completed: ${result.documents.length} document(s) generated`);
        } catch (error) {
          analysisTracker.failAnalysis(error instanceof Error ? error.message : 'Unknown error');
          logger.error(`[CommitDetector] AI analysis failed for ${projectName}:`, error);
        }
      }
    });

    // Start detection
    await detectorManager.start();

    registerProjectDetector(projectName, detectorManager, repoPath);

    logger.info(`[Server] Detector set up for project: ${projectName}`);
  } catch (error) {
    logger.error(`[Server] Failed to set up detector for ${projectName}:`, error);
  }
}

/**
 * Get detector for a specific project
 */
export { getProjectDetector } from './detectorRegistry';

/**

 * Get the analyzer instance
 */
export function getAnalyzer(): Analyzer | null {
  return analyzer;
}
