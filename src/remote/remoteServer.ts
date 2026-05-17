/**
 * Remote Desktop Server
 * WebSocket endpoint for streaming screen captures and relaying input events.
 *
 * Architecture:
 *   Agent (local) --[screen]--> Server --[screen]--> Browser
 *   Browser --[input]--> Server --[input]--> Agent (local)
 *
 * Message types:
 *   Agent → Server: remote.screen (JPEG base64), remote.screen.meta (dimensions)
 *   Server → Browser: remote.screen, remote.screen.meta, remote.connected, remote.agent_offline
 *   Browser → Server: remote.input (mouse/keyboard), remote.ping
 *   Server → Agent: remote.input, remote.pong
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import { createLogger } from '../utils/logger';
import { verifyToken } from '../relay/auth';
import { config } from '../config';

const logger = createLogger('remote-server');

interface RemoteClient {
  ws: WebSocket;
  id: string;
  userId: number;
  connectedAt: number;
}

interface AgentConnection {
  ws: WebSocket;
  userId: number;
  name: string;
  hostname: string;
  screenMeta?: { width: number; height: number; scale: number };
}

export class RemoteServer {
  private wss: WebSocketServer | null = null;
  private browsers: Map<string, RemoteClient> = new Map();
  private agents: Map<number, AgentConnection> = new Map(); // keyed by userId

  /**
   * Attach to HTTP server on /ws/remote
   */
  attach(httpServer: Server): void {
    this.wss = new WebSocketServer({
      noServer: true,
      maxPayload: 10 * 1024 * 1024, // 10MB for screen captures
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    logger.info('Remote desktop server attached at /ws/remote');
  }

  /**
   * Handle upgrade from wsServer's unified upgrade handler
   */
  handleUpgrade(req: IncomingMessage, socket: any, head: Buffer): void {
    if (this.wss) {
      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.wss!.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const clientId = `remote-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    let authenticated = false;
    let clientType: 'browser' | 'agent' = 'browser';
    let userId = 0;

    logger.info(`Remote connection: ${clientId} from ${req.socket.remoteAddress}`);

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        // ─── Authentication ───────────────────────────────────────
        if (message.type === 'remote.auth') {
          // Support both JWT tokens (browser) and agent tokens (plain string)
          let authUserId = 0;

          // Try JWT first
          const jwtResult = verifyToken(message.token, config.sync.jwtSecret);
          if (jwtResult) {
            authUserId = jwtResult.userId;
          }
          // Try agent token (plain string comparison)
          else if (config.sync.agentToken && message.token === config.sync.agentToken) {
            authUserId = message.userId || 1;
          }
          else {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
            ws.close(4001, 'Invalid token');
            return;
          }

          userId = authUserId;
          authenticated = true;
          clientType = message.role || 'browser';

          logger.info(`Remote auth: type=${clientType} userId=${userId} token=${message.token?.substring(0, 8)}...`);

          if (clientType === 'agent') {
            // Register agent connection
            this.agents.set(userId, {
              ws,
              userId,
              name: message.name || 'agent',
              hostname: message.hostname || 'unknown',
            });
            logger.info(`Agent registered for remote: userId=${userId} name=${message.name}`);

            // Notify all browsers that agent is online
            this.broadcastToBrowsers(userId, {
              type: 'remote.agent_online',
              name: message.name,
              hostname: message.hostname,
            });
          } else {
            // Register browser connection
            this.browsers.set(clientId, {
              ws,
              id: clientId,
              userId,
              connectedAt: Date.now(),
            });

            // Send current agent status to newly connected browser
            const agent = this.agents.get(userId);
            if (agent) {
              ws.send(JSON.stringify({
                type: 'remote.agent_online',
                name: agent.name,
                hostname: agent.hostname,
                screenMeta: agent.screenMeta,
              }));
            } else {
              ws.send(JSON.stringify({ type: 'remote.agent_offline' }));
            }

            // Forward any cached last screen
            if (agent && this.lastScreens.has(userId)) {
              ws.send(JSON.stringify({
                type: 'remote.screen',
                data: this.lastScreens.get(userId),
              }));
            }

            logger.info(`Browser registered for remote: userId=${userId}`);
          }

          ws.send(JSON.stringify({ type: 'remote.auth_ok', clientId }));
          return;
        }

        // All other messages require auth
        if (!authenticated) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
          return;
        }

        // ─── Agent → Server: Screen capture ──────────────────────
        if (message.type === 'remote.screen') {
          // Cache last screen for newly connecting browsers
          this.lastScreens.set(userId, message.data);
          // Forward to all browsers for this user
          this.broadcastToBrowsers(userId, {
            type: 'remote.screen',
            data: message.data,
          });
          return;
        }

        if (message.type === 'remote.screen.meta') {
          const agent = this.agents.get(userId);
          if (agent) {
            agent.screenMeta = message.meta;
          }
          this.broadcastToBrowsers(userId, {
            type: 'remote.screen.meta',
            meta: message.meta,
          });
          return;
        }

        // ─── Browser → Server: Input events ──────────────────────
        if (message.type === 'remote.input') {
          const agent = this.agents.get(userId);
          if (agent && agent.ws.readyState === WebSocket.OPEN) {
            agent.ws.send(JSON.stringify(message));
          } else {
            ws.send(JSON.stringify({ type: 'remote.agent_offline' }));
          }
          return;
        }

        // ─── Ping/Pong ───────────────────────────────────────────
        if (message.type === 'remote.ping') {
          ws.send(JSON.stringify({ type: 'remote.pong', ts: Date.now() }));
          return;
        }

      } catch (error) {
        logger.error(`Failed to parse remote message: ${error}`);
      }
    });

    ws.on('close', () => {
      if (clientType === 'agent') {
        this.agents.delete(userId);
        this.broadcastToBrowsers(userId, { type: 'remote.agent_offline' });
        logger.info(`Agent disconnected from remote: userId=${userId}`);
      } else {
        this.browsers.delete(clientId);
        logger.info(`Browser disconnected from remote: ${clientId}`);
      }
    });

    ws.on('error', (error: Error) => {
      logger.error(`Remote connection ${clientId} error: ${error.message}`);
    });
  }

  /**
   * Register agent connection from relay manager (when sync mode)
   */
  registerAgent(userId: number, ws: WebSocket, name: string, hostname: string): void {
    this.agents.set(userId, { ws, userId, name, hostname });
    this.broadcastToBrowsers(userId, {
      type: 'remote.agent_online',
      name,
      hostname,
    });
    logger.info(`Agent registered via relay: userId=${userId}`);
  }

  unregisterAgent(userId: number): void {
    this.agents.delete(userId);
    this.broadcastToBrowsers(userId, { type: 'remote.agent_offline' });
  }

  /**
   * Broadcast message to all browsers of a specific user
   */
  private broadcastToBrowsers(userId: number, message: any): void {
    const payload = JSON.stringify(message);
    for (const client of this.browsers.values()) {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  /**
   * Check if an agent is connected for a user
   */
  isAgentConnected(userId: number): boolean {
    const agent = this.agents.get(userId);
    return !!agent && agent.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Send input event to agent
   */
  sendInputToAgent(userId: number, input: any): boolean {
    const agent = this.agents.get(userId);
    if (agent && agent.ws.readyState === WebSocket.OPEN) {
      agent.ws.send(JSON.stringify({ type: 'remote.input', ...input }));
      return true;
    }
    return false;
  }

  shutdown(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.browsers.clear();
    this.agents.clear();
    this.lastScreens.clear();
  }

  // Cache last screen per user for newly connecting browsers
  private lastScreens: Map<number, string> = new Map();
}

export const remoteServer = new RemoteServer();
