/**
 * Worker Entry Point
 * Starts Express HTTP server and background services
 */

import { startServer } from './server';
import { logger } from '../utils/logger';

/**
 * Start the worker service
 */
export async function startWorker(): Promise<void> {
  logger.info('Starting Claude-DevSprite Worker...');
  try {
    await startServer();
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
