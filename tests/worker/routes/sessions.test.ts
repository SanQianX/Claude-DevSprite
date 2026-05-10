/**
 * Session Routes Unit Tests
 * Tests for REST API endpoints: GET/POST/PATCH/DELETE sessions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SessionManager } from '../../../src/worker/sessionManager';
import { registerSessionRoutes, setSessionManager } from '../../../src/worker/routes/sessions';

// Mock Express app and request/response helpers
function createMockApp() {
  const routes: Record<string, Record<string, Function>> = {};
  const middlewares: Array<{ prefix: string; handler: Function }> = [];

  const app = {
    use: (prefixOrHandler: string | Function, handler?: Function) => {
      if (typeof prefixOrHandler === 'function') {
        middlewares.push({ prefix: '', handler: prefixOrHandler });
      } else if (handler) {
        middlewares.push({ prefix: prefixOrHandler, handler });
      }
    },
    get: (path: string, handler: Function) => {
      if (!routes['GET']) routes['GET'] = {};
      routes['GET'][path] = handler;
    },
    post: (path: string, handler: Function) => {
      if (!routes['POST']) routes['POST'] = {};
      routes['POST'][path] = handler;
    },
    patch: (path: string, handler: Function) => {
      if (!routes['PATCH']) routes['PATCH'] = {};
      routes['PATCH'][path] = handler;
    },
    delete: (path: string, handler: Function) => {
      if (!routes['DELETE']) routes['DELETE'] = {};
      routes['DELETE'][path] = handler;
    },
    // Helper to simulate request
    _handle: async (method: string, urlPath: string, options?: { query?: any; body?: any; params?: any }) => {
      const methodRoutes = routes[method];
      if (!methodRoutes) throw new Error(`No routes for ${method}`);

      // Find matching route
      let handler: Function | undefined;
      let params: Record<string, string> = {};

      for (const [routePath, routeHandler] of Object.entries(methodRoutes)) {
        const match = matchRoute(routePath, urlPath);
        if (match) {
          handler = routeHandler;
          params = match;
          break;
        }
      }

      if (!handler) throw new Error(`No route matched: ${method} ${urlPath}`);

      const req = {
        params: options?.params || params,
        query: options?.query || {},
        body: options?.body || {},
      };

      let responseData: any;
      let statusCode = 200;

      const res = {
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (data: any) => {
          responseData = data;
          return res;
        },
      };

      // next() for route handlers: simulate Express error handler
      const next = (err?: any) => {
        if (err) {
          const code = err.statusCode || 500;
          statusCode = code;
          responseData = { error: err.message };
        }
      };

      // Run matching middlewares before the route handler
      for (const mw of middlewares) {
        if (mw.prefix && urlPath.startsWith(mw.prefix)) {
          let middlewareError: any = null;
          let calledNextWithoutError = false;
          const mwNext = (err?: any) => {
            if (err) {
              middlewareError = err;
            } else {
              calledNextWithoutError = true;
            }
          };
          const mwRes = {
            status: (code: number) => {
              statusCode = code;
              return mwRes;
            },
            json: (data: any) => {
              responseData = data;
              return mwRes;
            },
          };
          await mw.handler(req, mwRes, mwNext);
          if (middlewareError) {
            // Middleware called next(error) — apply error handler and return early
            const code = middlewareError.statusCode || 500;
            statusCode = code;
            responseData = { error: middlewareError.message };
            return { status: statusCode, data: responseData };
          }
          if (!calledNextWithoutError) {
            // Middleware responded (e.g. 503) — return early
            return { status: statusCode, data: responseData };
          }
        }
      }

      await handler(req, res, next);

      return { status: statusCode, data: responseData };
    },
  };

  return app;
}

function matchRoute(pattern: string, url: string): Record<string, string> | null {
  const patternParts = pattern.split('/');
  const urlParts = url.split('/');

  if (patternParts.length !== urlParts.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = urlParts[i];
    } else if (patternParts[i] !== urlParts[i]) {
      return null;
    }
  }

  return params;
}

describe('Session Routes', () => {
  let tempDir: string;
  let sessionManager: SessionManager;
  let app: ReturnType<typeof createMockApp>;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-routes-test-'));
    sessionManager = new SessionManager(tempDir);
    app = createMockApp();

    // Register routes
    setSessionManager(sessionManager);
    registerSessionRoutes(app as any);
  });

  afterEach(async () => {
    // Wait for any pending async writes before cleanup
    await sessionManager.flush();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('GET /api/sessions', () => {
    it('should return sessions for a project', async () => {
      sessionManager.createSession('/test/project', 'Session 1');
      sessionManager.createSession('/test/project', 'Session 2');

      const result = await (app as any)._handle('GET', '/api/sessions', {
        query: { projectPath: '/test/project' },
      });

      expect(result.status).toBe(200);
      expect(result.data).toHaveLength(2);
    });

    it('should return empty array when no sessions exist', async () => {
      const result = await (app as any)._handle('GET', '/api/sessions', {
        query: { projectPath: '/empty/project' },
      });

      expect(result.status).toBe(200);
      expect(result.data).toEqual([]);
    });

    it('should return sessions sorted by updatedAt descending', async () => {
      const session1 = sessionManager.createSession('/test/project', 'Session A');

      // Add a message to session1 to update its timestamp
      sessionManager.addMessage(session1.id, { type: 'user', content: 'Hello', timestamp: Date.now() });

      sessionManager.createSession('/test/project', 'Session B');

      const result = await (app as any)._handle('GET', '/api/sessions', {
        query: { projectPath: '/test/project' },
      });

      expect(result.data).toHaveLength(2);
      // Verify sort order: first session should have >= updatedAt than second
      expect(result.data[0].updatedAt).toBeGreaterThanOrEqual(result.data[1].updatedAt);
    });

    it('should return 503 when session manager not initialized', async () => {
      // Reset session manager
      setSessionManager(null as any);

      const result = await (app as any)._handle('GET', '/api/sessions', {
        query: { projectPath: '/test/project' },
      });

      expect(result.status).toBe(503);
      expect(result.data.error).toContain('not initialized');
    });
  });

  describe('GET /api/sessions/:id', () => {
    it('should return session by ID', async () => {
      const session = sessionManager.createSession('/test/project', 'Test Session');

      const result = await (app as any)._handle('GET', `/api/sessions/${session.id}`);

      expect(result.status).toBe(200);
      expect(result.data.id).toBe(session.id);
      expect(result.data.title).toBe('Test Session');
    });

    it('should return 404 for non-existent session', async () => {
      const result = await (app as any)._handle('GET', '/api/sessions/non-existent');

      expect(result.status).toBe(404);
      expect(result.data.error).toContain('not found');
    });

    it('should return 503 when session manager not initialized', async () => {
      setSessionManager(null as any);

      const result = await (app as any)._handle('GET', '/api/sessions/any-id');

      expect(result.status).toBe(503);
    });
  });

  describe('GET /api/sessions/:id/messages', () => {
    it('should return all messages for session', async () => {
      const session = sessionManager.createSession('/test/project');
      sessionManager.addMessage(session.id, { type: 'user', content: 'Hello', timestamp: Date.now() });
      sessionManager.addMessage(session.id, { type: 'agent', content: 'Hi', timestamp: Date.now() });

      const result = await (app as any)._handle('GET', `/api/sessions/${session.id}/messages`);

      expect(result.status).toBe(200);
      expect(result.data).toHaveLength(2);
    });

    it('should return empty array for session with no messages', async () => {
      const session = sessionManager.createSession('/test/project');

      const result = await (app as any)._handle('GET', `/api/sessions/${session.id}/messages`);

      expect(result.status).toBe(200);
      expect(result.data).toEqual([]);
    });

    it('should return messages after sequence ID when afterSeq provided', async () => {
      const session = sessionManager.createSession('/test/project');
      sessionManager.addMessage(session.id, { type: 'user', content: 'Msg 1', timestamp: Date.now() });
      sessionManager.addMessage(session.id, { type: 'agent', content: 'Msg 2', timestamp: Date.now() });
      sessionManager.addMessage(session.id, { type: 'user', content: 'Msg 3', timestamp: Date.now() });

      const result = await (app as any)._handle('GET', `/api/sessions/${session.id}/messages`, {
        query: { afterSeq: '1' },
      });

      expect(result.status).toBe(200);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].content).toBe('Msg 2');
    });

    it('should handle invalid afterSeq gracefully', async () => {
      const session = sessionManager.createSession('/test/project');
      sessionManager.addMessage(session.id, { type: 'user', content: 'Msg 1', timestamp: Date.now() });

      const result = await (app as any)._handle('GET', `/api/sessions/${session.id}/messages`, {
        query: { afterSeq: 'invalid' },
      });

      // Should return all messages when afterSeq is invalid
      expect(result.status).toBe(200);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('PATCH /api/sessions/:id', () => {
    it('should update session title', async () => {
      const session = sessionManager.createSession('/test/project', 'Old Title');

      const result = await (app as any)._handle('PATCH', `/api/sessions/${session.id}`, {
        body: { title: 'New Title' },
      });

      expect(result.status).toBe(200);
      expect(result.data.title).toBe('New Title');
    });

    it('should return updated session', async () => {
      const session = sessionManager.createSession('/test/project', 'Original');

      const result = await (app as any)._handle('PATCH', `/api/sessions/${session.id}`, {
        body: { title: 'Updated' },
      });

      expect(result.data.id).toBe(session.id);
      expect(result.data.title).toBe('Updated');
    });

    it('should return 404 for non-existent session', async () => {
      const result = await (app as any)._handle('PATCH', '/api/sessions/non-existent', {
        body: { title: 'New' },
      });

      expect(result.status).toBe(404);
    });

    it('should return session without changes when no title provided', async () => {
      const session = sessionManager.createSession('/test/project', 'My Session');

      const result = await (app as any)._handle('PATCH', `/api/sessions/${session.id}`, {
        body: {},
      });

      expect(result.status).toBe(200);
      expect(result.data.title).toBe('My Session');
    });
  });

  describe('DELETE /api/sessions/:id', () => {
    it('should archive session', async () => {
      const session = sessionManager.createSession('/test/project');

      const result = await (app as any)._handle('DELETE', `/api/sessions/${session.id}`);

      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);

      // Verify session is archived
      const archived = sessionManager.getSession(session.id);
      expect(archived?.status).toBe('archived');
    });

    it('should return 404 for non-existent session', async () => {
      const result = await (app as any)._handle('DELETE', '/api/sessions/non-existent');

      expect(result.status).toBe(404);
      expect(result.data.error).toContain('not found');
    });

    it('should return 503 when session manager not initialized', async () => {
      setSessionManager(null as any);

      const result = await (app as any)._handle('DELETE', '/api/sessions/any-id');

      expect(result.status).toBe(503);
    });
  });
});
