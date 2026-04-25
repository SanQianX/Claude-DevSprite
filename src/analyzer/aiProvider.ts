/**
 * AI Provider Adapter
 * Uses Claude CLI subprocess to perform AI analysis
 * Reuses the user's Claude Code model configuration (zero-config)
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createLogger } from '../utils/logger';

const logger = createLogger('ai-provider');

export class AIProvider {
  private model: string;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(config?: { model?: string; maxRetries?: number; retryDelayMs?: number }) {
    this.model = config?.model || 'claude-sonnet-4-6';
    this.maxRetries = config?.maxRetries ?? 2;
    this.retryDelayMs = config?.retryDelayMs ?? 2000;
  }

  /**
   * Call AI model with prompt via Claude CLI
   */
  async callAI(prompt: string): Promise<{ content: string; model: string; tokensUsed: number }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.info(`[AIProvider] Calling Claude CLI (attempt ${attempt}/${this.maxRetries})`);

        const result = await this.executeClaudeCLI(prompt);

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
   * Build clean environment for Claude CLI subprocess
   * Filters out session detection variables and loads API key from .env file
   */
  private buildCleanEnv(): Record<string, string> {
    let env: Record<string, string> = {};
    const excluded = ['CLAUDECODE', 'CLAUDE_CODE_SESSION'];

    // Copy all environment variables except excluded ones
    for (const [key, val] of Object.entries(process.env)) {
      if (val !== undefined && !excluded.includes(key)) {
        env[key] = val;
      }
    }

    // Set SDK entry point to prevent nested session detection
    env.CLAUDE_CODE_ENTRYPOINT = 'sdk-ts';

    // Also load auth vars from daemon's env file (written by daemon.js on start)
    const envFile = path.join(__dirname, '../../dev-scripts/worker-env.json');
    if (fs.existsSync(envFile)) {
      try {
        const extraEnv = JSON.parse(fs.readFileSync(envFile, 'utf-8'));
        for (const [key, val] of Object.entries(extraEnv)) {
          if (typeof val === 'string') {
            env[key] = val;
          }
        }
      } catch (error) {
        logger.warn(`[AIProvider] Failed to read worker-env.json: ${error}`);
      }
    }

    // Load API key from ~/.claude-dev-sprite/.env
    const envPath = path.join(os.homedir(), '.claude-dev-sprite', '.env');
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
          const match = line.match(/^ANTHROPIC_API_KEY=(.+)$/);
          if (match) {
            env.ANTHROPIC_API_KEY = match[1].trim();
            break;
          }
        }
      } catch (error) {
        logger.warn(`[AIProvider] Failed to read .env file: ${error}`);
      }
    }

    // Log available auth methods
    const hasApiKey = !!env.ANTHROPIC_API_KEY;
    const hasAuthToken = !!env.ANTHROPIC_AUTH_TOKEN;
    const hasOAuth = !!env.CLAUDE_CODE_OAUTH_TOKEN;
    logger.info(`[AIProvider] Auth: apiKey=${hasApiKey}, authToken=${hasAuthToken}, oauth=${hasOAuth}`);

    return env;
  }

  /**
   * Execute Claude CLI as subprocess using stdin for prompt (avoids command line length limits)
   */
  private executeClaudeCLI(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Write prompt to a temp file to avoid command line length limits on Windows
      const tmpDir = os.tmpdir();
      const promptFile = path.join(tmpDir, `devsprite-prompt-${Date.now()}.txt`);

      try {
        fs.writeFileSync(promptFile, prompt, 'utf-8');
      } catch (writeError: any) {
        reject(new Error(`Failed to write prompt file: ${writeError.message}`));
        return;
      }

      // Build clean environment and prepare args
      const env = this.buildCleanEnv();
      const args = [
        '-p',
        '--model', this.model,
        '--output-format', 'text',
      ];

      // Add API key flag only if explicitly configured in .env
      // (ANTHROPIC_AUTH_TOKEN and CLAUDE_CODE_OAUTH_TOKEN work via env vars)
      if (env.ANTHROPIC_API_KEY) {
        args.push('--api-key', env.ANTHROPIC_API_KEY);
      }

      // Resolve claude CLI path (may not be in PATH for daemon processes)
      const claudePath = this.resolveClaudeCLI();

      logger.info(`[AIProvider] Spawning: ${claudePath} ${args.filter(a => !a.includes('key')).join(' ')} < prompt`);

      const child = spawn(claudePath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        env,
        shell: process.platform === 'win32',  // Required for .cmd files on Windows
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        // Clean up temp file
        try { fs.unlinkSync(promptFile); } catch {}
        reject(new Error(`Failed to spawn Claude CLI: ${error.message}. Make sure 'claude' is installed and in PATH.`));
      });

      child.on('close', (code) => {
        // Clean up temp file
        try { fs.unlinkSync(promptFile); } catch {}

        if (code !== 0) {
          reject(new Error(`Claude CLI exited with code ${code}\nstderr: ${stderr.substring(0, 500)}`));
          return;
        }

        if (stderr && stderr.includes('error')) {
          logger.warn(`[AIProvider] Claude CLI stderr: ${stderr.substring(0, 200)}`);
        }

        resolve(stdout.trim());
      });

      // Send prompt via stdin and close
      child.stdin.write(prompt);
      child.stdin.end();
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Resolve the full path to the Claude CLI executable
   */
  private resolveClaudeCLI(): string {
    // Common locations for Claude CLI
    const candidates = [
      // npm global on Windows
      path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'claude'),
      // Unix
      '/usr/local/bin/claude',
      '/usr/bin/claude',
      path.join(os.homedir(), '.local', 'bin', 'claude'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    // Fallback to 'claude' and hope PATH is set
    return 'claude';
  }

  setModel(model: string): void {
    this.model = model;
  }
}
