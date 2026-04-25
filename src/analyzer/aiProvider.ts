/**
 * AI Provider Adapter
 * Primary: Uses Anthropic SDK directly for API calls (works with custom base URLs)
 * Fallback: Uses Claude CLI subprocess
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

function loadEnvConfig(): AIConfig {
  const config: AIConfig = {};

  // Load from worker-env.json (written by daemon.js on start)
  const envFile = path.join(__dirname, '../../dev-scripts/worker-env.json');
  if (fs.existsSync(envFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(envFile, 'utf-8'));
      if (data.ANTHROPIC_API_KEY) config.apiKey = data.ANTHROPIC_API_KEY;
      if (data.ANTHROPIC_AUTH_TOKEN) config.authToken = data.ANTHROPIC_AUTH_TOKEN;
      if (data.ANTHROPIC_BASE_URL) config.baseUrl = data.ANTHROPIC_BASE_URL;
      if (data.ANTHROPIC_MODEL) config.model = data.ANTHROPIC_MODEL;
    } catch (error) {
      logger.warn(`[AIProvider] Failed to read worker-env.json: ${error}`);
    }
  }

  // Load API key from ~/.claude-dev-sprite/.env (overrides env file)
  const envPath = path.join(os.homedir(), '.claude-dev-sprite', '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const match = line.match(/^ANTHROPIC_API_KEY=(.+)$/);
        if (match) {
          config.apiKey = match[1].trim();
          break;
        }
      }
    } catch (error) {
      logger.warn(`[AIProvider] Failed to read .env file: ${error}`);
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
    this.envConfig = loadEnvConfig();

    // Model priority: explicit config > env config > default
    this.model = config?.model || this.envConfig.model || 'claude-sonnet-4-6';
    this.maxRetries = config?.maxRetries ?? 2;
    this.retryDelayMs = config?.retryDelayMs ?? 2000;

    // Use SDK if we have an API key or auth token
    this.useSDK = !!(this.envConfig.apiKey || this.envConfig.authToken);

    const hasKey = !!this.envConfig.apiKey;
    const hasToken = !!this.envConfig.authToken;
    const hasBase = !!this.envConfig.baseUrl;
    logger.info(`[AIProvider] Mode: ${this.useSDK ? 'SDK' : 'CLI'}, model: ${this.model}, apiKey=${hasKey}, authToken=${hasToken}, baseUrl=${hasBase}`);
  }

  /**
   * Call AI model - uses SDK directly if API key is available, falls back to CLI
   */
  async callAI(prompt: string): Promise<{ content: string; model: string; tokensUsed: number }> {
    let lastError: Error | null = null;

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
