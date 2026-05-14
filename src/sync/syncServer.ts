/**
 * Sync Server
 * Server-side sync handler: receives state from agents, caches, forwards to browsers
 */

import { createLogger } from '../utils/logger';
import type { SyncStateType, FullStateData } from './syncProtocol';

const logger = createLogger('sync-server');

interface CachedState {
  fullState: FullStateData | null;
  lastUpdate: number;
}

export class SyncServer {
  private stateCache: Map<number, CachedState> = new Map();
  private browserConnections: Map<number, Set<any>> = new Map();

  /**
   * Register a browser WebSocket connection for a user
   */
  registerBrowser(userId: number, ws: any): void {
    if (!this.browserConnections.has(userId)) {
      this.browserConnections.set(userId, new Set());
    }
    this.browserConnections.get(userId)!.add(ws);

    // Send cached state immediately
    const cached = this.stateCache.get(userId);
    if (cached?.fullState) {
      this.sendToBrowser(ws, { type: 'sync.full', data: cached.fullState });
    }

    logger.debug(`Browser registered for user ${userId} (total: ${this.browserConnections.get(userId)!.size})`);
  }

  /**
   * Unregister a browser connection
   */
  unregisterBrowser(userId: number, ws: any): void {
    const conns = this.browserConnections.get(userId);
    if (conns) {
      conns.delete(ws);
      if (conns.size === 0) {
        this.browserConnections.delete(userId);
      }
    }
  }

  /**
   * Handle incremental state update from agent
   */
  handleAgentState(userId: number, stateType: SyncStateType, data: any): void {
    // Update cache
    let cached = this.stateCache.get(userId);
    if (!cached) {
      cached = { fullState: null, lastUpdate: Date.now() };
      this.stateCache.set(userId, cached);
    }
    if (cached.fullState) {
      (cached.fullState as any)[stateType] = data;
    }
    cached.lastUpdate = Date.now();

    // Forward to all connected browsers
    this.broadcastToBrowsers(userId, { type: 'sync.state', stateType, data });
    logger.debug(`State synced for user ${userId}: ${stateType}`);
  }

  /**
   * Handle full state snapshot from agent (initial connect / reconnect)
   */
  handleAgentFullState(userId: number, data: FullStateData): void {
    this.stateCache.set(userId, { fullState: data, lastUpdate: Date.now() });
    this.broadcastToBrowsers(userId, { type: 'sync.full', data });
    logger.info(`Full state synced for user ${userId}`);
  }

  /**
   * Handle agent online notification
   */
  handleAgentOnline(userId: number, agentName: string, hostname: string): void {
    this.broadcastToBrowsers(userId, { type: 'agent.online', agentName, hostname });
    logger.info(`Agent online for user ${userId}: ${agentName}@${hostname}`);
  }

  /**
   * Handle agent offline notification
   */
  handleAgentOffline(userId: number): void {
    this.broadcastToBrowsers(userId, { type: 'agent.offline' });
    logger.info(`Agent offline for user ${userId}`);
  }

  /**
   * Handle chat stream from agent → forward to browsers
   */
  handleChatStream(userId: number, sessionId: string, content: string): void {
    this.broadcastToBrowsers(userId, { type: 'chat.stream', sessionId, content });
  }

  /**
   * Handle chat done from agent → forward to browsers
   */
  handleChatDone(userId: number, sessionId: string): void {
    this.broadcastToBrowsers(userId, { type: 'chat.done', sessionId });
  }

  /**
   * Broadcast message to all browsers for a user
   */
  private broadcastToBrowsers(userId: number, message: any): void {
    const conns = this.browserConnections.get(userId);
    if (!conns) return;

    for (const ws of conns) {
      this.sendToBrowser(ws, message);
    }
  }

  /**
   * Send message to a single browser
   */
  private sendToBrowser(ws: any, message: any): void {
    try {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify(message));
      }
    } catch (error: any) {
      logger.error(`Failed to send to browser: ${error.message}`);
    }
  }

  /**
   * Get cached state for a user (for API endpoints)
   */
  getCachedState(userId: number): FullStateData | null {
    const cached = this.stateCache.get(userId);
    return cached?.fullState || null;
  }
}

export const syncServer = new SyncServer();
