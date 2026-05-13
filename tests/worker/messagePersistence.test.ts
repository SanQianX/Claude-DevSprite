/**
 * Message Persistence Tests
 * Verifies messages survive disk persistence and reload across all message types,
 * sequence continuity, incremental sync, and multi-session isolation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SessionManager } from '../../src/worker/sessionManager';
import type { SessionMessage } from '../../src/worker/sessionManager';

describe('Message Persistence', () => {
  let manager: SessionManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'msg-persist-test-'));
    manager = new SessionManager(tempDir);
  });

  afterEach(async () => {
    await manager.flush();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('all message types persist to disk', () => {
    const messageTypes: Array<{ type: SessionMessage['type']; content: string }> = [
      { type: 'user', content: 'Hello agent' },
      { type: 'agent', content: 'Hello user' },
      { type: 'tool_call', content: 'Calling Write tool' },
      { type: 'tool_result', content: 'File written successfully' },
      { type: 'system', content: 'Session started' },
      { type: 'error', content: 'Something went wrong' },
    ];

    it('should persist and reload each message type', async () => {
      const session = manager.createSession('/test/project');

      for (const { type, content } of messageTypes) {
        manager.addMessage(session.id, { type, content, timestamp: Date.now() });
      }

      await manager.flush();

      // Reload from disk
      const manager2 = new SessionManager(tempDir);
      const messages = manager2.getMessages(session.id);

      expect(messages).toHaveLength(messageTypes.length);

      for (let i = 0; i < messageTypes.length; i++) {
        expect(messages[i].type).toBe(messageTypes[i].type);
        expect(messages[i].content).toBe(messageTypes[i].content);
      }
    });
  });

  describe('sequence ID continuity across reload', () => {
    it('should continue incrementing sequenceId after reload', async () => {
      const session = manager.createSession('/test/project');

      // Write 3 messages
      const msg1 = manager.addMessage(session.id, { type: 'user', content: 'Msg 1', timestamp: Date.now() });
      const msg2 = manager.addMessage(session.id, { type: 'agent', content: 'Msg 2', timestamp: Date.now() });
      const msg3 = manager.addMessage(session.id, { type: 'user', content: 'Msg 3', timestamp: Date.now() });

      await manager.flush();

      // Reload
      const manager2 = new SessionManager(tempDir);

      // Next message should have sequenceId = 4
      const msg4 = manager2.addMessage(session.id, { type: 'user', content: 'Msg 4', timestamp: Date.now() });

      expect(msg4.sequenceId).toBe(4);
      expect(manager2.getMessages(session.id)).toHaveLength(4);
    });

    it('should preserve all messages after adding more post-reload', async () => {
      const session = manager.createSession('/test/project');

      manager.addMessage(session.id, { type: 'user', content: 'Before 1', timestamp: Date.now() });
      manager.addMessage(session.id, { type: 'agent', content: 'Before 2', timestamp: Date.now() });
      await manager.flush();

      // Reload and add more
      const manager2 = new SessionManager(tempDir);
      manager2.addMessage(session.id, { type: 'user', content: 'After 1', timestamp: Date.now() });
      manager2.addMessage(session.id, { type: 'agent', content: 'After 2', timestamp: Date.now() });
      await manager2.flush();

      // Reload again
      const manager3 = new SessionManager(tempDir);
      const messages = manager3.getMessages(session.id);

      expect(messages).toHaveLength(4);
      expect(messages.map(m => m.content)).toEqual([
        'Before 1', 'Before 2', 'After 1', 'After 2'
      ]);
    });
  });

  describe('incremental sync (getMessagesAfter) persists correctly', () => {
    it('should return only new messages after sequence ID across instances', async () => {
      const session = manager.createSession('/test/project');

      manager.addMessage(session.id, { type: 'user', content: 'Sync 1', timestamp: Date.now() });
      manager.addMessage(session.id, { type: 'agent', content: 'Sync 2', timestamp: Date.now() });
      await manager.flush();

      // Reload, add more messages
      const manager2 = new SessionManager(tempDir);
      manager2.addMessage(session.id, { type: 'user', content: 'Sync 3', timestamp: Date.now() });
      manager2.addMessage(session.id, { type: 'agent', content: 'Sync 4', timestamp: Date.now() });

      // Get messages after seqId 2 (should return only new ones)
      const synced = manager2.getMessagesAfter(session.id, 2);

      expect(synced).toHaveLength(2);
      expect(synced[0].sequenceId).toBe(3);
      expect(synced[0].content).toBe('Sync 3');
      expect(synced[1].sequenceId).toBe(4);
      expect(synced[1].content).toBe('Sync 4');
    });

    it('should return empty array when no messages after sequence ID', async () => {
      const session = manager.createSession('/test/project');
      manager.addMessage(session.id, { type: 'user', content: 'Only msg', timestamp: Date.now() });
      await manager.flush();

      const manager2 = new SessionManager(tempDir);
      const result = manager2.getMessagesAfter(session.id, 1);

      expect(result).toEqual([]);
    });
  });

  describe('multi-session message isolation', () => {
    it('should keep messages separate per session', async () => {
      const sessionA = manager.createSession('/project/a');
      const sessionB = manager.createSession('/project/b');

      manager.addMessage(sessionA.id, { type: 'user', content: 'A msg 1', timestamp: Date.now() });
      manager.addMessage(sessionA.id, { type: 'agent', content: 'A msg 2', timestamp: Date.now() });
      manager.addMessage(sessionB.id, { type: 'user', content: 'B msg 1', timestamp: Date.now() });

      await manager.flush();

      const manager2 = new SessionManager(tempDir);

      const msgsA = manager2.getMessages(sessionA.id);
      const msgsB = manager2.getMessages(sessionB.id);

      expect(msgsA).toHaveLength(2);
      expect(msgsB).toHaveLength(1);
      expect(msgsA[0].content).toBe('A msg 1');
      expect(msgsB[0].content).toBe('B msg 1');
    });

    it('should maintain independent sequence counters per session', async () => {
      const sessionA = manager.createSession('/project/a');
      const sessionB = manager.createSession('/project/b');

      manager.addMessage(sessionA.id, { type: 'user', content: 'A1', timestamp: Date.now() });
      manager.addMessage(sessionB.id, { type: 'user', content: 'B1', timestamp: Date.now() });
      manager.addMessage(sessionA.id, { type: 'user', content: 'A2', timestamp: Date.now() });

      await manager.flush();

      const manager2 = new SessionManager(tempDir);

      // Session B's next message should start at sequenceId 2, not 3
      const msgB = manager2.addMessage(sessionB.id, { type: 'user', content: 'B2', timestamp: Date.now() });

      expect(msgB.sequenceId).toBe(2);
    });
  });

  describe('message metadata and team field persistence', () => {
    it('should persist team field', async () => {
      const session = manager.createSession('/test/project');
      manager.addMessage(session.id, {
        type: 'tool_call',
        team: 'dev',
        content: 'Tool call content',
        timestamp: Date.now(),
        metadata: { toolName: 'Write' },
      });

      await manager.flush();

      const manager2 = new SessionManager(tempDir);
      const messages = manager2.getMessages(session.id);

      expect(messages[0].team).toBe('dev');
      expect(messages[0].metadata?.toolName).toBe('Write');
    });

    it('should persist complex metadata', async () => {
      const session = manager.createSession('/test/project');
      const complexMeta = {
        toolName: 'Bash',
        toolArgs: { command: 'npm test', cwd: '/test' },
        duration: 1234,
        nested: { a: [1, 2, 3] },
      };

      manager.addMessage(session.id, {
        type: 'tool_call',
        content: 'Running test',
        timestamp: Date.now(),
        metadata: complexMeta,
      });

      await manager.flush();

      const manager2 = new SessionManager(tempDir);
      const messages = manager2.getMessages(session.id);

      expect(messages[0].metadata).toEqual(complexMeta);
    });

    it('should persist messages with empty content', async () => {
      const session = manager.createSession('/test/project');
      manager.addMessage(session.id, {
        type: 'system',
        content: '',
        timestamp: Date.now(),
      });

      await manager.flush();

      const manager2 = new SessionManager(tempDir);
      const messages = manager2.getMessages(session.id);

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('');
    });
  });

  describe('session metadata update on message add', () => {
    it('should update messageCount in session metadata after reload', async () => {
      const session = manager.createSession('/test/project');
      manager.addMessage(session.id, { type: 'user', content: 'Msg 1', timestamp: Date.now() });
      manager.addMessage(session.id, { type: 'agent', content: 'Msg 2', timestamp: Date.now() });
      await manager.flush();

      const manager2 = new SessionManager(tempDir);
      const reloadedSession = manager2.getSession(session.id);

      expect(reloadedSession?.metadata.messageCount).toBe(2);
    });

    it('should increment messageCount when adding messages after reload', async () => {
      const session = manager.createSession('/test/project');
      manager.addMessage(session.id, { type: 'user', content: 'Msg 1', timestamp: Date.now() });
      await manager.flush();

      const manager2 = new SessionManager(tempDir);
      manager2.addMessage(session.id, { type: 'agent', content: 'Msg 2', timestamp: Date.now() });

      const updated = manager2.getSession(session.id);
      expect(updated?.metadata.messageCount).toBe(2);
    });
  });

  describe('file structure on disk', () => {
    it('should create correct directory layout for messages', async () => {
      const session = manager.createSession('/test/project');
      manager.addMessage(session.id, { type: 'user', content: 'Msg 1', timestamp: Date.now() });
      manager.addMessage(session.id, { type: 'agent', content: 'Msg 2', timestamp: Date.now() });
      await manager.flush();

      // Check session file exists
      const sessionFile = path.join(tempDir, `${session.id}.json`);
      const sessionExists = await fs.stat(sessionFile).then(() => true).catch(() => false);
      expect(sessionExists).toBe(true);

      // Check messages directory exists
      const msgDir = path.join(tempDir, session.id, 'messages');
      const dirExists = await fs.stat(msgDir).then(s => s.isDirectory()).catch(() => false);
      expect(dirExists).toBe(true);

      // Check message files with zero-padded names
      const files = await fs.readdir(msgDir);
      const jsonFiles = files.filter(f => f.endsWith('.json')).sort();
      expect(jsonFiles).toEqual(['000001.json', '000002.json']);
    });

    it('should write valid JSON for each message file', async () => {
      const session = manager.createSession('/test/project');
      manager.addMessage(session.id, {
        type: 'user',
        content: 'Hello with "quotes" and \n newlines',
        timestamp: Date.now(),
        metadata: { key: 'value"with"quotes' },
      });
      await manager.flush();

      const msgFile = path.join(tempDir, session.id, 'messages', '000001.json');
      const raw = await fs.readFile(msgFile, 'utf-8');
      const parsed = JSON.parse(raw);

      expect(parsed.type).toBe('user');
      expect(parsed.content).toBe('Hello with "quotes" and \n newlines');
      expect(parsed.metadata.key).toBe('value"with"quotes');
    });
  });

  describe('session update persistence after message add', () => {
    it('should persist session updatedAt after message add', async () => {
      const session = manager.createSession('/test/project');
      const beforeAdd = Date.now();

      manager.addMessage(session.id, { type: 'user', content: 'Test', timestamp: Date.now() });
      await manager.flush();

      const manager2 = new SessionManager(tempDir);
      const reloaded = manager2.getSession(session.id);

      expect(reloaded!.updatedAt).toBeGreaterThanOrEqual(beforeAdd);
    });

    it('should persist messageCount through multiple reload cycles', async () => {
      const session = manager.createSession('/test/project');

      // Cycle 1: add 2 messages
      manager.addMessage(session.id, { type: 'user', content: 'C1', timestamp: Date.now() });
      manager.addMessage(session.id, { type: 'agent', content: 'C2', timestamp: Date.now() });
      await manager.flush();

      // Cycle 2: reload, add 1 more
      const manager2 = new SessionManager(tempDir);
      manager2.addMessage(session.id, { type: 'user', content: 'C3', timestamp: Date.now() });
      await manager2.flush();

      // Cycle 3: reload, verify count
      const manager3 = new SessionManager(tempDir);
      const s = manager3.getSession(session.id);
      expect(s?.metadata.messageCount).toBe(3);
      expect(manager3.getMessages(session.id)).toHaveLength(3);
    });
  });
});
