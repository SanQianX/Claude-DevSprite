/**
 * Worker Entry Point
 * Starts Express HTTP server and background services
 */

import { startServer } from './server';
import { logger } from '../utils/logger';
import { CodeReviewer } from '../analyzer/codeReviewer';

// Catch unhandled promise rejections to prevent crash
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', reason);
  // Don't crash - log and continue
});

/**
 * Start the worker service
 */
export async function startWorker(): Promise<void> {
  logger.info('Starting Claude-DevSprite Worker...');
  try {
    await startServer();

    // Start background code review scanner
    const reviewer = new CodeReviewer({ scanIntervalMs: 5 * 60 * 1000 });
    reviewer.startScanner();
    logger.info('Code review background scanner started');
  } catch (error) {
    logger.error('Failed to start worker', error);
    process.exit(1);
  }
}

// If run directly, start the worker
if (require.main === module) {
  startWorker().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
