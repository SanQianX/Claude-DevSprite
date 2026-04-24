/**
 * Main Entry Point
 * Starts Claude-DevSprite backend service
 */

import { startWorker } from './worker/index';
import { logger } from './utils/logger';

/**
 * Main application entry
 */
export async function main(): Promise<void> {
  try {
    logger.info('Starting Claude-DevSprite...');
    await startWorker();
  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

/**
 * Export main for direct execution
 */
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
