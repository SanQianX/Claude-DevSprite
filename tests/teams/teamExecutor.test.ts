/**
 * TeamExecutor Unit Tests
 * Tests for CLI-based subprocess execution
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import type { TeamExecutorConfig } from '../../src/teams/types';

// Create mock process
let mockProc: any;
const spawnMock = vi.fn(() => mockProc);

vi.mock('child_process', () => ({
  spawn: (...args: any[]) => spawnMock(...args),
}));

const { TeamExecutor } = await import('../../src/teams/teamExecutor');

function createMockProcess() {
  const proc = new EventEmitter() as any;
  const stdout = new EventEmitter() as any;
  // Make stdout async iterable
  const chunks: Buffer[] = [];
  let resolveIterator: (() => void) | null = null;
  let iteratorDone = false;

  stdout[Symbol.asyncIterator] = function () {
    return {
      next() {
        if (chunks.length > 0) {
          return Promise.resolve({ value: chunks.shift(), done: false });
        }
        if (iteratorDone) {
          return Promise.resolve({ value: undefined, done: true });
        }
        return new Promise(resolve => {
          resolveIterator = () => {
            if (chunks.length > 0) {
              resolve({ value: chunks.shift(), done: false });
            } else {
              resolve({ value: undefined, done: true });
            }
          };
        });
      },
      return() {
        iteratorDone = true;
        return Promise.resolve({ value: undefined, done: true });
      },
    };
  };

  // Override emit to also push to chunks array
  const origEmit = stdout.emit.bind(stdout);
  stdout.emit = function (event: string, ...args: any[]) {
    if (event === 'data' && args[0] instanceof Buffer) {
      chunks.push(args[0]);
      if (resolveIterator) {
        const r = resolveIterator;
        resolveIterator = null;
        r();
      }
      return true;
    }
    return origEmit(event, ...args);
  };

  stdout.close = () => {
    iteratorDone = true;
    if (resolveIterator) {
      const r = resolveIterator;
      resolveIterator = null;
      r();
    }
  };

  proc.stdout = stdout;
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();
  proc.pid = 12345;
  proc.killed = false;
  return proc;
}

describe('TeamExecutor', () => {
  let config: TeamExecutorConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProc = createMockProcess();
    spawnMock.mockReturnValue(mockProc);

    config = {
      model: 'sonnet',
      maxTurns: 10,
      timeout: 600000,
    };
  });

  describe('Constructor', () => {
    it('should store team name', () => {
      const executor = new TeamExecutor('lead', config, '/test');
      expect((executor as any).teamName).toBe('lead');
    });

    it('should store config', () => {
      const executor = new TeamExecutor('dev', config, '/test');
      expect((executor as any).config).toBe(config);
    });

    it('should store project path', () => {
      const executor = new TeamExecutor('test', config, '/my/path');
      expect((executor as any).projectPath).toBe('/my/path');
    });

    it('should support all team names', () => {
      for (const team of ['lead', 'dev', 'test'] as const) {
        const executor = new TeamExecutor(team, config, '/test');
        expect(executor).toBeDefined();
      }
    });

    it('should have execute method', () => {
      const executor = new TeamExecutor('test', config, '/test');
      expect(typeof executor.execute).toBe('function');
    });

    it('should have abort method', () => {
      const executor = new TeamExecutor('test', config, '/test');
      expect(typeof executor.abort).toBe('function');
    });
  });

  describe('CLI Process Startup', () => {
    it('should spawn claude CLI with correct arguments', async () => {
      const executor = new TeamExecutor('dev', config, '/test/project');

      const gen = executor.execute('test prompt');
      const iter = gen[Symbol.asyncIterator]();
      const pending = iter.next();

      await new Promise(r => setTimeout(r, 20));

      expect(spawnMock).toHaveBeenCalled();
      const [cmd, args, options] = spawnMock.mock.calls[0];

      // On Windows, spawns 'node' with CLI script; on other platforms, spawns 'claude'
      const isWin = process.platform === 'win32';
      expect(cmd).toBe(isWin ? 'node' : 'claude');
      expect(args).toContain('-p');
      expect(args).toContain('test prompt');
      expect(args).toContain('--output-format');
      expect(args).toContain('stream-json');
      expect(args).toContain('--verbose');
      expect(args).toContain('--model');
      expect(args).toContain('sonnet');
      expect(args).toContain('--dangerously-skip-permissions');
      expect(options.cwd).toBe('/test/project');

      // Clean up
      mockProc.stdout.close();
      mockProc.emit('close', 0);
      await pending;
    });

    it('should include context in prompt when provided', async () => {
      const executor = new TeamExecutor('dev', config, '/test/project');

      const gen = executor.execute('task prompt', 'some context');
      const iter = gen[Symbol.asyncIterator]();
      const pending = iter.next();

      await new Promise(r => setTimeout(r, 20));

      const [, args] = spawnMock.mock.calls[0];
      const promptIdx = args.indexOf('-p');
      expect(promptIdx).toBeGreaterThan(-1);
      expect(args[promptIdx + 1]).toContain('some context');
      expect(args[promptIdx + 1]).toContain('task prompt');

      mockProc.stdout.close();
      mockProc.emit('close', 0);
      await pending;
    });

    it('should set cwd to projectPath', async () => {
      const executor = new TeamExecutor('dev', config, '/my/project');

      const gen = executor.execute('test');
      const iter = gen[Symbol.asyncIterator]();
      const pending = iter.next();

      await new Promise(r => setTimeout(r, 20));

      const [, , options] = spawnMock.mock.calls[0];
      expect(options.cwd).toBe('/my/project');

      mockProc.stdout.close();
      mockProc.emit('close', 0);
      await pending;
    });
  });

  describe('Stream Parsing', () => {
    it('should yield agent_message for text content', async () => {
      const executor = new TeamExecutor('dev', config, '/test');

      const gen = executor.execute('test');
      const iter = gen[Symbol.asyncIterator]();
      const pending = iter.next();

      await new Promise(r => setTimeout(r, 20));

      // Simulate CLI output
      mockProc.stdout.emit('data', Buffer.from(
        JSON.stringify({
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'Hello World' }],
          },
        }) + '\n'
      ));

      const result = await pending;

      expect(result.value).toEqual({
        type: 'agent_message',
        team: 'dev',
        content: 'Hello World',
      });

      mockProc.stdout.close();
      mockProc.emit('close', 0);
    });

    it('should yield tool_call for tool_use content', async () => {
      const executor = new TeamExecutor('dev', config, '/test');

      const gen = executor.execute('test');
      const iter = gen[Symbol.asyncIterator]();
      const pending = iter.next();

      await new Promise(r => setTimeout(r, 20));

      mockProc.stdout.emit('data', Buffer.from(
        JSON.stringify({
          type: 'assistant',
          message: {
            content: [{
              type: 'tool_use',
              id: 'call_123',
              name: 'Read',
              input: { file_path: '/test/file.ts' },
            }],
          },
        }) + '\n'
      ));

      const result = await pending;

      expect(result.value.type).toBe('tool_call');
      expect(result.value.metadata.toolName).toBe('Read');

      mockProc.stdout.close();
      mockProc.emit('close', 0);
    });

    it('should handle multiple content blocks', async () => {
      const executor = new TeamExecutor('dev', config, '/test');

      const gen = executor.execute('test');
      const iter = gen[Symbol.asyncIterator]();

      await new Promise(r => setTimeout(r, 20));

      // Send first message with text
      mockProc.stdout.emit('data', Buffer.from(
        JSON.stringify({
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'Let me read the file' }],
          },
        }) + '\n'
      ));

      const first = await iter.next();
      expect(first.value.type).toBe('agent_message');
      expect(first.value.content).toBe('Let me read the file');

      // Send second message with tool_use
      mockProc.stdout.emit('data', Buffer.from(
        JSON.stringify({
          type: 'assistant',
          message: {
            content: [{
              type: 'tool_use', id: 'call_1', name: 'Read', input: {},
            }],
          },
        }) + '\n'
      ));

      const second = await iter.next();
      expect(second.value.type).toBe('tool_call');

      // Send third message with result text
      mockProc.stdout.emit('data', Buffer.from(
        JSON.stringify({
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'The file contains...' }],
          },
        }) + '\n'
      ));

      const third = await iter.next();
      expect(third.value.type).toBe('agent_message');
      expect(third.value.content).toBe('The file contains...');

      mockProc.stdout.close();
      mockProc.emit('close', 0);
    });
  });

  describe('Abort', () => {
    it('should kill process on abort', async () => {
      const executor = new TeamExecutor('dev', config, '/test');

      const gen = executor.execute('test');
      const iter = gen[Symbol.asyncIterator]();
      iter.next();

      await new Promise(r => setTimeout(r, 20));

      executor.abort();
      expect(mockProc.kill).toHaveBeenCalled();
      expect((executor as any).aborted).toBe(true);

      mockProc.stdout.close();
      mockProc.emit('close', null);
    });
  });

  describe('Error Handling', () => {
    it('should handle spawn errors', async () => {
      const executor = new TeamExecutor('dev', config, '/test');

      const gen = executor.execute('test');
      const iter = gen[Symbol.asyncIterator]();
      const pending = iter.next();

      await new Promise(r => setTimeout(r, 20));

      mockProc.emit('error', new Error('spawn failed'));
      mockProc.stdout.close();

      const result = await pending;
      expect(result.value.type).toBe('error');
    });
  });
});
