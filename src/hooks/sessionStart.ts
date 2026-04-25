/**
 * Session start hook
 * Initializes worker, database, and Git detectors on session start
 */

import { startWorker } from '../worker';
import { getDatabase } from '../worker/db';
import { getProjectDiscoveryService } from '../services/projectDiscovery';
import { logger } from '../utils/logger';
import { config } from '../config';

export async function onSessionStart(): Promise<void> {
  try {
    logger.info('Session start hook triggered');

    // Initialize database first
    logger.info('Initializing database...');
    await getDatabase();
    logger.info('Database initialized');

    // Start the worker server (which will also initialize project discovery)
    await startWorker();

    // Project discovery is auto-triggered by the server if config.projectDiscovery.autoDiscover is true
    // If not, we can manually trigger it here
    if (!config.projectDiscovery.autoDiscover) {
      logger.info('Auto-discovery disabled, skipping project discovery');
    }

    logger.info('Session start completed successfully');
  } catch (error) {
    logger.error('Error in session start hook', error);
    throw error;
  }
}
