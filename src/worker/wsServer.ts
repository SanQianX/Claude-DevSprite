/**
 * WebSocket Server Setup
 * Creates WebSocket server attached to Express HTTP server
 * Handles connection lifecycle, heartbeat, and message routing
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import { createLogger } from '../utils/logger';
import { WsHandler } from './wsHandler';
import { SessionManager } from './sessionManager';

const logger = createLogger('ws-server');

// Client connection metadata
export interface ClientConnection {
  ws: WebSocket;
  id: string;
  connectedAt: number;
  lastPing: number;
  authenticated: boolean;
  projectPath?: string;
  activeSessionId?: string;
}

/**
 * WebSocket server that manages real-time connections for chat system
 */
export class WsServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ClientConnection> = new Map();
  private handler: WsHandler;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(sessionManager: SessionManager) {
    this.handler = new WsHandler(sessionManager, this);
  }

  /**
   * Attach WebSocket server to existing HTTP server
   * @param httpServer - The Express HTTP server instance
   */
  attach(httpServer: Server): void {
    this.wss = new WebSocketServer({
      server: httpServer,
      path: '/ws',
      maxPayload: 1024 * 1024, // 1MB max message size
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error: Error) => {
      logger.error(`WebSocket server error: ${error.message}`);
    });

    // Start heartbeat check every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeats();
    }, 30000);

    logger.info('WebSocket server attached to HTTP server at /ws');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const clientId = this.generateClientId();
    const clientIp = req.socket.remoteAddress || 'unknown';

    const client: ClientConnection = {
      ws,
      id: clientId,
      connectedAt: Date.now(),
      lastPing: Date.now(),
      authenticated: false,
    };

    this.clients.set(clientId, client);
    logger.info(`Client connected: ${clientId} from ${clientIp} (total: ${this.clients.size})`);

    // Send connection acknowledgment
    this.sendToClient(ws, {
      type: 'connected',
      clientId,
      timestamp: Date.now(),
    });

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      this.handleMessage(clientId, data);
    });

    // Handle pong responses (for heartbeat)
    ws.on('pong', () => {
      const c = this.clients.get(clientId);
      if (c) {
        c.lastPing = Date.now();
      }
    });

    // Handle disconnection
    ws.on('close', (code: number, reason: Buffer) => {
      this.handleDisconnect(clientId, code, reason.toString());
    });

    // Handle errors
    ws.on('error', (error: Error) => {
      logger.error(`Client ${clientId} error: ${error.message}`);
    });
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(clientId: string, data: Buffer): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const message = JSON.parse(data.toString());

      // Validate message has required type field
      if (!message.type) {
        this.sendError(client.ws, 'INVALID_MESSAGE', 'Message must have a type field');
        return;
      }

      // Route message to handler
      this.handler.handleMessage(client, message);
    } catch (error) {
      logger.error(`Failed to parse message from ${clientId}: ${error}`);
      this.sendError(client.ws, 'PARSE_ERROR', 'Invalid JSON message');
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnect(clientId: string, code: number, reason: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.clients.delete(clientId);
    logger.info(`Client disconnected: ${clientId} (code: ${code}, reason: ${reason}, remaining: ${this.clients.size})`);

    // Notify handler about disconnection
    this.handler.handleDisconnect(clientId);
  }

  /**
   * Send message to a specific client
   */
  sendToClient(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message to client
   */
  sendError(ws: WebSocket, code: string, message: string): void {
    this.sendToClient(ws, {
      type: 'error',
      code,
      message,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast message to all authenticated clients
   */
  broadcast(message: any): void {
    for (const client of this.clients.values()) {
      if (client.authenticated) {
        this.sendToClient(client.ws, message);
      }
    }
  }

  /**
   * Send message to clients subscribed to a specific session
   */
  broadcastToSession(sessionId: string, message: any): void {
    for (const client of this.clients.values()) {
      if (client.authenticated && client.activeSessionId === sessionId) {
        this.sendToClient(client.ws, message);
      }
    }
  }

  /**
   * Send message to clients subscribed to a specific project
   */
  broadcastToProject(projectPath: string, message: any): void {
    for (const client of this.clients.values()) {
      if (client.authenticated && client.projectPath === projectPath) {
        this.sendToClient(client.ws, message);
      }
    }
  }

  /**
   * Check for stale connections (heartbeat)
   */
  private checkHeartbeats(): void {
    const now = Date.now();
    const timeout = 60000; // 60 seconds timeout

    for (const [clientId, client] of this.clients.entries()) {
      if (now - client.lastPing > timeout) {
        logger.warn(`Client ${clientId} heartbeat timeout, terminating`);
        client.ws.terminate();
        this.clients.delete(clientId);
      } else if (client.ws.readyState === WebSocket.OPEN) {
        // Send ping
        client.ws.ping();
      }
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Shutdown WebSocket server gracefully
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.wss) {
      // Close all client connections
      for (const client of this.clients.values()) {
        client.ws.close(1001, 'Server shutting down');
      }
      this.clients.clear();

      // Close WebSocket server
      this.wss.close(() => {
        logger.info('WebSocket server shut down');
      });
      this.wss = null;
    }
  }
}
