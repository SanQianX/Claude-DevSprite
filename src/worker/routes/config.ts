/**
 * Config API Routes
 * GET /api/config
 * PUT /api/config
 * PATCH /api/config
 * POST /api/config/ai-test
 */

import type { Express, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config';
import { dbPath } from '../../config';
import { createLogger } from '../../utils/logger';
import { resetAgentSingletons } from './reviews';

const logger = createLogger('config');

const CONFIG_DIR = path.join(os.homedir(), '.claude-dev-sprite');
const CONFIG_OVERRIDE_FILE = path.join(CONFIG_DIR, 'config.json');
const AI_ENV_FILE = path.join(CONFIG_DIR, '.env');

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
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_OVERRIDE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Mask an API key for display, e.g. "tp-cwfrlf4o...cgse8"
 */
function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '****';
  return key.substring(0, 8) + '...' + key.substring(key.length - 4);
}

/**
 * Load current AI config from env file, process env, and config override
 */
function loadAIConfig(): {
  model: string; baseUrl: string; hasApiKey: boolean; maskedApiKey: string; maxRetries: number;
  scannerModel: string; fixerModel: string;
  scanner?: { model?: string; apiKey?: string; maskedApiKey?: string; baseUrl?: string };
  fixer?: { model?: string; apiKey?: string; maskedApiKey?: string; baseUrl?: string };
} {
  let model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  let baseUrl = process.env.ANTHROPIC_BASE_URL || '';
  let apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '';
  let maxRetries = 3;
  let scannerModel = '';
  let fixerModel = '';

  // Load from AI env file
  if (fs.existsSync(AI_ENV_FILE)) {
    try {
      const content = fs.readFileSync(AI_ENV_FILE, 'utf-8');
      for (const line of content.split('\n')) {
        const kvMatch = line.match(/^([^#=]+)=(.*)$/);
        if (kvMatch) {
          const key = kvMatch[1].trim();
          const val = kvMatch[2].trim();
          if (key === 'ANTHROPIC_MODEL') model = val;
          else if (key === 'ANTHROPIC_BASE_URL') baseUrl = val;
          else if (key === 'ANTHROPIC_API_KEY') apiKey = val;
          else if (key === 'ANTHROPIC_AUTH_TOKEN' && !apiKey) apiKey = val;
        }
      }
    } catch (err) {
      logger.warn('Failed to read AI env file', err);
    }
  }

  // Load from config override
  const override = loadConfigOverride();
  if (override.ai?.model) model = override.ai.model;
  if (override.ai?.baseUrl !== undefined) baseUrl = override.ai.baseUrl;
  if (override.ai?.apiKey) apiKey = override.ai.apiKey;
  if (override.ai?.scannerModel) scannerModel = override.ai.scannerModel;
  if (override.ai?.fixerModel) fixerModel = override.ai.fixerModel;
  if (override.analysis?.maxRetries) maxRetries = override.analysis.maxRetries;

  // Per-agent config (never expose raw apiKey to frontend)
  const scannerAgent = override.ai?.scanner;
  const fixerAgent = override.ai?.fixer;

  const scanner = scannerAgent ? {
    model: scannerAgent.model,
    hasApiKey: !!scannerAgent.apiKey,
    maskedApiKey: maskApiKey(scannerAgent.apiKey || ''),
    baseUrl: scannerAgent.baseUrl,
  } : undefined;

  const fixer = fixerAgent ? {
    model: fixerAgent.model,
    hasApiKey: !!fixerAgent.apiKey,
    maskedApiKey: maskApiKey(fixerAgent.apiKey || ''),
    baseUrl: fixerAgent.baseUrl,
  } : undefined;

  return { model, baseUrl, hasApiKey: !!apiKey, maskedApiKey: maskApiKey(apiKey), maxRetries, scannerModel, fixerModel, scanner, fixer };
}

/**
 * Save AI config to both the env file and config override
 */
function saveAIConfig(model: string, baseUrl: string, apiKey: string, maxRetries: number, scannerModel?: string, fixerModel?: string, agentConfigs?: { scanner?: { model?: string; apiKey?: string; baseUrl?: string }; fixer?: { model?: string; apiKey?: string; baseUrl?: string } }): void {
  // If apiKey is empty, keep the existing one from env/process
  const currentConfig = loadAIConfigFromEnv();
  const effectiveApiKey = apiKey || currentConfig.apiKey || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '';

  // Save to .env file
  const envLines: string[] = [];
  if (effectiveApiKey) {
    envLines.push(`ANTHROPIC_API_KEY=${effectiveApiKey}`);
  }
  if (baseUrl) {
    envLines.push(`ANTHROPIC_BASE_URL=${baseUrl}`);
  }
  if (model) {
    envLines.push(`ANTHROPIC_MODEL=${model}`);
  }

  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(AI_ENV_FILE, envLines.join('\n') + '\n', 'utf-8');

  // Also update process env so it takes effect immediately
  if (model) process.env.ANTHROPIC_MODEL = model;
  if (baseUrl) process.env.ANTHROPIC_BASE_URL = baseUrl;
  if (effectiveApiKey) process.env.ANTHROPIC_API_KEY = effectiveApiKey;

  // Save non-sensitive config to config.json
  const current = loadConfigOverride();
  // Preserve old per-agent keys BEFORE replacing ai object (line below destroys current.ai.scanner)
  const oldScannerKey = current.ai?.scanner?.apiKey;
  const oldFixerKey = current.ai?.fixer?.apiKey;
  current.ai = {
    model,
    baseUrl,
    hasApiKey: !!effectiveApiKey,
  };
  if (scannerModel !== undefined) current.ai.scannerModel = scannerModel;
  if (fixerModel !== undefined) current.ai.fixerModel = fixerModel;

  // Per-agent config (save keys and baseUrls only, not masked)
  if (agentConfigs?.scanner) {
    current.ai.scanner = {
      model: agentConfigs.scanner.model,
      // Only keep old key when frontend sent explicit undefined (didn't send the field at all).
      // Empty string from frontend = user cleared the key, so we clear it too.
      apiKey: agentConfigs.scanner.apiKey !== undefined ? agentConfigs.scanner.apiKey : oldScannerKey,
      baseUrl: agentConfigs.scanner.baseUrl,
    };
  }
  if (agentConfigs?.fixer) {
    current.ai.fixer = {
      model: agentConfigs.fixer.model,
      apiKey: agentConfigs.fixer.apiKey !== undefined ? agentConfigs.fixer.apiKey : oldFixerKey,
      baseUrl: agentConfigs.fixer.baseUrl,
    };
  }

  current.analysis = {
    ...current.analysis,
    maxRetries,
  };
  saveConfigOverride(current);

  logger.info(`AI config saved: model=${model}, baseUrl=${baseUrl}, hasApiKey=${!!effectiveApiKey}`);
}

/**
 * Load API key ONLY from the user's .env file (not process.env from start script).
 * Used by test endpoint so user can verify their own key.
 */
function loadSavedApiKey(): string {
  let apiKey = '';

  if (fs.existsSync(AI_ENV_FILE)) {
    try {
      const content = fs.readFileSync(AI_ENV_FILE, 'utf-8');
      for (const line of content.split('\n')) {
        const kvMatch = line.match(/^([^#=]+)=(.*)$/);
        if (kvMatch) {
          const key = kvMatch[1].trim();
          const val = kvMatch[2].trim();
          if (key === 'ANTHROPIC_API_KEY') apiKey = val;
          else if (key === 'ANTHROPIC_AUTH_TOKEN' && !apiKey) apiKey = val;
        }
      }
    } catch (err) {
      // ignore
    }
  }

  return apiKey;
}

/**
 * Load AI config only from env file and process env (not config override)
 */
function loadAIConfigFromEnv(): { apiKey: string; baseUrl: string; model: string } {
  let apiKey = '';
  let baseUrl = '';
  let model = '';

  if (fs.existsSync(AI_ENV_FILE)) {
    try {
      const content = fs.readFileSync(AI_ENV_FILE, 'utf-8');
      for (const line of content.split('\n')) {
        const kvMatch = line.match(/^([^#=]+)=(.*)$/);
        if (kvMatch) {
          const key = kvMatch[1].trim();
          const val = kvMatch[2].trim();
          if (key === 'ANTHROPIC_API_KEY') apiKey = val;
          else if (key === 'ANTHROPIC_AUTH_TOKEN' && !apiKey) apiKey = val;
          else if (key === 'ANTHROPIC_BASE_URL') baseUrl = val;
          else if (key === 'ANTHROPIC_MODEL') model = val;
        }
      }
    } catch (err) {
      // ignore
    }
  }

  if (process.env.ANTHROPIC_API_KEY) apiKey = process.env.ANTHROPIC_API_KEY;
  if (process.env.ANTHROPIC_AUTH_TOKEN && !apiKey) apiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  if (process.env.ANTHROPIC_BASE_URL) baseUrl = process.env.ANTHROPIC_BASE_URL;
  if (process.env.ANTHROPIC_MODEL) model = process.env.ANTHROPIC_MODEL;

  return { apiKey, baseUrl, model };
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
    const aiConfig = loadAIConfig();

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
        maxRetries: aiConfig.maxRetries,
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
      ai: {
        model: aiConfig.model,
        baseUrl: aiConfig.baseUrl,
        hasApiKey: aiConfig.hasApiKey,
        maskedApiKey: aiConfig.maskedApiKey,
        maxRetries: aiConfig.maxRetries,
        scannerModel: aiConfig.scannerModel,
        fixerModel: aiConfig.fixerModel,
        scanner: aiConfig.scanner,
        fixer: aiConfig.fixer,
      },
      dbPath: dbPath.replace(process.env.HOME || process.env.USERPROFILE || '', '~'),
    };

    const merged = Object.keys(override).length > 0 ? deepMerge(baseConfig, override) : baseConfig;
    // Ensure ai section always has latest values from loadAIConfig
    merged.ai = baseConfig.ai;
    res.json(merged);
  });

  /**
   * POST /api/config/ai
   * Save AI provider configuration (model, baseUrl, apiKey, maxRetries)
   */
  app.post('/api/config/ai', (req: Request, res: Response) => {
    try {
      const { model, baseUrl, apiKey, maxRetries, scannerModel, fixerModel, scanner, fixer } = req.body;

      if (!model && !baseUrl && apiKey === undefined && maxRetries === undefined && scannerModel === undefined && fixerModel === undefined && !scanner && !fixer) {
        res.status(400).json({ status: 'error', message: 'No AI config fields provided' });
        return;
      }

      // Merge with existing config (keep existing values if not provided)
      const current = loadAIConfig();
      saveAIConfig(
        model || current.model,
        baseUrl !== undefined ? baseUrl : current.baseUrl,
        apiKey || '',  // Empty string means keep existing (loadAIConfig handles this)
        maxRetries ?? current.maxRetries,
        scannerModel ?? current.scannerModel,
        fixerModel ?? current.fixerModel,
        { scanner, fixer },
      );

      const updated = loadAIConfig();
      // Reset agent singletons so next access picks up new config
      resetAgentSingletons();
      res.json({
        status: 'ok',
        message: 'AI configuration saved. Changes take effect on next analysis run.',
        ai: updated,
      });
    } catch (error) {
      logger.error('Error saving AI configuration', error);
      res.status(500).json({ status: 'error', message: 'Failed to save AI configuration' });
    }
  });

  /**
   * POST /api/config/ai-test
   * Test AI connection by making a real API call.
   * Accepts optional `target`: 'shared' (default), 'scanner', or 'fixer'.
   * When target is 'scanner'/'fixer', loads that agent's saved key/model/baseUrl from config.json.
   * Explicit body params (model, baseUrl, apiKey) override the saved values.
   */
  app.post('/api/config/ai-test', async (req: Request, res: Response) => {
    try {
      const target = req.body.target || 'shared';
      const override = loadConfigOverride();

      let testModel: string;
      let testBaseUrl: string | undefined;
      let testApiKey: string;
      let keySource: string;

      if (target === 'scanner' || target === 'fixer') {
        const agent = override.ai?.[target];
        // Per-agent: raw key comes from config.json (saved by saveAIConfig)
        const agentRawKey = agent?.apiKey || '';
        testApiKey = req.body.apiKey || agentRawKey;
        testModel = req.body.model || agent?.model || override.ai?.model || 'claude-sonnet-4-6';
        testBaseUrl = req.body.baseUrl || agent?.baseUrl || override.ai?.baseUrl || process.env.ANTHROPIC_BASE_URL;
        keySource = req.body.apiKey ? 'input' : (agentRawKey ? `saved-${target}` : 'none');
      } else {
        // Shared: key comes from .env file or process env
        const savedApiKey = loadSavedApiKey();
        const savedConfig = loadAIConfigFromEnv();
        testApiKey = req.body.apiKey || savedApiKey;
        testModel = req.body.model || savedConfig.model || 'claude-sonnet-4-6';
        testBaseUrl = req.body.baseUrl || savedConfig.baseUrl || process.env.ANTHROPIC_BASE_URL;
        keySource = req.body.apiKey ? 'input' : (savedApiKey ? 'saved' : 'none');
      }

      if (!testApiKey) {
        const targetLabel = target === 'shared' ? 'Shared config' : `${target.charAt(0).toUpperCase() + target.slice(1)} agent`;
        res.json({ success: false, message: `No API key for ${targetLabel}. Please enter an API key and click Save first.` });
        return;
      }

      const maskedKey = maskApiKey(testApiKey);

      const clientOptions: { apiKey: string; baseURL?: string } = { apiKey: testApiKey };
      if (testBaseUrl) {
        clientOptions.baseURL = testBaseUrl;
      }

      const client = new Anthropic(clientOptions);

      const startTime = Date.now();
      const response = await client.messages.create({
        model: testModel,
        max_tokens: 32,
        messages: [{ role: 'user', content: 'Reply with only: OK' }],
      });
      const latency = Date.now() - startTime;

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('');

      const targetLabel = target === 'shared' ? 'Shared' : target.charAt(0).toUpperCase() + target.slice(1);
      res.json({
        success: true,
        message: `${targetLabel} connection successful. Key: ${maskedKey} (${keySource}), Model: ${testModel}, Latency: ${latency}ms`,
        latency,
        model: testModel,
        maskedKey,
        keySource,
        target,
      });
    } catch (error: any) {
      logger.error('AI connection test failed', error);
      let message = error.message || 'Connection failed';

      // Extract more useful error messages
      if (error.status === 401) {
        message = 'Authentication failed: Invalid API key';
      } else if (error.status === 403) {
        message = 'Access denied: API key does not have permission to use this model';
      } else if (error.status === 404) {
        message = `Model not found: "${req.body.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'}" does not exist or is not available`;
      } else if (error.status === 429) {
        message = 'Rate limited: Too many requests. Try again later.';
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        message = `Cannot connect to server: ${req.body.baseUrl || 'api.anthropic.com'}`;
      }

      res.json({
        success: false,
        message,
      });
    }
  });

  /**
   * PUT /api/config
   * Replace configuration overrides
   */
  app.put('/api/config', (req: Request, res: Response) => {
    try {
      const updates = req.body;

      if (!updates || typeof updates !== 'object') {
        res.status(400).json({ status: 'error', message: 'Configuration must be an object' });
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
