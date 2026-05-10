/**
 * WsServer Unit Tests
 * Tests for WebSocket connection lifecycle, message routing, and broadcasting
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { SessionManager } from '../../src/worker/sessionManager';

// Mock WebSocket class that simulates ws behavior
class MockWebSocket extends EventEmitter {
  readyState = 1; // OPEN
  sentMessages: string[] = [];
  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', code, reason);
  }

  terminate() {
    this.readyState = MockWebSocket.CLOSED;
  }

  ping() {
    this.emit('ping');
  }

  getLastMessage(): any {
    if (this.sentMessages.length === 0) return null;
    return JSON.parse(this.sentMessages[this.sentMessages.length - 1]);
  }

  getAllMessages(): any[] {
    return this.sentMessages.map(m => JSON.parse(m));
  }

  clearMessages() {
    this.sentMessages = [];
  }
}

// Mock IncomingMessage
class MockIncomingMessage extends EventEmitter {
  socket = { remoteAddress: '127.0.0.1' };
}

describe('WsServer', () => {
  let tempDir: string;
  let sessionManager: SessionManager;

  // Dynamic import to avoid issues with module loading
  let WsServer: any;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-server-test-'));
    sessionManager = new SessionManager(tempDir);

    // Dynamically import to get fresh module
    const mod = await import('../../src/worker/wsServer');
    WsServer = mod.WsServer;
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('initialization', () => {
    it('should create WsServer instance', () => {
      const server = new WsServer(sessionManager);

      expect(server).toBeDefined();
      expect(server.getClientCount()).toBe(0);
    });

    it('should have zero clients initially', () => {
      const server = new WsServer(sessionManager);

      expect(server.getClientCount()).toBe(0);
    });
  });

  describe('sendToClient()', () => {
    it('should send JSON message to open WebSocket', () => {
      const server = new WsServer(sessionManager);
      const ws = new MockWebSocket();

      server.sendToClient(ws as any, { type: 'test', data: 'hello' });

      expect(ws.sentMessages).toHaveLength(1);
      const sent = JSON.parse(ws.sentMessages[0]);
      expect(sent.type).toBe('test');
      expect(sent.data).toBe('hello');
    });

    it('should not send to closed WebSocket', () => {
      const server = new WsServer(sessionManager);
      const ws = new MockWebSocket();
      ws.readyState = MockWebSocket.CLOSED;

      server.sendToClient(ws as any, { type: 'test' });

      expect(ws.sentMessages).toHaveLength(0);
    });
  });

  describe('sendError()', () => {
    it('should send error message with code and message', () => {
      const server = new WsServer(sessionManager);
      const ws = new MockWebSocket();

      server.sendError(ws as any, 'TEST_ERROR', 'Something went wrong');

      const sent = ws.getLastMessage();
      expect(sent.type).toBe('error');
      expect(sent.code).toBe('TEST_ERROR');
      expect(sent.message).toBe('Something went wrong');
      expect(sent.timestamp).toBeDefined();
    });
  });

  describe('broadcast()', () => {
    it('should send message to all authenticated clients', () => {
      const server = new WsServer(sessionManager);

      // Simulate authenticated clients by accessing internal state
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      // Manually add clients to the internal map
      (server as any).clients.set('client-1', {
        ws: ws1,
        id: 'client-1',
        authenticated: true,
        connectedAt: Date.now(),
        lastPing: Date.now(),
      });

      (server as any).clients.set('client-2', {
        ws: ws2,
        id: 'client-2',
        authenticated: true,
        connectedAt: Date.now(),
        lastPing: Date.now(),
      });

      server.broadcast({ type: 'announcement', content: 'Hello all' });

      expect(ws1.sentMessages).toHaveLength(1);
      expect(ws2.sentMessages).toHaveLength(1);
    });

    it('should not send to unauthenticated clients', () => {
      const server = new WsServer(sessionManager);

      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      (server as any).clients.set('client-1', {
        ws: ws1,
        id: 'client-1',
        authenticated: true,
        connectedAt: Date.now(),
        lastPing: Date.now(),
      });

      (server as any).clients.set('client-2', {
        ws: ws2,
        id: 'client-2',
        authenticated: false,
        connectedAt: Date.now(),
        lastPing: Date.now(),
      });

      server.broadcast({ type: 'test' });

      expect(ws1.sentMessages).toHaveLength(1);
      expect(ws2.sentMessages).toHaveLength(0);
    });
  });

  describe('broadcastToSession()', () => {
    it('should send message to clients with matching active session', () => {
      const server = new WsServer(sessionManager);

      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      (server as any).clients.set('client-1', {
        ws: ws1,
        id: 'client-1',
        authenticated: true,
        activeSessionId: 'session-123',
        connectedAt: Date.now(),
        lastPing: Date.now(),
      });

      (server as any).clients.set('client-2', {
        ws: ws2,
        id: 'client-2',
        authenticated: true,
        activeSessionId: 'session-456',
        connectedAt: Date.now(),
        lastPing: Date.now(),
      });

      server.broadcastToSession('session-123', { type: 'chat.message', content: 'Hello' });

      expect(ws1.sentMessages).toHaveLength(1);
      expect(ws2.sentMessages).toHaveLength(0);
    });

    it('should not send to clients without active session', () => {
      const server = new WsServer(sessionManager);

      const ws = new MockWebSocket();

      (server as any).clients.set('client-1', {
        ws,
        id: 'client-1',
        authenticated: true,
        activeSessionId: undefined,
        connectedAt: Date.now(),
        lastPing: Date.now(),
      });

      server.broadcastToSession('session-123', { type: 'test' });

      expect(ws.sentMessages).toHaveLength(0);
    });
  });

  describe('broadcastToProject()', () => {
    it('should send message to clients with matching project path', () => {
      const server = new WsServer(sessionManager);

      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      (server as any).clients.set('client-1', {
        ws: ws1,
        id: 'client-1',
        authenticated: true,
        projectPath: '/project/a',
        connectedAt: Date.now(),
        lastPing: Date.now(),
      });

      (server as any).clients.set('client-2', {
        ws: ws2,
        id: 'client-2',
        authenticated: true,
        projectPath: '/project/b',
        connectedAt: Date.now(),
        lastPing: Date.now(),
      });

      server.broadcastToProject('/project/a', { type: 'test' });

      expect(ws1.sentMessages).toHaveLength(1);
      expect(ws2.sentMessages).toHaveLength(0);
    });
  });

  describe('shutdown()', () => {
    it('should close all client connections', () => {
      const server = new WsServer(sessionManager);

      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      (server as any).clients.set('client-1', { ws: ws1, id: 'client-1', authenticated: true });
      (server as any).clients.set('client-2', { ws: ws2, id: 'client-2', authenticated: true });

      // Mock the wss.close
      (server as any).wss = { close: vi.fn((cb) => cb && cb()) };

      server.shutdown();

      expect(ws1.readyState).toBe(MockWebSocket.CLOSED);
      expect(ws2.readyState).toBe(MockWebSocket.CLOSED);
      expect(server.getClientCount()).toBe(0);
    });

    it('should clear heartbeat interval', () => {
      const server = new WsServer(sessionManager);

      // Set a mock interval
      const intervalId = setInterval(() => {}, 1000);
      (server as any).heartbeatInterval = intervalId;

      (server as any).wss = { close: vi.fn((cb) => cb && cb()) };

      server.shutdown();

      expect((server as any).heartbeatInterval).toBeNull();
    });
  });

  describe('message handling', () => {
    it('should route valid messages to handler', () => {
      const server = new WsServer(sessionManager);
      const ws = new MockWebSocket();

      // Mock the handler
      const handleSpy = vi.spyOn((server as any).handler, 'handleMessage');

      // Add client
      (server as any).clients.set('test-client', {
        ws,
        id: 'test-client',
        authenticated: true,
        connectedAt: Date.now(),
        lastPing: Date.now(),
      });

      // Simulate message
      const messageData = Buffer.from(JSON.stringify({ type: 'ping' }));
      (server as any).handleMessage('test-client', messageData);

      expect(handleSpy).toHaveBeenCalled();
    });

    it('should send error for messages without type field', () => {
      const server = new WsServer(sessionManager);
      const ws = new MockWebSocket();

      (server as any).clients.set('test-client', {
        ws,
        id: 'test-client',
        authenticated: true,
        connectedAt: Date.now(),
        lastPing: Date.now(),
      });

      const messageData = Buffer.from(JSON.stringify({ data: 'no type' }));
      (server as any).handleMessage('test-client', messageData);

      const sent = ws.getLastMessage();
      expect(sent.type).toBe('error');
      expect(sent.code).toBe('INVALID_MESSAGE');
    });

    it('should send error for invalid JSON', () => {
      const server = new WsServer(sessionManager);
      const ws = new MockWebSocket();

      (server as any).clients.set('test-client', {
        ws,
        id: 'test-client',
        authenticated: true,
        connectedAt: Date.now(),
        lastPing: Date.now(),
      });

      const messageData = Buffer.from('not valid json{{{');
      (server as any).handleMessage('test-client', messageData);

      const sent = ws.getLastMessage();
      expect(sent.type).toBe('error');
      expect(sent.code).toBe('PARSE_ERROR');
    });

    it('should ignore messages from unknown clients', () => {
      const server = new WsServer(sessionManager);

      // Should not throw
      const messageData = Buffer.from(JSON.stringify({ type: 'ping' }));
      expect(() => {
        (server as any).handleMessage('unknown-client', messageData);
      }).not.toThrow();
    });
  });

  describe('connection management', () => {
    it('should track connected clients', () => {
      const server = new WsServer(sessionManager);

      // Simulate adding clients
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      (server as any).clients.set('c1', { ws: ws1, id: 'c1' });
      (server as any).clients.set('c2', { ws: ws2, id: 'c2' });

      expect(server.getClientCount()).toBe(2);
    });

    it('should remove client on disconnect', () => {
      const server = new WsServer(sessionManager);

      (server as any).clients.set('c1', { ws: new MockWebSocket(), id: 'c1' });
      (server as any).clients.set('c2', { ws: new MockWebSocket(), id: 'c2' });

      (server as any).handleDisconnect('c1', 1000, 'Normal');

      expect(server.getClientCount()).toBe(1);
    });

    it('should handle disconnect of unknown client gracefully', () => {
      const server = new WsServer(sessionManager);

      expect(() => {
        (server as any).handleDisconnect('unknown', 1000, '');
      }).not.toThrow();
    });
  });

  describe('heartbeat', () => {
    it('should terminate clients that exceed timeout', () => {
      const server = new WsServer(sessionManager);
      const ws = new MockWebSocket();
      const terminateSpy = vi.spyOn(ws, 'terminate');

      // Add client with old lastPing
      (server as any).clients.set('stale-client', {
        ws,
        id: 'stale-client',
        authenticated: true,
        connectedAt: Date.now() - 120000,
        lastPing: Date.now() - 120000, // 2 minutes ago
      });

      (server as any).checkHeartbeats();

      expect(terminateSpy).toHaveBeenCalled();
      expect(server.getClientCount()).toBe(0);
    });

    it('should keep clients with recent ping', () => {
      const server = new WsServer(sessionManager);
      const ws = new MockWebSocket();

      (server as any).clients.set('active-client', {
        ws,
        id: 'active-client',
        authenticated: true,
        connectedAt: Date.now(),
        lastPing: Date.now(),
      });

      (server as any).checkHeartbeats();

      expect(server.getClientCount()).toBe(1);
    });
  });
});
