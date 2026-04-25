/**
 * Session end hook
 * Cleans up Git hooks and shuts down services
 */

import { closeDatabase } from '../worker/db';
import { getAllProjectDetectors } from '../worker/detectorRegistry';
import { logger } from '../utils/logger';

export async function onSessionEnd(): Promise<void> {
  try {
    logger.info('Session end hook triggered');

    // Stop all project detectors
    const detectors = getAllProjectDetectors();
    for (const [projectName, entry] of detectors.entries()) {
      try {
        logger.info(`Stopping detector for project: ${projectName}`);
        await entry.detector.stop();
      } catch (error) {
        logger.error(`Error stopping detector for ${projectName}:`, error);
      }
    }

    // Close database connection
    logger.info('Closing database connection...');
    await closeDatabase();

    // Note: Express worker will be stopped when the process exits
    logger.info('Session end completed successfully');
  } catch (error) {
    logger.error('Error in session end hook', error);
  }
}
