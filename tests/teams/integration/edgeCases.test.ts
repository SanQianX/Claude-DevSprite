/**
 * Edge Cases Integration Tests
 * Tests for GATE-11: Boundary condition handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FileProtocol } from '../../../src/teams/fileProtocol';
import { TeamConfigManager } from '../../../src/teams/teamConfig';
import { TeamManager } from '../../../src/teams/teamManager';
import type { Task, TaskResult } from '../../../src/teams/types';

describe('Edge Cases (GATE-11)', () => {
  let tempDir: string;
  let fileProtocol: FileProtocol;
  let configManager: TeamConfigManager;
  let teamManager: TeamManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'edge-case-test-'));
    fileProtocol = new FileProtocol(tempDir);
    configManager = new TeamConfigManager(tempDir);
    teamManager = new TeamManager(tempDir);
    await configManager.initialize();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Empty State Handling', () => {
    it('should return empty array for empty inbox', async () => {
      const tasks = await fileProtocol.readTasks('dev');
      expect(tasks).toEqual([]);
    });

    it('should return empty array for empty outbox', async () => {
      const results = await fileProtocol.readResults('dev');
      expect(results).toEqual([]);
    });

    it('should handle clearInbox on empty inbox', async () => {
      await fileProtocol.clearInbox('dev');
      const tasks = await fileProtocol.readTasks('dev');
      expect(tasks).toEqual([]);
    });

    it('should handle clearOutbox on empty outbox', async () => {
      await fileProtocol.clearOutbox('dev');
      const results = await fileProtocol.readResults('dev');
      expect(results).toEqual([]);
    });
  });

  describe('Task Field Edge Cases', () => {
    it('should handle task with empty acceptanceCriteria', async () => {
      const task: Task = {
        id: 'edge-001',
        type: 'development',
        priority: 'low',
        assignedTo: 'dev',
        title: 'Simple task',
        description: 'No criteria',
        acceptanceCriteria: [],
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      await fileProtocol.writeTask('dev', task);
      const tasks = await fileProtocol.readTasks('dev');
      expect(tasks[0].acceptanceCriteria).toEqual([]);
    });

    it('should handle task with special characters in description', async () => {
      const task: Task = {
        id: 'edge-002',
        type: 'development',
        priority: 'high',
        assignedTo: 'dev',
        title: '特殊字符测试 "quotes" & <tags>',
        description: 'Description with\nnewlines\tand\ttabs',
        acceptanceCriteria: ['包含中文', 'Contains English'],
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      await fileProtocol.writeTask('dev', task);
      const tasks = await fileProtocol.readTasks('dev');
      expect(tasks[0].title).toContain('"quotes"');
      expect(tasks[0].description).toContain('newlines');
    });

    it('should handle task with very long description', async () => {
      const longDesc = 'A'.repeat(10000);
      const task: Task = {
        id: 'edge-003',
        type: 'development',
        priority: 'medium',
        assignedTo: 'dev',
        title: 'Long description task',
        description: longDesc,
        acceptanceCriteria: [],
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      await fileProtocol.writeTask('dev', task);
      const tasks = await fileProtocol.readTasks('dev');
      expect(tasks[0].description.length).toBe(10000);
    });

    it('should handle task with context field', async () => {
      const task: Task = {
        id: 'edge-004',
        type: 'development',
        priority: 'high',
        assignedTo: 'dev',
        title: 'Task with context',
        description: 'Do something',
        acceptanceCriteria: [],
        createdAt: new Date().toISOString(),
        status: 'pending',
        context: 'Additional context information here',
      };

      await fileProtocol.writeTask('dev', task);
      const tasks = await fileProtocol.readTasks('dev');
      expect(tasks[0].context).toBe('Additional context information here');
    });
  });

  describe('Result Field Edge Cases', () => {
    it('should handle result with empty changedFiles', async () => {
      const result: TaskResult = {
        taskId: 'edge-r-001',
        status: 'completed',
        completedAt: new Date().toISOString(),
        model: 'claude-sonnet-4-20250514',
        summary: 'No files changed',
        changedFiles: [],
      };

      await fileProtocol.writeResult('dev', result);
      const results = await fileProtocol.readResults('dev');
      expect(results[0].changedFiles).toEqual([]);
    });

    it('should handle result with error field', async () => {
      const result: TaskResult = {
        taskId: 'edge-r-002',
        status: 'failed',
        completedAt: new Date().toISOString(),
        model: 'claude-sonnet-4-20250514',
        summary: 'Task failed',
        changedFiles: [],
        error: 'Process crashed with exit code 1',
      };

      await fileProtocol.writeResult('dev', result);
      const results = await fileProtocol.readResults('dev');
      expect(results[0].status).toBe('failed');
      expect(results[0].error).toContain('exit code 1');
    });

    it('should handle result with many changed files', async () => {
      const changedFiles = Array.from({ length: 50 }, (_, i) => `src/file-${i}.ts`);
      const result: TaskResult = {
        taskId: 'edge-r-003',
        status: 'completed',
        completedAt: new Date().toISOString(),
        model: 'claude-sonnet-4-20250514',
        summary: 'Many files changed',
        changedFiles,
      };

      await fileProtocol.writeResult('dev', result);
      const results = await fileProtocol.readResults('dev');
      expect(results[0].changedFiles).toHaveLength(50);
    });
  });

  describe('Multiple Teams Isolation', () => {
    it('should not mix tasks between teams', async () => {
      const devTask: Task = {
        id: 'isol-dev',
        type: 'development',
        priority: 'high',
        assignedTo: 'dev',
        title: 'Dev Task',
        description: 'For dev only',
        acceptanceCriteria: [],
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      const testTask: Task = {
        id: 'isol-test',
        type: 'testing',
        priority: 'high',
        assignedTo: 'test',
        title: 'Test Task',
        description: 'For test only',
        acceptanceCriteria: [],
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      await fileProtocol.writeTask('dev', devTask);
      await fileProtocol.writeTask('test', testTask);

      const devTasks = await fileProtocol.readTasks('dev');
      const testTasks = await fileProtocol.readTasks('test');

      expect(devTasks).toHaveLength(1);
      expect(devTasks[0].id).toBe('isol-dev');
      expect(testTasks).toHaveLength(1);
      expect(testTasks[0].id).toBe('isol-test');
    });

    it('should not mix results between teams', async () => {
      const devResult: TaskResult = {
        taskId: 'r-dev',
        status: 'completed',
        completedAt: new Date().toISOString(),
        model: 'test',
        summary: 'Dev result',
        changedFiles: ['dev.ts'],
      };

      const testResult: TaskResult = {
        taskId: 'r-test',
        status: 'completed',
        completedAt: new Date().toISOString(),
        model: 'test',
        summary: 'Test result',
        changedFiles: [],
      };

      await fileProtocol.writeResult('dev', devResult);
      await fileProtocol.writeResult('test', testResult);

      const devResults = await fileProtocol.readResults('dev');
      const testResults = await fileProtocol.readResults('test');

      expect(devResults).toHaveLength(1);
      expect(devResults[0].taskId).toBe('r-dev');
      expect(testResults).toHaveLength(1);
      expect(testResults[0].taskId).toBe('r-test');
    });
  });

  describe('Config Edge Cases', () => {
    it('should handle loading config after save with extra fields', async () => {
      const config = await configManager.load('dev');
      const extended = { ...config, customField: 'custom-value' };
      await configManager.save('dev', extended);

      const loaded = await configManager.load('dev');
      expect(loaded.name).toBe('dev');
      expect(loaded.model).toBeDefined();
    });

    it('should preserve config across save/load cycles', async () => {
      const original = await configManager.load('dev');
      await configManager.save('dev', original);
      const loaded = await configManager.load('dev');

      expect(loaded.name).toBe(original.name);
      expect(loaded.model).toBe(original.model);
      expect(loaded.maxTurns).toBe(original.maxTurns);
      expect(loaded.allowedTools).toEqual(original.allowedTools);
    });
  });

  describe('TeamManager Edge Cases', () => {
    it('should handle abort for all teams without error', () => {
      expect(() => teamManager.abortAll()).not.toThrow();
    });

    it('should handle abort for individual teams without error', () => {
      expect(() => teamManager.abortTeam('lead')).not.toThrow();
      expect(() => teamManager.abortTeam('dev')).not.toThrow();
      expect(() => teamManager.abortTeam('test')).not.toThrow();
    });

    it('should return consistent status objects', () => {
      const status1 = teamManager.getTeamStatus('dev');
      const status2 = teamManager.getTeamStatus('dev');
      expect(status1.status).toBe(status2.status);
      expect(status1.name).toBe(status2.name);
    });
  });
});
