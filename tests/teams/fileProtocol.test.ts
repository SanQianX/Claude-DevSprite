/**
 * FileProtocol Unit Tests
 * Tests for file-based communication protocol
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FileProtocol } from '../../src/teams/fileProtocol';
import type { Task, TaskResult, TeamName } from '../../src/teams/types';

describe('FileProtocol', () => {
  let fileProtocol: FileProtocol;
  let tempDir: string;

  beforeEach(async () => {
    // Create temp directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-protocol-test-'));
    fileProtocol = new FileProtocol(tempDir);

    // Create directory structure
    await fs.mkdir(path.join(tempDir, '.Claude-DevSprite', 'teams', 'dev', 'inbox'), { recursive: true });
    await fs.mkdir(path.join(tempDir, '.Claude-DevSprite', 'teams', 'dev', 'outbox'), { recursive: true });
    await fs.mkdir(path.join(tempDir, '.Claude-DevSprite', 'teams', 'test', 'inbox'), { recursive: true });
    await fs.mkdir(path.join(tempDir, '.Claude-DevSprite', 'teams', 'test', 'outbox'), { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('writeTask()', () => {
    it('should write task to team inbox', async () => {
      const task: Task = {
        id: 'task-001',
        type: 'development',
        priority: 'high',
        assignedTo: 'dev',
        title: 'Implement login feature',
        description: 'Add JWT authentication to the application',
        acceptanceCriteria: ['POST /api/login returns token', 'Invalid credentials return 401'],
        createdAt: '2026-05-03T00:00:00Z',
        status: 'pending',
      };

      await fileProtocol.writeTask('dev', task);

      // Verify file exists
      const filePath = path.join(tempDir, '.Claude-DevSprite', 'teams', 'dev', 'inbox', 'task-001.md');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('taskId: "task-001"');
      expect(content).toContain('Implement login feature');
      expect(content).toContain('JWT authentication');
    });

    it('should write task with context', async () => {
      const task: Task = {
        id: 'task-002',
        type: 'testing',
        priority: 'medium',
        assignedTo: 'test',
        title: 'Write tests for login',
        description: 'Create unit tests for login functionality',
        acceptanceCriteria: ['All tests pass', 'Coverage > 80%'],
        createdAt: '2026-05-03T00:00:00Z',
        status: 'pending',
        context: 'The login feature was implemented in src/auth/login.ts',
      };

      await fileProtocol.writeTask('test', task);

      const filePath = path.join(tempDir, '.Claude-DevSprite', 'teams', 'test', 'inbox', 'task-002.md');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('The login feature was implemented');
    });
  });

  describe('readTasks()', () => {
    it('should read tasks from team inbox', async () => {
      // Write a task first
      const task: Task = {
        id: 'task-003',
        type: 'development',
        priority: 'low',
        assignedTo: 'dev',
        title: 'Update documentation',
        description: 'Update README with new features',
        acceptanceCriteria: ['README updated'],
        createdAt: '2026-05-03T00:00:00Z',
        status: 'pending',
      };

      await fileProtocol.writeTask('dev', task);

      // Read tasks
      const tasks = await fileProtocol.readTasks('dev');

      expect(tasks.length).toBeGreaterThan(0);
      const foundTask = tasks.find(t => t.id === 'task-003');
      expect(foundTask).toBeDefined();
      expect(foundTask?.title).toBe('Update documentation');
    });

    it('should return empty array for empty inbox', async () => {
      const tasks = await fileProtocol.readTasks('dev');
      expect(tasks).toEqual([]);
    });
  });

  describe('writeResult()', () => {
    it('should write result to team outbox', async () => {
      const result: TaskResult = {
        taskId: 'task-001',
        status: 'completed',
        completedAt: '2026-05-03T01:00:00Z',
        model: 'claude-sonnet-4-20250514',
        summary: 'Login feature implemented successfully',
        changedFiles: ['src/auth/login.ts', 'src/auth/middleware.ts'],
      };

      await fileProtocol.writeResult('dev', result);

      const filePath = path.join(tempDir, '.Claude-DevSprite', 'teams', 'dev', 'outbox', 'task-001-result.md');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('completed');
      expect(content).toContain('Login feature implemented');
      expect(content).toContain('src/auth/login.ts');
    });

    it('should write failed result with error', async () => {
      const result: TaskResult = {
        taskId: 'task-002',
        status: 'failed',
        completedAt: '2026-05-03T01:00:00Z',
        model: 'claude-sonnet-4-20250514',
        summary: 'Task failed due to timeout',
        changedFiles: [],
        error: 'Process timed out after 600 seconds',
      };

      await fileProtocol.writeResult('test', result);

      const filePath = path.join(tempDir, '.Claude-DevSprite', 'teams', 'test', 'outbox', 'task-002-result.md');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('failed');
      expect(content).toContain('Process timed out');
    });
  });

  describe('readResults()', () => {
    it('should read results from team outbox', async () => {
      // Write a result first
      const result: TaskResult = {
        taskId: 'task-004',
        status: 'completed',
        completedAt: '2026-05-03T02:00:00Z',
        model: 'claude-sonnet-4-20250514',
        summary: 'Documentation updated',
        changedFiles: ['README.md'],
      };

      await fileProtocol.writeResult('dev', result);

      // Read results
      const results = await fileProtocol.readResults('dev');

      expect(results.length).toBeGreaterThan(0);
      const foundResult = results.find(r => r.taskId === 'task-004');
      expect(foundResult).toBeDefined();
      expect(foundResult?.status).toBe('completed');
    });

    it('should return empty array for empty outbox', async () => {
      const results = await fileProtocol.readResults('dev');
      expect(results).toEqual([]);
    });
  });

  describe('clearInbox()', () => {
    it('should clear all tasks from inbox', async () => {
      // Write some tasks
      const task1: Task = {
        id: 'task-005',
        type: 'development',
        priority: 'high',
        assignedTo: 'dev',
        title: 'Task 1',
        description: 'Description 1',
        acceptanceCriteria: [],
        createdAt: '2026-05-03T00:00:00Z',
        status: 'pending',
      };

      const task2: Task = {
        id: 'task-006',
        type: 'development',
        priority: 'medium',
        assignedTo: 'dev',
        title: 'Task 2',
        description: 'Description 2',
        acceptanceCriteria: [],
        createdAt: '2026-05-03T00:00:00Z',
        status: 'pending',
      };

      await fileProtocol.writeTask('dev', task1);
      await fileProtocol.writeTask('dev', task2);

      // Verify tasks exist
      const tasksBefore = await fileProtocol.readTasks('dev');
      expect(tasksBefore.length).toBe(2);

      // Clear inbox
      await fileProtocol.clearInbox('dev');

      // Verify inbox is empty
      const tasksAfter = await fileProtocol.readTasks('dev');
      expect(tasksAfter.length).toBe(0);
    });
  });

  describe('clearOutbox()', () => {
    it('should clear all results from outbox', async () => {
      // Write some results
      const result1: TaskResult = {
        taskId: 'task-007',
        status: 'completed',
        completedAt: '2026-05-03T00:00:00Z',
        model: 'claude-sonnet-4-20250514',
        summary: 'Result 1',
        changedFiles: [],
      };

      const result2: TaskResult = {
        taskId: 'task-008',
        status: 'completed',
        completedAt: '2026-05-03T00:00:00Z',
        model: 'claude-sonnet-4-20250514',
        summary: 'Result 2',
        changedFiles: [],
      };

      await fileProtocol.writeResult('dev', result1);
      await fileProtocol.writeResult('dev', result2);

      // Verify results exist
      const resultsBefore = await fileProtocol.readResults('dev');
      expect(resultsBefore.length).toBe(2);

      // Clear outbox
      await fileProtocol.clearOutbox('dev');

      // Verify outbox is empty
      const resultsAfter = await fileProtocol.readResults('dev');
      expect(resultsAfter.length).toBe(0);
    });
  });
});
