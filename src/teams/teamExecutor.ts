/**
 * TeamExecutor - Claude Code CLI Executor
 * Manages Claude CLI subprocess execution with streaming JSON output
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createLogger } from '../utils/logger';
import type { AgentEvent, TeamName, TeamExecutorConfig } from './types';

const logger = createLogger('team-executor');

export class TeamExecutor {
  private process: ChildProcess | null = null;
  private config: TeamExecutorConfig;
  private projectPath: string;
  private teamName: TeamName;
  private aborted = false;

  constructor(teamName: TeamName, config: TeamExecutorConfig, projectPath: string) {
    this.teamName = teamName;
    this.config = config;
    this.projectPath = projectPath;
  }

  /**
   * Execute a task with Claude CLI
   * Yields AgentEvents as they arrive from the stream
   */
  async *execute(prompt: string, context?: string): AsyncIterable<AgentEvent> {
    this.aborted = false;

    const args = this.buildArgs(prompt, context);
    const claudePath = this.resolveClaudeCLI();
    const env = this.buildCleanEnv();

    logger.info(`[${this.teamName}] Spawning: ${claudePath} ${args.slice(0, 5).join(' ')}...`);

    this.process = spawn(claudePath, args, {
      cwd: this.projectPath,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      shell: process.platform === 'win32',
    });

    let buffer = '';
    let stderr = '';

    // Handle stderr
    this.process.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    // Handle process errors
    this.process.on('error', (error) => {
      logger.error(`[${this.teamName}] Process error: ${error.message}`);
    });

    // Set up timeout
    const timeout = this.config.timeout || 600000;
    const timeoutId = setTimeout(() => {
      if (this.process && !this.aborted) {
        logger.warn(`[${this.teamName}] Timeout after ${timeout}ms, killing process`);
        this.abort();
      }
    }, timeout);

    try {
      // Process stdout stream
      for await (const chunk of this.process.stdout!) {
        if (this.aborted) break;

        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop()!; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const event = JSON.parse(line);
            const mapped = this.mapEvent(event);
            if (mapped) {
              yield mapped;
            }
          } catch {
            // Ignore non-JSON lines
            logger.debug(`[${this.teamName}] Non-JSON line: ${line.slice(0, 100)}`);
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim() && !this.aborted) {
        try {
          const event = JSON.parse(buffer);
          const mapped = this.mapEvent(event);
          if (mapped) {
            yield mapped;
          }
        } catch {
          // Ignore
        }
      }

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        this.process!.on('close', (code) => {
          if (code !== 0 && !this.aborted) {
            logger.error(`[${this.teamName}] Process exited with code ${code}\nstderr: ${stderr.slice(0, 500)}`);
          }
          resolve();
        });
      });

      // Yield completion event
      if (!this.aborted) {
        yield {
          type: 'completed',
          team: this.teamName,
          content: '任务执行完成',
        };
      }
    } catch (error: any) {
      logger.error(`[${this.teamName}] Execution error: ${error.message}`);
      yield {
        type: 'error',
        team: this.teamName,
        content: `执行错误: ${error.message}`,
      };
    } finally {
      clearTimeout(timeoutId);
      this.process = null;
    }
  }

  /**
   * Abort the current execution
   */
  abort(): void {
    this.aborted = true;
    if (this.process) {
      logger.info(`[${this.teamName}] Aborting process`);
      this.process.kill('SIGTERM');

      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
          this.process = null;
        }
      }, 5000);
    }
  }

  /**
   * Build CLI arguments
   */
  private buildArgs(prompt: string, context?: string): string[] {
    const args = [
      '--print',
      '--output-format', 'stream-json',
      '--model', this.config.model,
      '--max-turns', String(this.config.maxTurns),
    ];

    if (this.config.allowedTools.length > 0) {
      args.push('--allowedTools', this.config.allowedTools.join(','));
    }

    if (this.config.disallowedTools && this.config.disallowedTools.length > 0) {
      args.push('--disallowedTools', this.config.disallowedTools.join(','));
    }

    // Assemble full prompt with context
    const fullPrompt = context
      ? `## 上下文\n${context}\n\n## 任务\n${prompt}`
      : prompt;
    args.push('-p', fullPrompt);

    return args;
  }

  /**
   * Map Claude CLI event to unified AgentEvent
   */
  private mapEvent(cliEvent: any): AgentEvent | null {
    switch (cliEvent.type) {
      case 'assistant':
        return {
          type: 'agent_message',
          team: this.teamName,
          content: cliEvent.message?.content || '',
          metadata: {
            tokenUsage: cliEvent.usage
              ? { prompt: cliEvent.usage.input_tokens, completion: cliEvent.usage.output_tokens }
              : undefined,
          },
        };

      case 'tool_use':
        return {
          type: 'tool_call',
          team: this.teamName,
          content: `调用工具: ${cliEvent.name}`,
          metadata: {
            toolName: cliEvent.name,
            toolArgs: cliEvent.input,
          },
        };

      case 'tool_result':
        return {
          type: 'tool_result',
          team: this.teamName,
          content: typeof cliEvent.content === 'string'
            ? cliEvent.content.slice(0, 500)
            : JSON.stringify(cliEvent.content).slice(0, 500),
          metadata: {
            toolName: cliEvent.tool_use_id,
          },
        };

      default:
        return null;
    }
  }

  /**
   * Resolve Claude CLI path
   */
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

  /**
   * Build clean environment for Claude CLI subprocess
   */
  private buildCleanEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    const excluded = ['CLAUDECODE', 'CLAUDE_CODE_SESSION'];

    for (const [key, val] of Object.entries(process.env)) {
      if (val !== undefined && !excluded.includes(key)) {
        env[key] = val;
      }
    }

    env.CLAUDE_CODE_ENTRYPOINT = 'sdk-ts';

    return env;
  }
}
