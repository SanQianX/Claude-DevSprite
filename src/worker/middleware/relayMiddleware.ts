/**
 * Relay Middleware
 * In sync/relay mode, intercepts mutation requests (POST/PUT/DELETE)
 * and forwards them to the local Agent for execution.
 * The Agent executes locally and syncs state back via syncClient.
 */

import type { Request, Response, NextFunction } from 'express';
import { config } from '../../config';
import { relayManager } from '../../relay/relayManager';
import { createLogger } from '../../utils/logger';

const logger = createLogger('relay-middleware');

// Routes that should be relayed to agent (mutations only)
const RELAY_ROUTES = [
  // Tasks
  { method: 'POST', pattern: /^\/api\/projects\/[^/]+\/tasks/ },
  { method: 'PUT', pattern: /^\/api\/projects\/[^/]+\/tasks\// },
  { method: 'DELETE', pattern: /^\/api\/projects\/[^/]+\/tasks\// },

  // Reviews
  { method: 'PUT', pattern: /^\/api\/projects\/[^/]+\/reviews\// },
  { method: 'POST', pattern: /^\/api\/projects\/[^/]+\/reviews\/scan/ },
  { method: 'POST', pattern: /^\/api\/projects\/[^/]+\/reviews\/fix-batch/ },
  { method: 'POST', pattern: /^\/api\/reviews\/\d+\/fix/ },
  { method: 'PUT', pattern: /^\/api\/scanner\/config/ },
  { method: 'PUT', pattern: /^\/api\/fixer\/config/ },
  { method: 'POST', pattern: /^\/api\/fixer\/trigger/ },

  // Projects
  { method: 'POST', pattern: /^\/api\/projects\/discover/ },
  { method: 'POST', pattern: /^\/api\/projects\/add/ },
  { method: 'DELETE', pattern: /^\/api\/projects\/[^/]+$/ },

  // Analysis
  { method: 'POST', pattern: /^\/api\/projects\/[^/]+\/analyze/ },

  // Config
  { method: 'POST', pattern: /^\/api\/config\/ai/ },
  { method: 'PUT', pattern: /^\/api\/config$/ },

  // Memory
  { method: 'POST', pattern: /^\/api\/projects\/[^/]+\/memory/ },
];

/**
 * Check if a request should be relayed to the agent
 */
function shouldRelay(method: string, path: string): boolean {
  return RELAY_ROUTES.some(r =>
    r.method === method && r.pattern.test(path)
  );
}

/**
 * Express middleware that relays mutations to the local agent in sync mode
 */
export function relayMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Only intercept in sync/relay mode
  if (!config.sync.enabled) {
    return next();
  }

  // Only intercept mutations
  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Check if this route should be relayed
  if (!shouldRelay(req.method, req.path)) {
    return next();
  }

  const userId = 1; // Default single-user

  // Check if agent is online
  if (!relayManager.isAgentOnline(userId)) {
    // Agent offline — fall through to local execution (will fail on empty DB)
    // or return error
    logger.warn(`Agent offline, cannot relay ${req.method} ${req.path}`);
    res.status(503).json({
      error: 'Agent offline',
      message: 'Local agent is not connected. Command cannot be relayed.',
    });
    return;
  }

  // Forward the entire request to the agent
  const relayMessage = {
    type: 'relay.request',
    requestId: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    method: req.method,
    path: req.path,
    body: req.body,
    query: req.query,
    params: req.params,
  };

  logger.info(`Relaying ${req.method} ${req.path} to agent`);

  // Send to agent and wait for response
  const agent = relayManager.getAgentForUser(userId);
  if (!agent) {
    res.status(503).json({ error: 'Agent not available' });
    return;
  }
  const agentWs = agent.ws;

  // Store the response resolver for this request
  pendingRequests.set(relayMessage.requestId, { res, timestamp: Date.now() });

  // Send to agent
  try {
    agentWs.send(JSON.stringify(relayMessage));
  } catch (err: any) {
    logger.error(`Failed to relay to agent: ${err.message}`);
    pendingRequests.delete(relayMessage.requestId);
    res.status(502).json({ error: 'Failed to forward to agent' });
    return;
  }

  // Set timeout — if agent doesn't respond in 30s, return timeout error
  setTimeout(() => {
    const pending = pendingRequests.get(relayMessage.requestId);
    if (pending) {
      pendingRequests.delete(relayMessage.requestId);
      // Agent didn't respond, but state sync may still work
      // Return accepted — the sync will update the UI
      pending.res.status(202).json({
        status: 'accepted',
        message: 'Command forwarded to agent. State will sync shortly.',
        requestId: relayMessage.requestId,
      });
    }
  }, 30000);
}

// Pending relay requests awaiting agent response
const pendingRequests = new Map<string, { res: Response; timestamp: number }>();

/**
 * Handle agent response to a relayed request
 * Called from wsServer when agent sends relay.response
 */
export function handleRelayResponse(requestId: string, statusCode: number, body: any): void {
  const pending = pendingRequests.get(requestId);
  if (!pending) return;

  pendingRequests.delete(requestId);
  pending.res.status(statusCode).json(body);
}

/**
 * Cleanup stale pending requests (called periodically)
 */
export function cleanupPendingRequests(): void {
  const now = Date.now();
  for (const [id, pending] of pendingRequests.entries()) {
    if (now - pending.timestamp > 35000) { // 35s timeout
      pendingRequests.delete(id);
      try {
        pending.res.status(202).json({
          status: 'timeout',
          message: 'Agent response timeout. State may still sync.',
        });
      } catch {
        // Response already sent
      }
    }
  }
}

// Cleanup every 30s
setInterval(cleanupPendingRequests, 30000);
