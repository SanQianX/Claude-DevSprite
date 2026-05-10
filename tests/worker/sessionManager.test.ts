/**
 * SessionManager Unit Tests
 * Tests for session CRUD, message ordering, and file-based persistence
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SessionManager } from '../../src/worker/sessionManager';
import type { Session, SessionMessage } from '../../src/worker/sessionManager';

describe('SessionManager', () => {
  let manager: SessionManager;
  let tempDir: string;

  beforeEach(async () => {
    // Create temp directory for isolated tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-mgr-test-'));
    manager = new SessionManager(tempDir);
  });

  afterEach(async () => {
    // Wait for any pending async writes before cleanup
    await manager.flush();
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('createSession()', () => {
    it('should create session with generated ID', () => {
      const session = manager.createSession('/test/project');

      expect(session.id).toBeDefined();
      expect(session.id).toMatch(/^\d+-[a-z0-9]+$/);
    });

    it('should create session with project path', () => {
      const session = manager.createSession('/test/project');

      expect(session.projectPath).toBe('/test/project');
    });

    it('should create session with custom title', () => {
      const session = manager.createSession('/test/project', 'My Chat');

      expect(session.title).toBe('My Chat');
    });

    it('should create session with default title when not provided', () => {
      const session = manager.createSession('/test/project');

      expect(session.title).toContain('Session');
    });

    it('should initialize session with active status', () => {
      const session = manager.createSession('/test/project');

      expect(session.status).toBe('active');
    });

    it('should initialize message count to zero', () => {
      const session = manager.createSession('/test/project');

      expect(session.metadata.messageCount).toBe(0);
    });

    it('should persist session to disk', async () => {
      const session = manager.createSession('/test/project');
      await manager.flush();

      const filePath = path.join(tempDir, `${session.id}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.id).toBe(session.id);
      expect(parsed.projectPath).toBe('/test/project');
    });
  });

  describe('getSession()', () => {
    it('should return session by ID', () => {
      const created = manager.createSession('/test/project');
      const found = manager.getSession(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return undefined for non-existent session', () => {
      const found = manager.getSession('non-existent-id');

      expect(found).toBeUndefined();
    });
  });

  describe('getActiveSession()', () => {
    it('should return an active session for project', () => {
      const session1 = manager.createSession('/test/project');
      const session2 = manager.createSession('/test/project');

      const active = manager.getActiveSession('/test/project');

      expect(active).toBeDefined();
      // Should return one of the active sessions
      expect([session1.id, session2.id]).toContain(active?.id);
    });

    it('should return undefined when no sessions exist for project', () => {
      const active = manager.getActiveSession('/nonexistent/project');

      expect(active).toBeUndefined();
    });

    it('should not return archived sessions', () => {
      const session = manager.createSession('/test/project');
      manager.archiveSession(session.id);

      const active = manager.getActiveSession('/test/project');

      expect(active).toBeUndefined();
    });

    it('should return only sessions for specified project', () => {
      manager.createSession('/project/a');
      const sessionB = manager.createSession('/project/b');

      const active = manager.getActiveSession('/project/b');

      expect(active?.id).toBe(sessionB.id);
    });
  });

  describe('getSessions()', () => {
    it('should return all sessions for a project', () => {
      manager.createSession('/test/project');
      manager.createSession('/test/project');
      manager.createSession('/other/project');

      const sessions = manager.getSessions('/test/project');

      expect(sessions).toHaveLength(2);
    });

    it('should return sessions sorted by updatedAt descending', () => {
      const session1 = manager.createSession('/test/project', 'Session 1');

      // Add a message to session1 to update its timestamp
      manager.addMessage(session1.id, { type: 'user', content: 'Hello', timestamp: Date.now() });

      const session2 = manager.createSession('/test/project', 'Session 2');

      const sessions = manager.getSessions('/test/project');

      expect(sessions).toHaveLength(2);
      // Both sessions should be returned
      const ids = sessions.map(s => s.id);
      expect(ids).toContain(session1.id);
      expect(ids).toContain(session2.id);
      // Verify sort order: first session should have >= updatedAt than second
      expect(sessions[0].updatedAt).toBeGreaterThanOrEqual(sessions[1].updatedAt);
    });

    it('should return empty array when no sessions exist', () => {
      const sessions = manager.getSessions('/nonexistent/project');

      expect(sessions).toEqual([]);
    });

    it('should include archived sessions', () => {
      const session = manager.createSession('/test/project');
      manager.archiveSession(session.id);

      const sessions = manager.getSessions('/test/project');

      expect(sessions).toHaveLength(1);
      expect(sessions[0].status).toBe('archived');
    });
  });

  describe('archiveSession()', () => {
    it('should set session status to archived', () => {
      const session = manager.createSession('/test/project');

      const result = manager.archiveSession(session.id);

      expect(result).toBe(true);
      expect(manager.getSession(session.id)?.status).toBe('archived');
    });

    it('should update updatedAt timestamp', () => {
      const session = manager.createSession('/test/project');
      const originalUpdatedAt = session.updatedAt;

      manager.archiveSession(session.id);

      const archived = manager.getSession(session.id);
      expect(archived!.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    });

    it('should persist archived status to disk', async () => {
      const session = manager.createSession('/test/project');

      manager.archiveSession(session.id);
      await manager.flush();

      const filePath = path.join(tempDir, `${session.id}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.status).toBe('archived');
    });

    it('should return false for non-existent session', () => {
      const result = manager.archiveSession('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('updateSessionTitle()', () => {
    it('should update session title', () => {
      const session = manager.createSession('/test/project');

      const result = manager.updateSessionTitle(session.id, 'New Title');

      expect(result).toBe(true);
      expect(manager.getSession(session.id)?.title).toBe('New Title');
    });

    it('should persist title update to disk', async () => {
      const session = manager.createSession('/test/project');

      manager.updateSessionTitle(session.id, 'Updated Title');
      await manager.flush();

      const filePath = path.join(tempDir, `${session.id}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.title).toBe('Updated Title');
    });

    it('should return false for non-existent session', () => {
      const result = manager.updateSessionTitle('non-existent-id', 'Title');

      expect(result).toBe(false);
    });
  });

  describe('addMessage()', () => {
    it('should add message to session', () => {
      const session = manager.createSession('/test/project');

      const message = manager.addMessage(session.id, {
        type: 'user',
        content: 'Hello agent',
        timestamp: Date.now(),
      });

      expect(message.sessionId).toBe(session.id);
      expect(message.content).toBe('Hello agent');
      expect(message.type).toBe('user');
    });

    it('should assign sequenceId starting from 1', () => {
      const session = manager.createSession('/test/project');

      const message = manager.addMessage(session.id, {
        type: 'user',
        content: 'First message',
        timestamp: Date.now(),
      });

      expect(message.sequenceId).toBe(1);
    });

    it('should increment sequenceId for each message', () => {
      const session = manager.createSession('/test/project');

      const msg1 = manager.addMessage(session.id, {
        type: 'user',
        content: 'Message 1',
        timestamp: Date.now(),
      });

      const msg2 = manager.addMessage(session.id, {
        type: 'agent',
        content: 'Message 2',
        timestamp: Date.now(),
      });

      const msg3 = manager.addMessage(session.id, {
        type: 'user',
        content: 'Message 3',
        timestamp: Date.now(),
      });

      expect(msg1.sequenceId).toBe(1);
      expect(msg2.sequenceId).toBe(2);
      expect(msg3.sequenceId).toBe(3);
    });

    it('should update session message count', () => {
      const session = manager.createSession('/test/project');

      manager.addMessage(session.id, {
        type: 'user',
        content: 'Message 1',
        timestamp: Date.now(),
      });

      manager.addMessage(session.id, {
        type: 'agent',
        content: 'Message 2',
        timestamp: Date.now(),
      });

      const updated = manager.getSession(session.id);
      expect(updated?.metadata.messageCount).toBe(2);
    });

    it('should persist message to disk', async () => {
      const session = manager.createSession('/test/project');

      const message = manager.addMessage(session.id, {
        type: 'user',
        content: 'Persisted message',
        timestamp: Date.now(),
      });

      await manager.flush();
      const msgDir = path.join(tempDir, session.id, 'messages');
      const filePath = path.join(msgDir, '000001.json');
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.content).toBe('Persisted message');
      expect(parsed.sequenceId).toBe(1);
    });

    it('should throw error for non-existent session', () => {
      expect(() => {
        manager.addMessage('non-existent', {
          type: 'user',
          content: 'Hello',
          timestamp: Date.now(),
        });
      }).toThrow('Session not found');
    });

    it('should include optional team field', () => {
      const session = manager.createSession('/test/project');

      const message = manager.addMessage(session.id, {
        type: 'agent',
        team: 'dev',
        content: 'Agent response',
        timestamp: Date.now(),
      });

      expect(message.team).toBe('dev');
    });

    it('should include optional metadata', () => {
      const session = manager.createSession('/test/project');

      const message = manager.addMessage(session.id, {
        type: 'tool_call',
        content: 'Calling tool',
        timestamp: Date.now(),
        metadata: { toolName: 'Write', toolArgs: { file_path: 'test.ts' } },
      });

      expect(message.metadata?.toolName).toBe('Write');
    });
  });

  describe('getMessages()', () => {
    it('should return all messages for session', () => {
      const session = manager.createSession('/test/project');

      manager.addMessage(session.id, { type: 'user', content: 'Msg 1', timestamp: Date.now() });
      manager.addMessage(session.id, { type: 'agent', content: 'Msg 2', timestamp: Date.now() });

      const messages = manager.getMessages(session.id);

      expect(messages).toHaveLength(2);
    });

    it('should return messages in sequence order', () => {
      const session = manager.createSession('/test/project');

      manager.addMessage(session.id, { type: 'user', content: 'First', timestamp: Date.now() });
      manager.addMessage(session.id, { type: 'agent', content: 'Second', timestamp: Date.now() });
      manager.addMessage(session.id, { type: 'user', content: 'Third', timestamp: Date.now() });

      const messages = manager.getMessages(session.id);

      expect(messages[0].sequenceId).toBe(1);
      expect(messages[1].sequenceId).toBe(2);
      expect(messages[2].sequenceId).toBe(3);
    });

    it('should return empty array for session with no messages', () => {
      const session = manager.createSession('/test/project');

      const messages = manager.getMessages(session.id);

      expect(messages).toEqual([]);
    });

    it('should return empty array for non-existent session', () => {
      const messages = manager.getMessages('non-existent');

      expect(messages).toEqual([]);
    });
  });

  describe('getMessagesAfter()', () => {
    it('should return messages after specified sequence ID', () => {
      const session = manager.createSession('/test/project');

      manager.addMessage(session.id, { type: 'user', content: 'Msg 1', timestamp: Date.now() });
      manager.addMessage(session.id, { type: 'agent', content: 'Msg 2', timestamp: Date.now() });
      manager.addMessage(session.id, { type: 'user', content: 'Msg 3', timestamp: Date.now() });
      manager.addMessage(session.id, { type: 'agent', content: 'Msg 4', timestamp: Date.now() });

      const messages = manager.getMessagesAfter(session.id, 2);

      expect(messages).toHaveLength(2);
      expect(messages[0].sequenceId).toBe(3);
      expect(messages[1].sequenceId).toBe(4);
    });

    it('should return all messages when afterSequenceId is 0', () => {
      const session = manager.createSession('/test/project');

      manager.addMessage(session.id, { type: 'user', content: 'Msg 1', timestamp: Date.now() });
      manager.addMessage(session.id, { type: 'agent', content: 'Msg 2', timestamp: Date.now() });

      const messages = manager.getMessagesAfter(session.id, 0);

      expect(messages).toHaveLength(2);
    });

    it('should return empty array when no messages after sequence ID', () => {
      const session = manager.createSession('/test/project');

      manager.addMessage(session.id, { type: 'user', content: 'Msg 1', timestamp: Date.now() });

      const messages = manager.getMessagesAfter(session.id, 5);

      expect(messages).toEqual([]);
    });
  });

  describe('persistence and reload', () => {
    it('should reload sessions from disk on construction', async () => {
      const session = manager.createSession('/test/project');
      manager.addMessage(session.id, { type: 'user', content: 'Hello', timestamp: Date.now() });
      await manager.flush();

      // Create new manager from same directory
      const manager2 = new SessionManager(tempDir);

      const loaded = manager2.getSession(session.id);
      expect(loaded).toBeDefined();
      expect(loaded?.projectPath).toBe('/test/project');
    });

    it('should reload messages from disk on construction', async () => {
      const session = manager.createSession('/test/project');
      manager.addMessage(session.id, { type: 'user', content: 'Msg 1', timestamp: Date.now() });
      manager.addMessage(session.id, { type: 'agent', content: 'Msg 2', timestamp: Date.now() });
      await manager.flush();

      // Create new manager from same directory
      const manager2 = new SessionManager(tempDir);

      const messages = manager2.getMessages(session.id);
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('Msg 1');
      expect(messages[1].content).toBe('Msg 2');
    });

    it('should maintain sequence ID continuity after reload', async () => {
      const session = manager.createSession('/test/project');
      manager.addMessage(session.id, { type: 'user', content: 'Msg 1', timestamp: Date.now() });
      manager.addMessage(session.id, { type: 'agent', content: 'Msg 2', timestamp: Date.now() });
      await manager.flush();

      // Create new manager and add another message
      const manager2 = new SessionManager(tempDir);
      const newMsg = manager2.addMessage(session.id, { type: 'user', content: 'Msg 3', timestamp: Date.now() });

      expect(newMsg.sequenceId).toBe(3);
    });

    it('should handle empty sessions directory gracefully', () => {
      // Create manager with empty temp directory
      const emptyDir = path.join(os.tmpdir(), 'empty-sessions-test');
      const manager2 = new SessionManager(emptyDir);

      const sessions = manager2.getSessions('/any/project');
      expect(sessions).toEqual([]);
    });
  });
});
