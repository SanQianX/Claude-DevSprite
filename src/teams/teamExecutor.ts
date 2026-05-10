/**
 * TeamExecutor - Claude CLI Executor
 * Spawns local Claude Code CLI subprocess for tool-capable execution
 * Handles file operations, command execution, web search via CLI's built-in tools
 */

import { spawn, type ChildProcess } from 'child_process';
import { createLogger } from '../utils/logger';
import type { AgentEvent, TeamName, TeamExecutorConfig } from './types';

const logger = createLogger('team-executor');

// Timeout for CLI execution (5 minutes)
const CLI_TIMEOUT_MS = 5 * 60 * 1000;

export class TeamExecutor {
  private config: TeamExecutorConfig;
  private projectPath: string;
  private teamName: TeamName;
  private aborted = false;
  private currentProcess: ChildProcess | null = null;

  constructor(teamName: TeamName, config: TeamExecutorConfig, projectPath: string) {
    this.teamName = teamName;
    this.config = config;
    this.projectPath = projectPath;
  }

  /**
   * Execute a task via Claude CLI subprocess
   * CLI handles the full agentic loop: tool calls, file ops, commands, etc.
   * Yields AgentEvents as they arrive from the stream-json output
   */
  async *execute(prompt: string, context?: string): AsyncIterable<AgentEvent> {
    this.aborted = false;

    const fullPrompt = context
      ? `## Context\n${context}\n\n## Task\n${prompt}`
      : prompt;

    // Build CLI arguments
    // --print: non-interactive mode
    // --output-format stream-json: structured JSON output per line
    // --verbose: include tool use details
    // --model sonnet: maps to mimo-v2.5 via ANTHROPIC_DEFAULT_SONNET_MODEL env var
    // --dangerously-skip-permissions: auto-approve tool calls (local tool, no security risk)
    const args = [
      '-p', fullPrompt,
      '--output-format', 'stream-json',
      '--verbose',
      '--model', this.config.model || 'sonnet',
      '--dangerously-skip-permissions',
      '--setting-sources', '',
    ];

    logger.info(`[${this.teamName}] Spawning claude CLI with model: ${this.config.model || 'sonnet'}`);
    logger.info(`[${this.teamName}] CWD: ${this.projectPath}`);

    // Set up clean environment with mimo API config
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || '',
      ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
      ANTHROPIC_DEFAULT_SONNET_MODEL: process.env.ANTHROPIC_DEFAULT_SONNET_MODEL || 'mimo-v2.5',
      // Remove Claude Code specific env vars that might interfere
      CLAUDECODE: '',
      CLAUDE_CODE_SESSION: '',
    };

    const isWin = process.platform === 'win32';
    // On Windows, spawn node directly with CLI script to avoid shell hanging issues
    // The claude shim is at: %APPDATA%/npm/node_modules/@anthropic-ai/claude-code/cli.js
    let spawnCmd: string;
    let spawnArgs: string[];
    if (isWin) {
      const appData = process.env.APPDATA || `${process.env.USERPROFILE}\\AppData\\Roaming`;
      const cliScript = `${appData}\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js`;
      spawnCmd = 'node';
      spawnArgs = [cliScript, ...args];
    } else {
      spawnCmd = 'claude';
      spawnArgs = args;
    }
    const child = spawn(spawnCmd, spawnArgs, {
      cwd: this.projectPath,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    this.currentProcess = child;

    let stdoutBuffer = '';
    let resolved = false;
    let processError: Error | null = null;

    // Handle process-level errors (spawn failures, etc.)
    child.on('error', (err) => {
      processError = err;
      resolved = true;
      logger.error(`[${this.teamName}] Process error: ${err.message}`);
    });

    // Set up timeout
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        logger.warn(`[${this.teamName}] CLI timeout after ${CLI_TIMEOUT_MS}ms`);
        this.killProcess(child);
      }
    }, CLI_TIMEOUT_MS);

    try {
      // Parse stdout line by line (each line is a JSON object)
      for await (const chunk of child.stdout!) {
        if (this.aborted || resolved) break;

        stdoutBuffer += chunk.toString();
        const lines = stdoutBuffer.split('\n');
        // Keep the last incomplete line in buffer
        stdoutBuffer = lines.pop() || '';

        for (const line of lines) {
          if (this.aborted || resolved) break;

          const trimmed = line.trim();
          if (!trimmed) continue;

          let event: any;
          try {
            event = JSON.parse(trimmed);
          } catch {
            // Not JSON, skip (might be stderr mixed in)
            continue;
          }

          // Process assistant messages (text and tool_use)
          if (event.type === 'assistant' && event.message?.content) {
            for (const block of event.message.content) {
              if (this.aborted) break;

              if (block.type === 'text' && block.text) {
                logger.info(`[${this.teamName}] Text: ${block.text.slice(0, 100)}...`);
                yield {
                  type: 'agent_message',
                  team: this.teamName,
                  content: block.text,
                };
              } else if (block.type === 'tool_use') {
                logger.info(`[${this.teamName}] Tool call: ${block.name}`);
                yield {
                  type: 'tool_call',
                  team: this.teamName,
                  content: `Calling ${block.name}...`,
                  metadata: {
                    toolName: block.name,
                    toolArgs: block.input,
                  },
                };
              }
            }
          }

          // Process tool results
          if (event.type === 'tool_result') {
            logger.info(`[${this.teamName}] Tool result received`);
            yield {
              type: 'tool_result',
              team: this.teamName,
              content: event.content || '',
            };
          }

          // Process result (final)
          if (event.type === 'result') {
            resolved = true;
            logger.info(`[${this.teamName}] CLI completed in ${event.duration_ms}ms, cost: $${event.total_cost_usd}`);
            // Result text is already yielded via assistant message blocks above
            // No need to yield again - just mark as resolved
          }
        }
      }

      // Process any remaining buffer
      if (!resolved && stdoutBuffer.trim()) {
        try {
          const event = JSON.parse(stdoutBuffer.trim());
          if (event.type === 'assistant' && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === 'text' && block.text) {
                yield {
                  type: 'agent_message',
                  team: this.teamName,
                  content: block.text,
                };
              }
            }
          }
        } catch {
          // Ignore parse errors for remaining buffer
        }
      }
    } catch (error: any) {
      if (!this.aborted) {
        logger.error(`[${this.teamName}] CLI error: ${error.message}`);
        yield {
          type: 'error',
          team: this.teamName,
          content: `CLI error: ${error.message}`,
        };
      }
    }

    // Check for process-level errors that occurred outside the for await loop
    if (processError && !this.aborted) {
      yield {
        type: 'error',
        team: this.teamName,
        content: `CLI error: ${processError.message}`,
      };
    }

    // Cleanup
    clearTimeout(timeout);
    this.killProcess(child);
    this.currentProcess = null;
  }

  /**
   * Kill the CLI process
   */
  private killProcess(child: ChildProcess): void {
    try {
      if (child && !child.killed) {
        child.kill('SIGTERM');
        // Force kill after 3 seconds if still alive
        setTimeout(() => {
          if (child && !child.killed) {
            child.kill('SIGKILL');
          }
        }, 3000);
      }
    } catch (e) {
      // Ignore kill errors
    }
  }

  /**
   * Abort the current execution
   */
  abort(): void {
    this.aborted = true;
    if (this.currentProcess) {
      this.killProcess(this.currentProcess);
    }
    logger.info(`[${this.teamName}] Aborted`);
  }
}
