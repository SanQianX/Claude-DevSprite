/**
 * Config API Routes
 * GET /api/config
 * PUT /api/config
 * PATCH /api/config
 */

import type { Express, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { config } from '../../config';
import { dbPath } from '../../config';
import { createLogger } from '../../utils/logger';

const logger = createLogger('config');

const CONFIG_OVERRIDE_FILE = path.join(os.homedir(), '.claude-dev-sprite', 'config.json');

function loadConfigOverride(): Record<string, any> {
  try {
    if (fs.existsSync(CONFIG_OVERRIDE_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_OVERRIDE_FILE, 'utf-8'));
    }
  } catch (err) {
    logger.warn('Failed to load config override', err);
  }
  return {};
}

function saveConfigOverride(data: Record<string, any>): void {
  const dir = path.dirname(CONFIG_OVERRIDE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_OVERRIDE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export function registerConfigRoutes(app: Express): void {
  /**
   * GET /api/config
   * Get current configuration (defaults merged with overrides)
   */
  app.get('/api/config', (_req: Request, res: Response) => {
    const override = loadConfigOverride();

    const baseConfig = {
      server: config.server,
      knowledge: {
        directoryName: config.knowledge.directoryName,
        autoCommit: config.knowledge.autoCommit,
      },
      analysis: {
        mode: config.analysis.mode,
        fullAnalysisIntervalDays: config.analysis.fullAnalysisIntervalDays,
        fullAnalysisTriggers: config.analysis.fullAnalysisTriggers,
        diffMaxTokens: config.analysis.diffMaxTokens,
        maxRetries: config.analysis.maxRetries,
      },
      detection: {
        preferredStrategy: config.detection.preferredStrategy,
        fallbackStrategies: config.detection.fallbackStrategies,
        pollerIntervalMs: config.detection.pollerIntervalMs,
      },
      web: config.web,
      logging: {
        level: config.logging.level,
      },
      projectDiscovery: {
        knowledgeDirName: config.projectDiscovery.knowledgeDirName,
        autoDiscover: config.projectDiscovery.autoDiscover,
        maxDepth: config.projectDiscovery.maxDepth,
        scanPaths: config.projectDiscovery.scanPaths,
      },
      dbPath: dbPath.replace(process.env.HOME || process.env.USERPROFILE || '', '~'),
    };

    const merged = Object.keys(override).length > 0 ? deepMerge(baseConfig, override) : baseConfig;
    res.json(merged);
  });

  /**
   * PUT /api/config
   * Replace configuration overrides
   */
  app.put('/api/config', (req: Request, res: Response) => {
    try {
      const updates = req.body;

      // Validate that the update is an object
      if (!updates || typeof updates !== 'object') {
        res.status(400).json({ status: 'error', message: 'Configuration must be an object' });
        return;
      }

      // Sensitive keys that should not be set
      const blockedKeys = ['apiKey', 'authToken', 'password', 'secret'];
      const hasBlocked = JSON.stringify(updates).toLowerCase().match(
        new RegExp(blockedKeys.join('|'), 'i')
      );
      if (hasBlocked) {
        res.status(400).json({ status: 'error', message: 'Cannot set sensitive configuration' });
        return;
      }

      logger.info('Configuration update (full replace):', Object.keys(updates));
      saveConfigOverride(updates);

      res.json({
        status: 'ok',
        message: 'Configuration updated (restart required for some changes)',
        config: updates
      });
    } catch (error) {
      logger.error('Error updating configuration', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update configuration'
      });
    }
  });

  /**
   * PATCH /api/config
   * Partially update configuration overrides
   */
  app.patch('/api/config', (req: Request, res: Response) => {
    try {
      const updates = req.body;

      if (!updates || typeof updates !== 'object') {
        res.status(400).json({ status: 'error', message: 'Configuration must be an object' });
        return;
      }

      const current = loadConfigOverride();
      const merged = deepMerge(current, updates);

      logger.info('Configuration update (partial):', Object.keys(updates));
      saveConfigOverride(merged);

      res.json({
        status: 'ok',
        message: 'Configuration updated (restart required for some changes)',
        config: merged
      });
    } catch (error) {
      logger.error('Error updating configuration', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update configuration'
      });
    }
  });
}
