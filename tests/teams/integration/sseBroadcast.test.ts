/**
 * SSE Broadcast Tests
 * Tests for GATE-9: SSE push functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SSEBroadcaster } from '../../../src/worker/sseBroadcaster';
import type { Response } from 'express';

// Mock Express Response
function createMockResponse(): Response {
  const res = new (require('events').EventEmitter)() as any;
  res.write = vi.fn();
  res.end = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.writeHead = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe('SSE Broadcaster (GATE-9)', () => {
  let broadcaster: SSEBroadcaster;

  beforeEach(() => {
    broadcaster = new SSEBroadcaster();
  });

  describe('Client Management', () => {
    it('should start with zero clients', () => {
      expect(broadcaster.getClientCount()).toBe(0);
    });

    it('should add client', () => {
      const res = createMockResponse();
      broadcaster.addClient(res);
      expect(broadcaster.getClientCount()).toBe(1);
    });

    it('should remove client on close', () => {
      const res = createMockResponse();
      broadcaster.addClient(res);
      expect(broadcaster.getClientCount()).toBe(1);

      // Simulate close
      res.emit('close');
      expect(broadcaster.getClientCount()).toBe(0);
    });

    it('should handle multiple clients', () => {
      const res1 = createMockResponse();
      const res2 = createMockResponse();
      const res3 = createMockResponse();

      broadcaster.addClient(res1);
      broadcaster.addClient(res2);
      broadcaster.addClient(res3);

      expect(broadcaster.getClientCount()).toBe(3);
    });

    it('should send connected event on addClient', () => {
      const res = createMockResponse();
      broadcaster.addClient(res);

      expect(res.write).toHaveBeenCalled();
      const data = res.write.mock.calls[0][0];
      expect(data).toContain('"type":"connected"');
    });
  });

  describe('Broadcast', () => {
    it('should broadcast to all clients', () => {
      const res1 = createMockResponse();
      const res2 = createMockResponse();

      broadcaster.addClient(res1);
      broadcaster.addClient(res2);

      // Clear the initial connected calls
      res1.write.mockClear();
      res2.write.mockClear();

      broadcaster.broadcast({ type: 'test_event', content: 'hello' });

      expect(res1.write).toHaveBeenCalledTimes(1);
      expect(res2.write).toHaveBeenCalledTimes(1);
    });

    it('should include timestamp in broadcast', () => {
      const res = createMockResponse();
      broadcaster.addClient(res);
      res.write.mockClear();

      broadcaster.broadcast({ type: 'test', content: 'data' });

      const data = res.write.mock.calls[0][0];
      expect(data).toContain('"timestamp"');
    });

    it('should format as SSE data', () => {
      const res = createMockResponse();
      broadcaster.addClient(res);
      res.write.mockClear();

      broadcaster.broadcast({ type: 'message', content: 'hello' });

      const data = res.write.mock.calls[0][0];
      expect(data).toMatch(/^data: .+\n\n$/);
    });

    it('should handle broadcast with no clients', () => {
      // Should not throw
      expect(() => {
        broadcaster.broadcast({ type: 'test', content: 'data' });
      }).not.toThrow();
    });

    it('should remove client on write error', () => {
      const res = createMockResponse();
      broadcaster.addClient(res);
      expect(broadcaster.getClientCount()).toBe(1);

      // Make write throw
      res.write = vi.fn(() => { throw new Error('Connection closed'); });

      broadcaster.broadcast({ type: 'test', content: 'data' });
      expect(broadcaster.getClientCount()).toBe(0);
    });
  });

  describe('Chat Event Broadcasting', () => {
    it('should broadcast chat events', () => {
      const res = createMockResponse();
      broadcaster.addClient(res);
      res.write.mockClear();

      broadcaster.broadcast({
        type: 'chat_event',
        team: 'dev',
        content: 'Agent is working on task',
      });

      const data = res.write.mock.calls[0][0];
      const parsed = JSON.parse(data.replace('data: ', '').replace('\n\n', ''));

      expect(parsed.type).toBe('chat_event');
      expect(parsed.team).toBe('dev');
      expect(parsed.content).toBe('Agent is working on task');
    });

    it('should broadcast team status updates', () => {
      const res = createMockResponse();
      broadcaster.addClient(res);
      res.write.mockClear();

      broadcaster.broadcast({
        type: 'status_update',
        team: 'lead',
        status: 'busy',
      });

      const data = res.write.mock.calls[0][0];
      const parsed = JSON.parse(data.replace('data: ', '').replace('\n\n', ''));

      expect(parsed.type).toBe('status_update');
      expect(parsed.team).toBe('lead');
      expect(parsed.status).toBe('busy');
    });
  });
});
