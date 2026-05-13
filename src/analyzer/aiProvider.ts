import Anthropic from '@anthropic-ai/sdk';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createLogger } from '../utils/logger';

const logger = createLogger('ai-provider');

export interface AIConfig {
  apiKey?: string;
  authToken?: string;
  baseUrl?: string;
  model?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

/**
 * Defines the possible nested paths within the main config.json file to locate AI provider configuration.
 * This supports flexible configuration structure. Paths are checked sequentially within the file; the first valid (non-null object) value found is used.
 * Priority order for file config paths: 'aiProvider' (top-level) > 'analysis.aiProvider' > 'server.aiProvider'.
 */
const AI_CONFIG_PATHS = ['aiProvider', 'analysis.aiProvider', 'server.aiProvider'];

/**
 * Load AI configuration from file and environment variables.
 * File config: ~/.claude-dev-sprite/config.json. The function loads the AI configuration
 * using a multi-path strategy defined in AI_CONFIG_PATHS to support flexible configuration structures.
 * Multi-path fallback mechanism: The function checks paths in AI_CONFIG_PATHS sequentially;
 * for each path, it traverses the config.json object using dot notation (e.g., 'analysis.aiProvider'
 * means data.analysis.aiProvider). The first path that resolves to a non-null object is used as the
 * source for file-based AI configuration. This provides flexibility in config file organization.
 * 
 * Configuration Loading & Override Process:
 * The function follows a sequential loading and overriding pattern. Each subsequent source
 * overwrites values from the previous source for any provided keys.
 * 1. **File Configuration:** Loaded first from `~/.claude-dev-sprite/config.json` using the multi-path strategy.
 *    The first valid object found at paths in `AI_CONFIG_PATHS` (e.g., `aiProvider`, `analysis.aiProvider`) provides base settings.
 * 2. **External Configuration:** Applied next, overriding file config values. This comes from any external module
 *    via `AIProvider.setConfig()` and allows runtime updates.
 * 3. **Environment Variables:** Applied last, overriding all previous settings for their respective keys
 *    (`ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`). This grants the highest precedence.
 * 4. **Default Values:** Used within the calling constructor for any keys still undefined after the above steps
 *    (e.g., default model 'claude-sonnet-4-6').
 * 
 * This ensures the final configuration respects the hierarchy: Env Vars > External Config > File Config > Defaults.
 */
function loadEnvConfig(): AIConfig {
  const config: AIConfig = {};

  // First, load from ~/.claude-dev-sprite/config.json (file config)
  const configJsonPath = path.join(os.homedir(), '.claude-dev-sprite', 'config.json');
  if (fs.existsSync(configJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(configJsonPath, 'utf-8'));
      // Load AI configuration using the multi-path strategy.
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

  // Override with external config (from any external module via AIProvider.setConfig)
  // External config has lower priority than environment variables but higher than file config.
  if (AIProvider._externalConfig) {
    const extConfig = AIProvider._externalConfig;
    if (extConfig.apiKey) config.apiKey = extConfig.apiKey;
    if (extConfig.authToken) config.authToken = extConfig.authToken;
    if (extConfig.baseUrl) config.baseUrl = extConfig.baseUrl;
    if (extConfig.model) config.model = extConfig.model;
  }

  // Environment variables override everything (highest priority)
  if (process.env.ANTHROPIC_API_KEY) config.apiKey = process.env.ANTHROPIC_API_KEY;
  if (process.env.ANTHROPIC_AUTH_TOKEN) config.authToken = process.env.ANTHROPIC_AUTH_TOKEN;
  if (process.env.ANTHROPIC_BASE_URL) config.baseUrl = process.env.ANTHROPIC_BASE_URL;
  if (process.env.ANTHROPIC_MODEL) config.model = process.env.ANTHROPIC_MODEL;

  return config;
}

/**
 * AI Provider service class.
 * Handles communication with AI models by providing methods to call the AI backend.
 * This class focuses on the core responsibility of AI interaction.
 * The management of real-time WebSocket connections is delegated to a dedicated handler (e.g., wsHandler.ts).
 * Note: The POST /api/chat/send (SSE) endpoint is deprecated and not used by this class. This legacy endpoint is implemented in teams.ts and is not called by the frontend, which exclusively uses WebSocket for chat communication. For documentation, see FUNCTIONAL-LOGIC-ANALYSIS.md under the 'dead code and route conflicts' section.
 *
 * Git Hook Integration:
 * This AI provider is the core analysis engine invoked after a code commit is detected. The flow is:
 * 1. A Git post-commit hook (generated by `src/detectors/postCommitHook.ts`) triggers on `git commit`.
 * 2. The hook sends a POST request to the `/api/git/hook-notify` endpoint with commit metadata.
 * 3. That endpoint (documented in FUNCTIONAL-LOGIC-ANALYSIS.md under 'API Layer') triggers the code analysis pipeline.
 * 4. The pipeline eventually calls `AIProvider.callAI()` to perform the AI-powered analysis of the committed code changes.
 *
 * Configuration Management (Detailed Priority):
 * AI configuration follows a strict precedence chain where each source overrides the previous one.
 * 1. **Environment Variables (Highest Priority):** `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`. These override all other settings.
 * 2. **External Configuration (Runtime Injection):** Set via `AIProvider.setConfig()`. Allows modules like the frontend settings view or backend configuration managers to update settings dynamically without restarts.
 * 3. **File Configuration (Persistent Settings):** Loaded from `~/.claude-dev-sprite/config.json`. The file is parsed using a multi-path strategy (see `AI_CONFIG_PATHS`) which checks nested locations like `aiProvider`, `analysis.aiProvider`, or `server.aiProvider` in order, using the first valid object found.
 * 4. **Default Values (Lowest Priority):** Fallback values like the default model `claude-sonnet-4-6`.
 */
export class AIProvider {
  private model: string;
  private maxRetries: number;
  private retryDelayMs: number;
  private envConfig: AIConfig;
  private useSDK: boolean;
  private isolated: boolean;

  // Static configuration from external modules (e.g., configuration management, SettingsView)
  static _externalConfig: AIConfig | null = null;

  /**
   * Set external configuration via this static method. This is the primary interface for any external module
   * (e.g., frontend SettingsView, backend configuration management, environment loaders) to inject
   * AI provider configuration. The configuration set here has lower priority than environment variables
   * but higher than file config, supporting dynamic updates at runtime.
   */
  static setConfig(config: AIConfig): void {
    AIProvider._externalConfig = config;
  }

  /**
   * @param agentConfig - When provided, this AIProvider is isolated: it uses only these credentials
   *                      and ignores global env/config. When omitted, falls back to the standard
   *                      loadEnvConfig() priority chain.
   */
  constructor(config?: { model?: string; maxRetries?: number; retryDelayMs?: number; agentConfig?: AIConfig }) {
    // Determine execution mode early: isolated agents use their own config directly
    this.isolated = !!config?.agentConfig;
    this.envConfig = this.isolated ? { ...config!.agentConfig! } : loadEnvConfig();

    // Model priority: explicit constructor config > env config > default
    this.model = config?.model || this.envConfig.model || 'claude-sonnet-4-6';
    this.maxRetries = config?.maxRetries ?? 2;
    this.retryDelayMs = config?.retryDelayMs ?? 2000;

    // Determine execution mode: SDK or CLI
    // Switching logic: Use SDK if API Key or Auth Token is available; otherwise fallback to CLI.
    // Configuration sources: Environment variables (ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN),
    // external config (via setConfig from any module), or config file (~/.claude-dev-sprite/config.json).
    // Priority: Environment variables > External config > File config.
    this.useSDK = !!(this.envConfig.apiKey || this.envConfig.authToken);

    const hasKey = !!this.envConfig.apiKey;
    const hasToken = !!this.envConfig.authToken;
    const hasBase = !!this.envConfig.baseUrl;
    logger.info(`[AIProvider] Mode: ${this.useSDK ? 'SDK' : 'CLI'}, model: ${this.model}, apiKey=${hasKey}, authToken=${hasToken}, baseUrl=${hasBase}${this.isolated ? ' (isolated agent)' : ''}`);
  }

  /**
   * Call AI model - uses SDK directly if API key is available, falls back to CLI
   * Configuration is reloaded on each call to ensure dynamic updates (e.g., from API) take effect immediately.
   */
  async callAI(prompt: string): Promise<{ content: string; model: string; tokensUsed: number }> {
    let lastError: Error | null = null;

    // Reload configuration on each call to support dynamic updates (e.g., via PUT /api/config)
    // Skip reload for isolated agents — they use their own fixed credentials.
    if (!this.isolated) {
      this.envConfig = loadEnvConfig();
      this.useSDK = !!(this.envConfig.apiKey || this.envConfig.authToken);
      // Update model from latest config if not overridden by constructor argument
      if (!this.model || this.model === 'claude-sonnet-4-6') {
        this.model = this.envConfig.model || 'claude-sonnet-4-6';
      }
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