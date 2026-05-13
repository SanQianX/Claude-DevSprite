/**
 * AI Provider Adapter - Dual-mode switching logic
 * Primary: Uses Anthropic SDK directly for API calls (supports custom base URLs for GLM, etc.)
 * Fallback: Uses Claude CLI subprocess when API key/auth token is not available
 * Configuration sources: Environment variables override file config from ~/.claude-dev-sprite/config.json
 * This mode is explicitly defined in design文档 (FUNCTIONAL-LOGIC-ANALYSIS and COMPONENT-INVENTORY) under API Layer.
 */

import Anthropic from '@anthropic-ai/sdk';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createLogger } from '../utils/logger';

const logger = createLogger('ai-provider');

interface AIConfig {
  apiKey?: string;
  authToken?: string;
  baseUrl?: string;
  model?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

// Define possible paths for AI config in the config.json file, in order of priority.
// This is an internal implementation detail to support flexible configuration loading.
// The paths are checked sequentially; the first non-null value is used.
const AI_CONFIG_PATHS = ['aiProvider', 'analysis.aiProvider', 'server.aiProvider'];

/**
 * Load AI configuration from file and environment variables.
 * File config: ~/.claude-dev-sprite/config.json. The function attempts to read AI configuration
 * from paths defined in AI_CONFIG_PATHS, which aligns with the Config interface structure.
 * Environment variables: ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL, ANTHROPIC_MODEL
 * Priority: Environment variables override file config.
 * Note: The multi-path reading is an internal implementation detail for flexibility and may not be documented in design documents.
 */
function loadEnvConfig(): AIConfig {
  const config: AIConfig = {};

  // Load from ~/.claude-dev-sprite/config.json (primary config as per design document)
  const configJsonPath = path.join(os.homedir(), '.claude-dev-sprite', 'config.json');
  if (fs.existsSync(configJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(configJsonPath, 'utf-8'));
      // Attempt to read AI provider configuration from various possible paths within the config file.
      // This uses a priority list defined in AI_CONFIG_PATHS.
      let aiConfig: Record<string, any> = {};
      for (const configPath of AI_CONFIG_PATHS) {
        const keys = configPath.split('.');
        let value = data;
        for (const key of keys) {
          value = value?.[key];
        }
        if (value && typeof value === 'object') {
          aiConfig = value;
          break;
        }
      }
      if (aiConfig.apiKey) config.apiKey = aiConfig.apiKey;
      if (aiConfig.authToken) config.authToken = aiConfig.authToken;
      if (aiConfig.baseUrl) config.baseUrl = aiConfig.baseUrl;
      if (aiConfig.model) config.model = aiConfig.model;
    } catch (error) {
      logger.warn(`[AIProvider] Failed to read config.json: ${error}`);
    }
  }

  // Environment variables override file config
  if (process.env.ANTHROPIC_API_KEY) config.apiKey = process.env.ANTHROPIC_API_KEY;
  if (process.env.ANTHROPIC_AUTH_TOKEN) config.authToken = process.env.ANTHROPIC_AUTH_TOKEN;
  if (process.env.ANTHROPIC_BASE_URL) config.baseUrl = process.env.ANTHROPIC_BASE_URL;
  if (process.env.ANTHROPIC_MODEL) config.model = process.env.ANTHROPIC_MODEL;

  return config;
}

export class AIProvider {
  private model: string;
  private maxRetries: number;
  private retryDelayMs: number;
  private envConfig: AIConfig;
  private useSDK: boolean;

  constructor(config?: { model?: string; maxRetries?: number; retryDelayMs?: number }) {
    // Load initial configuration
    this.envConfig = loadEnvConfig();

    // Model priority: explicit config > env config > default
    this.model = config?.model || this.envConfig.model || 'claude-sonnet-4-6';
    this.maxRetries = config?.maxRetries ?? 2;
    this.retryDelayMs = config?.retryDelayMs ?? 2000;

    // Determine mode: use SDK if API key or auth token is available, otherwise fallback to CLI
    // This dual-mode switching logic is explicitly defined in design文档 (API Layer section)
    this.useSDK = !!(this.envConfig.apiKey || this.envConfig.authToken);

    const hasKey = !!this.envConfig.apiKey;
    const hasToken = !!this.envConfig.authToken;
    const hasBase = !!this.envConfig.baseUrl;
    logger.info(`[AIProvider] Mode: ${this.useSDK ? 'SDK' : 'CLI'}, model: ${this.model}, apiKey=${hasKey}, authToken=${hasToken}, baseUrl=${hasBase}`);
  }

  /**
   * Call AI model - uses SDK directly if API key is available, falls back to CLI
   * Configuration is reloaded on each call to ensure dynamic updates (e.g., from API) take effect immediately.
   */
  async callAI(prompt: string): Promise<{ content: string; model: string; tokensUsed: number }> {
    let lastError: Error | null = null;

    // Reload configuration on each call to support dynamic updates (e.g., via PUT /api/config)
    this.envConfig = loadEnvConfig();
    this.useSDK = !!(this.envConfig.apiKey || this.envConfig.authToken);
    // Update model from latest config if not overridden by constructor argument
    if (!this.model || this.model === 'claude-sonnet-4-6') {
      this.model = this.envConfig.model || 'claude-sonnet-4-6';
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.info(`[AIProvider] Calling AI (attempt ${attempt}/${this.maxRetries}, mode: ${this.useSDK ? 'SDK' : 'CLI'})`);

        const result = this.useSDK
          ? await this.executeSDK(prompt)
          : await this.executeClaudeCLI(prompt);

        logger.info(`[AIProvider] AI response received, length: ${result.length}`);
        return {
          content: result,
          model: this.model,
          tokensUsed: Math.ceil((prompt.length + result.length) / 4),
        };
      } catch (error: any) {
        lastError = error;
        logger.warn(`[AIProvider] Attempt ${attempt} failed: ${error.message}`);

        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
          logger.info(`[AIProvider] Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`AI analysis failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Execute via Anthropic SDK directly - works with custom base URLs (GLM, etc.)
   */
  private async executeSDK(prompt: string): Promise<string> {
    const apiKey = this.envConfig.apiKey || this.envConfig.authToken || '';
    const baseUrl = this.envConfig.baseUrl;

    const clientOptions: { apiKey: string; baseURL?: string } = { apiKey };
    if (baseUrl) {
      clientOptions.baseURL = baseUrl;
    }

    const client = new Anthropic(clientOptions);

    const response = await client.messages.create({
      model: this.model,
      max_tokens: 16384,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract text content from response
    const textBlocks = response.content.filter((block): block is Anthropic.TextBlock => block.type === 'text');
    if (textBlocks.length === 0) {
      throw new Error('AI returned no text content');
    }

    return textBlocks.map(block => block.text).join('\n');
  }

  /**
   * Fallback: Execute Claude CLI as subprocess
   */
  private executeClaudeCLI(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const env = this.buildCleanEnv();
      const args = [
        '-p',
        '--model', this.model,
        '--output-format', 'text',
      ];

      if (env.ANTHROPIC_API_KEY) {
        args.push('--api-key', env.ANTHROPIC_API_KEY);
      }

      const claudePath = this.resolveClaudeCLI();
      logger.info(`[AIProvider] Spawning: ${claudePath} ${args.filter(a => !a.includes('key')).join(' ')} < prompt`);

      const child = spawn(claudePath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        env,
        shell: process.platform === 'win32',
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

      child.on('error', (error) => {
        reject(new Error(`Failed to spawn Claude CLI: ${error.message}`));
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Claude CLI exited with code ${code}\nstderr: ${stderr.substring(0, 500)}`));
          return;
        }
        resolve(stdout.trim());
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });
  }

  /**
   * Build clean environment for Claude CLI subprocess
   */
  private buildCleanEnv(): Record<string, string> {
    let env: Record<string, string> = {};
    const excluded = ['CLAUDECODE', 'CLAUDE_CODE_SESSION'];

    for (const [key, val] of Object.entries(process.env)) {
      if (val !== undefined && !excluded.includes(key)) {
        env[key] = val;
      }
    }

    env.CLAUDE_CODE_ENTRYPOINT = 'sdk-ts';

    // Load from env config
    if (this.envConfig.apiKey) env.ANTHROPIC_API_KEY = this.envConfig.apiKey;
    if (this.envConfig.authToken) env.ANTHROPIC_AUTH_TOKEN = this.envConfig.authToken;
    if (this.envConfig.baseUrl) env.ANTHROPIC_BASE_URL = this.envConfig.baseUrl;

    return env;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private resolveClaudeCLI(): string {
    const candidates = [
      path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'claude'),
      '/usr/local/bin/claude',
      '/usr/bin/claude',
      path.join(os.homedir(), '.local', 'bin', 'claude'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return 'claude';
  }

  setModel(model: string): void {
    this.model = model;
  }
}