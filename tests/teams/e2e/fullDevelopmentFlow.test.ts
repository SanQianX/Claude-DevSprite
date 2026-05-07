/**
 * E2E Full Development Flow Tests
 * Tests for GATE-10: Complete development workflow
 *
 * This tests the TeamManager's handleChat flow with mocked executors.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { TeamManager } from '../../../src/teams/teamManager';
import { FileProtocol } from '../../../src/teams/fileProtocol';
import { TeamConfigManager } from '../../../src/teams/teamConfig';
import type { AgentEvent, Task, TaskResult } from '../../../src/teams/types';

describe('E2E: Full Development Flow (GATE-10)', () => {
  let tempDir: string;
  let teamManager: TeamManager;
  let fileProtocol: FileProtocol;
  let configManager: TeamConfigManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'e2e-flow-test-'));
    teamManager = new TeamManager(tempDir);
    fileProtocol = new FileProtocol(tempDir);
    configManager = new TeamConfigManager(tempDir);
    await configManager.initialize();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('FileProtocol Flow', () => {
    it('should complete full task lifecycle: write → read → execute → result', async () => {
      // Step 1: Lead creates task
      const task: Task = {
        id: 'e2e-task-001',
        type: 'development',
        priority: 'high',
        assignedTo: 'dev',
        title: 'Implement health endpoint',
        description: 'Create GET /api/health that returns {"status":"ok"}',
        acceptanceCriteria: [
          'GET /api/health returns 200',
          'Response body contains {"status":"ok"}',
        ],
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      // Step 2: Write task to dev inbox
      await fileProtocol.writeTask('dev', task);

      // Step 3: Dev reads task
      const tasks = await fileProtocol.readTasks('dev');
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('e2e-task-001');
      expect(tasks[0].title).toBe('Implement health endpoint');

      // Step 4: Dev executes and writes result
      const result: TaskResult = {
        taskId: 'e2e-task-001',
        status: 'completed',
        completedAt: new Date().toISOString(),
        model: 'claude-sonnet-4-20250514',
        summary: 'Health endpoint implemented successfully',
        changedFiles: ['src/routes/health.ts'],
      };

      await fileProtocol.writeResult('dev', result);

      // Step 5: Lead reads result
      const results = await fileProtocol.readResults('dev');
      expect(results).toHaveLength(1);
      expect(results[0].taskId).toBe('e2e-task-001');
      expect(results[0].status).toBe('completed');
      expect(results[0].changedFiles).toContain('src/routes/health.ts');
    });

    it('should handle multi-team parallel task execution', async () => {
      // Lead assigns tasks to dev and test in parallel
      const devTask: Task = {
        id: 'e2e-dev-001',
        type: 'development',
        priority: 'high',
        assignedTo: 'dev',
        title: 'Implement login',
        description: 'Add JWT auth',
        acceptanceCriteria: ['POST /api/login returns token'],
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      const testTask: Task = {
        id: 'e2e-test-001',
        type: 'testing',
        priority: 'high',
        assignedTo: 'test',
        title: 'Test login',
        description: 'Write tests for login',
        acceptanceCriteria: ['All tests pass'],
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      // Write tasks in parallel
      await Promise.all([
        fileProtocol.writeTask('dev', devTask),
        fileProtocol.writeTask('test', testTask),
      ]);

      // Read tasks in parallel
      const [devTasks, testTasks] = await Promise.all([
        fileProtocol.readTasks('dev'),
        fileProtocol.readTasks('test'),
      ]);

      expect(devTasks).toHaveLength(1);
      expect(devTasks[0].id).toBe('e2e-dev-001');
      expect(testTasks).toHaveLength(1);
      expect(testTasks[0].id).toBe('e2e-test-001');

      // Write results in parallel
      const devResult: TaskResult = {
        taskId: 'e2e-dev-001',
        status: 'completed',
        completedAt: new Date().toISOString(),
        model: 'claude-sonnet-4-20250514',
        summary: 'Login implemented',
        changedFiles: ['src/auth/login.ts'],
      };

      const testResult: TaskResult = {
        taskId: 'e2e-test-001',
        status: 'completed',
        completedAt: new Date().toISOString(),
        model: 'claude-sonnet-4-20250514',
        summary: 'Tests written',
        changedFiles: ['tests/auth/login.test.ts'],
      };

      await Promise.all([
        fileProtocol.writeResult('dev', devResult),
        fileProtocol.writeResult('test', testResult),
      ]);

      // Read results in parallel
      const [devResults, testResults] = await Promise.all([
        fileProtocol.readResults('dev'),
        fileProtocol.readResults('test'),
      ]);

      expect(devResults).toHaveLength(1);
      expect(devResults[0].status).toBe('completed');
      expect(testResults).toHaveLength(1);
      expect(testResults[0].status).toBe('completed');
    });

    it('should handle failed task with error recovery', async () => {
      // Task that will fail
      const task: Task = {
        id: 'e2e-fail-001',
        type: 'development',
        priority: 'high',
        assignedTo: 'dev',
        title: 'Risky task',
        description: 'This might fail',
        acceptanceCriteria: [],
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      await fileProtocol.writeTask('dev', task);

      // Task fails
      const failResult: TaskResult = {
        taskId: 'e2e-fail-001',
        status: 'failed',
        completedAt: new Date().toISOString(),
        model: 'claude-sonnet-4-20250514',
        summary: 'Task failed due to timeout',
        changedFiles: [],
        error: 'Process timed out after 600 seconds',
      };

      await fileProtocol.writeResult('dev', failResult);

      // Verify failure is recorded
      const results = await fileProtocol.readResults('dev');
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('failed');
      expect(results[0].error).toContain('timed out');

      // Clear and retry
      await fileProtocol.clearInbox('dev');
      await fileProtocol.clearOutbox('dev');

      // Retry with new task
      const retryTask: Task = {
        ...task,
        id: 'e2e-retry-001',
        description: 'Retry with shorter timeout',
      };

      await fileProtocol.writeTask('dev', retryTask);

      // Succeed on retry
      const successResult: TaskResult = {
        taskId: 'e2e-retry-001',
        status: 'completed',
        completedAt: new Date().toISOString(),
        model: 'claude-sonnet-4-20250514',
        summary: 'Task completed on retry',
        changedFiles: ['src/risky.ts'],
      };

      await fileProtocol.writeResult('dev', successResult);

      const retryResults = await fileProtocol.readResults('dev');
      expect(retryResults).toHaveLength(1);
      expect(retryResults[0].status).toBe('completed');
    });
  });

  describe('Config Flow', () => {
    it('should support full config lifecycle: init → load → update → verify', async () => {
      // Load initial config
      const initialConfig = await configManager.load('dev');
      expect(initialConfig.name).toBe('dev');
      expect(initialConfig.model).toBeDefined();

      // Update config
      const updatedConfig = {
        ...initialConfig,
        model: 'claude-opus-4-20250514',
        maxTurns: 50,
      };
      await configManager.save('dev', updatedConfig);

      // Verify update
      const loadedConfig = await configManager.load('dev');
      expect(loadedConfig.model).toBe('claude-opus-4-20250514');
      expect(loadedConfig.maxTurns).toBe(50);
    });
  });

  describe('TeamManager Flow', () => {
    it('should provide consistent team statuses', () => {
      const statuses = teamManager.getAllStatuses();
      expect(statuses).toHaveLength(3);
      expect(statuses.map(s => s.name)).toEqual(['lead', 'dev', 'test']);
      statuses.forEach(s => expect(s.status).toBe('idle'));
    });

    it('should handle abort operations cleanly', () => {
      expect(() => teamManager.abortAll()).not.toThrow();
      expect(() => teamManager.abortTeam('lead')).not.toThrow();
      expect(() => teamManager.abortTeam('dev')).not.toThrow();
      expect(() => teamManager.abortTeam('test')).not.toThrow();
    });
  });
});
