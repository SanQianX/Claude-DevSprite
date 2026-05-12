/**
 * Worker Entry Point
 * Starts Express HTTP server and background services
 */

import { startServer } from './server';
import { logger } from '../utils/logger';
import { DesignChecker } from '../analyzer/designChecker';
import { closeDatabase } from './db';

// Catch unhandled promise rejections to prevent crash
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', reason);
  // Don't crash - log and continue
});

/**
 * Graceful shutdown handler
 */
function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  try {
    closeDatabase();
    logger.info('Database flushed and closed');
  } catch (err) {
    logger.error('Error during shutdown:', err);
  }
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Start the worker service
 */
export async function startWorker(): Promise<void> {
  logger.info('Starting Claude-DevSprite Worker...');
  try {
    await startServer();

    // Start background design consistency checker
    const designChecker = new DesignChecker({ scanIntervalMs: 10 * 60 * 1000 });
    designChecker.startScanner();
    logger.info('Design consistency checker background scanner started');
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
