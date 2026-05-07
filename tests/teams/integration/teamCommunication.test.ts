/**
 * Team Communication Integration Tests
 * Tests for GATE-6: Lead → Dev complete communication
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FileProtocol } from '../../../src/teams/fileProtocol';
import { TeamConfigManager } from '../../../src/teams/teamConfig';
import type { Task, TaskResult, TeamName } from '../../../src/teams/types';

describe('Team Communication Integration', () => {
  let fileProtocol: FileProtocol;
  let configManager: TeamConfigManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'team-comm-test-'));
    fileProtocol = new FileProtocol(tempDir);
    configManager = new TeamConfigManager(tempDir);
    await configManager.initialize();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('GATE-6: Lead → Dev Communication', () => {
    it('should complete full task lifecycle', async () => {
      // Step 1: Lead creates task
      const task: Task = {
        id: 'task-gate6-001',
        type: 'development',
        priority: 'high',
        assignedTo: 'dev',
        title: 'Implement health endpoint',
        description: 'Create GET /api/health endpoint that returns {"status":"ok"}',
        acceptanceCriteria: [
          'GET /api/health returns 200',
          'Response body contains {"status":"ok"}',
        ],
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      // Step 2: Write task to dev inbox
      await fileProtocol.writeTask('dev', task);

      // Step 3: Verify task is in inbox
      const tasks = await fileProtocol.readTasks('dev');
      expect(tasks.length).toBe(1);
      expect(tasks[0].id).toBe('task-gate6-001');
      expect(tasks[0].title).toBe('Implement health endpoint');

      // Step 4: Dev executes task and writes result
      const result: TaskResult = {
        taskId: 'task-gate6-001',
        status: 'completed',
        completedAt: new Date().toISOString(),
        model: 'claude-sonnet-4-20250514',
        summary: 'Health endpoint implemented successfully',
        changedFiles: ['src/routes/health.ts'],
      };

      await fileProtocol.writeResult('dev', result);

      // Step 5: Lead reads result
      const results = await fileProtocol.readResults('dev');
      expect(results.length).toBe(1);
      expect(results[0].taskId).toBe('task-gate6-001');
      expect(results[0].status).toBe('completed');
      expect(results[0].changedFiles).toContain('src/routes/health.ts');
    });

    it('should handle multiple tasks in sequence', async () => {
      const tasks: Task[] = [
        {
          id: 'task-gate6-002',
          type: 'development',
          priority: 'high',
          assignedTo: 'dev',
          title: 'Task 1',
          description: 'Description 1',
          acceptanceCriteria: ['Criteria 1'],
          createdAt: new Date().toISOString(),
          status: 'pending',
        },
        {
          id: 'task-gate6-003',
          type: 'development',
          priority: 'medium',
          assignedTo: 'dev',
          title: 'Task 2',
          description: 'Description 2',
          acceptanceCriteria: ['Criteria 2'],
          createdAt: new Date().toISOString(),
          status: 'pending',
        },
      ];

      // Write tasks
      for (const task of tasks) {
        await fileProtocol.writeTask('dev', task);
      }

      // Read tasks
      const readTasks = await fileProtocol.readTasks('dev');
      expect(readTasks.length).toBe(2);

      // Write results
      for (const task of tasks) {
        const result: TaskResult = {
          taskId: task.id,
          status: 'completed',
          completedAt: new Date().toISOString(),
          model: 'claude-sonnet-4-20250514',
          summary: `Completed ${task.title}`,
          changedFiles: [],
        };
        await fileProtocol.writeResult('dev', result);
      }

      // Read results
      const results = await fileProtocol.readResults('dev');
      expect(results.length).toBe(2);
    });
  });

  describe('GATE-7: Parallel Team Execution', () => {
    it('should handle concurrent task writes to different teams', async () => {
      const devTask: Task = {
        id: 'task-gate7-dev',
        type: 'development',
        priority: 'high',
        assignedTo: 'dev',
        title: 'Dev Task',
        description: 'Dev Description',
        acceptanceCriteria: [],
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      const testTask: Task = {
        id: 'task-gate7-test',
        type: 'testing',
        priority: 'high',
        assignedTo: 'test',
        title: 'Test Task',
        description: 'Test Description',
        acceptanceCriteria: [],
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      // Write tasks in parallel
      await Promise.all([
        fileProtocol.writeTask('dev', devTask),
        fileProtocol.writeTask('test', testTask),
      ]);

      // Read tasks from both teams
      const [devTasks, testTasks] = await Promise.all([
        fileProtocol.readTasks('dev'),
        fileProtocol.readTasks('test'),
      ]);

      expect(devTasks.length).toBe(1);
      expect(devTasks[0].id).toBe('task-gate7-dev');
      expect(testTasks.length).toBe(1);
      expect(testTasks[0].id).toBe('task-gate7-test');
    });

    it('should handle concurrent result writes', async () => {
      const devResult: TaskResult = {
        taskId: 'task-gate7-dev',
        status: 'completed',
        completedAt: new Date().toISOString(),
        model: 'claude-sonnet-4-20250514',
        summary: 'Dev completed',
        changedFiles: ['src/dev.ts'],
      };

      const testResult: TaskResult = {
        taskId: 'task-gate7-test',
        status: 'completed',
        completedAt: new Date().toISOString(),
        model: 'claude-sonnet-4-20250514',
        summary: 'Test completed',
        changedFiles: [],
      };

      // Write results in parallel
      await Promise.all([
        fileProtocol.writeResult('dev', devResult),
        fileProtocol.writeResult('test', testResult),
      ]);

      // Read results from both teams
      const [devResults, testResults] = await Promise.all([
        fileProtocol.readResults('dev'),
        fileProtocol.readResults('test'),
      ]);

      expect(devResults.length).toBe(1);
      expect(devResults[0].taskId).toBe('task-gate7-dev');
      expect(testResults.length).toBe(1);
      expect(testResults[0].taskId).toBe('task-gate7-test');
    });
  });

  describe('Error Handling', () => {
    it('should handle failed task result', async () => {
      const task: Task = {
        id: 'task-error-001',
        type: 'development',
        priority: 'high',
        assignedTo: 'dev',
        title: 'Failing Task',
        description: 'This task will fail',
        acceptanceCriteria: [],
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      await fileProtocol.writeTask('dev', task);

      const result: TaskResult = {
        taskId: 'task-error-001',
        status: 'failed',
        completedAt: new Date().toISOString(),
        model: 'claude-sonnet-4-20250514',
        summary: 'Task failed due to timeout',
        changedFiles: [],
        error: 'Process timed out after 600 seconds',
      };

      await fileProtocol.writeResult('dev', result);

      const results = await fileProtocol.readResults('dev');
      expect(results.length).toBe(1);
      expect(results[0].status).toBe('failed');
      expect(results[0].error).toContain('timed out');
    });
  });
});
