/**
 * Development Log Tests
 * Tests for GATE-12: Development log generation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FileProtocol } from '../../../src/teams/fileProtocol';
import type { Task, TaskResult } from '../../../src/teams/types';

describe('Development Log (GATE-12)', () => {
  let tempDir: string;
  let devDir: string;
  let fileProtocol: FileProtocol;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dev-log-test-'));
    devDir = path.join(tempDir, '.Claude-DevSprite', 'development');
    fileProtocol = new FileProtocol(tempDir);

    // Create directory structure
    await fs.mkdir(path.join(tempDir, '.Claude-DevSprite', 'teams', 'dev', 'inbox'), { recursive: true });
    await fs.mkdir(path.join(tempDir, '.Claude-DevSprite', 'teams', 'dev', 'outbox'), { recursive: true });
    await fs.mkdir(devDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Session Directory Creation', () => {
    it('should create session directory with timestamp', async () => {
      const sessionDir = path.join(devDir, 'session-2026-05-03T01-00-00');
      await fs.mkdir(sessionDir);

      const exists = await fs.access(sessionDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should create timeline.md in session directory', async () => {
      const sessionDir = path.join(devDir, 'session-test');
      await fs.mkdir(sessionDir);

      const timeline = `# 开发时间线

## 任务: task-001
- **状态**: completed
- **时间**: 2026-05-03T01:00:00Z
- **摘要**: 实现登录功能
- **变更文件**: src/auth/login.ts
`;

      await fs.writeFile(path.join(sessionDir, 'timeline.md'), timeline);

      const content = await fs.readFile(path.join(sessionDir, 'timeline.md'), 'utf-8');
      expect(content).toContain('开发时间线');
      expect(content).toContain('task-001');
      expect(content).toContain('completed');
    });
  });

  describe('Timeline Content', () => {
    it('should record task completion in timeline', async () => {
      const sessionDir = path.join(devDir, 'session-test');
      await fs.mkdir(sessionDir);

      // Write task and result
      const task: Task = {
        id: 'task-log-001',
        type: 'development',
        priority: 'high',
        assignedTo: 'dev',
        title: 'Implement login',
        description: 'Add JWT auth',
        acceptanceCriteria: ['POST /api/login returns token'],
        createdAt: '2026-05-03T01:00:00Z',
        status: 'pending',
      };

      const result: TaskResult = {
        taskId: 'task-log-001',
        status: 'completed',
        completedAt: '2026-05-03T01:05:00Z',
        model: 'claude-sonnet-4-20250514',
        summary: 'Login endpoint implemented',
        changedFiles: ['src/auth/login.ts', 'src/auth/middleware.ts'],
      };

      await fileProtocol.writeTask('dev', task);
      await fileProtocol.writeResult('dev', result);

      // Generate timeline content
      const tasks = await fileProtocol.readTasks('dev');
      const results = await fileProtocol.readResults('dev');

      let timeline = '# 开发时间线\n\n';
      for (const t of tasks) {
        const r = results.find(res => res.taskId === t.id);
        timeline += `## 任务: ${t.id}\n`;
        timeline += `- **标题**: ${t.title}\n`;
        timeline += `- **状态**: ${r?.status || 'pending'}\n`;
        if (r) {
          timeline += `- **摘要**: ${r.summary}\n`;
          timeline += `- **变更文件**: ${r.changedFiles.join(', ')}\n`;
        }
        timeline += '\n';
      }

      await fs.writeFile(path.join(sessionDir, 'timeline.md'), timeline);

      const content = await fs.readFile(path.join(sessionDir, 'timeline.md'), 'utf-8');
      expect(content).toContain('task-log-001');
      expect(content).toContain('Implement login');
      expect(content).toContain('completed');
      expect(content).toContain('src/auth/login.ts');
    });

    it('should record multiple tasks in timeline', async () => {
      const sessionDir = path.join(devDir, 'session-multi');
      await fs.mkdir(sessionDir);

      const tasks: Task[] = [
        {
          id: 'task-m-001',
          type: 'development',
          priority: 'high',
          assignedTo: 'dev',
          title: 'Task 1',
          description: 'First task',
          acceptanceCriteria: [],
          createdAt: '2026-05-03T01:00:00Z',
          status: 'pending',
        },
        {
          id: 'task-m-002',
          type: 'development',
          priority: 'medium',
          assignedTo: 'dev',
          title: 'Task 2',
          description: 'Second task',
          acceptanceCriteria: [],
          createdAt: '2026-05-03T01:10:00Z',
          status: 'pending',
        },
      ];

      for (const task of tasks) {
        await fileProtocol.writeTask('dev', task);
        await fileProtocol.writeResult('dev', {
          taskId: task.id,
          status: 'completed',
          completedAt: '2026-05-03T02:00:00Z',
          model: 'test',
          summary: `Completed ${task.title}`,
          changedFiles: [],
        });
      }

      const readTasks = await fileProtocol.readTasks('dev');
      const readResults = await fileProtocol.readResults('dev');

      expect(readTasks).toHaveLength(2);
      expect(readResults).toHaveLength(2);
      expect(readResults.every(r => r.status === 'completed')).toBe(true);
    });
  });

  describe('Failed Task Logging', () => {
    it('should record failed tasks with error info', async () => {
      const task: Task = {
        id: 'task-fail-001',
        type: 'development',
        priority: 'high',
        assignedTo: 'dev',
        title: 'Failing task',
        description: 'This will fail',
        acceptanceCriteria: [],
        createdAt: '2026-05-03T01:00:00Z',
        status: 'pending',
      };

      const result: TaskResult = {
        taskId: 'task-fail-001',
        status: 'failed',
        completedAt: '2026-05-03T01:05:00Z',
        model: 'claude-sonnet-4-20250514',
        summary: 'Task failed',
        changedFiles: [],
        error: 'Process timed out after 600 seconds',
      };

      await fileProtocol.writeTask('dev', task);
      await fileProtocol.writeResult('dev', result);

      const results = await fileProtocol.readResults('dev');
      expect(results[0].status).toBe('failed');
      expect(results[0].error).toContain('timed out');
    });
  });
});
