/**
 * Relay Manager
 * Manages agent connections, heartbeat tracking, and message queuing
 */

import type { WebSocket } from 'ws';
import { createLogger } from '../utils/logger';

const logger = createLogger('relay-manager');

export interface AgentConnection {
  ws: WebSocket;
  agentId: string;
  userId: number;
  name: string;
  hostname: string;
  connectedAt: number;
  lastHeartbeat: number;
}

export interface QueuedMessage {
  type: string;
  data: any;
  timestamp: number;
}

export class RelayManager {
  private agents: Map<string, AgentConnection> = new Map();
  private userAgents: Map<number, string> = new Map(); // userId → agentId
  private messageQueues: Map<number, QueuedMessage[]> = new Map();

  /**
   * Register a connected agent
   */
  addAgent(
    ws: WebSocket,
    agentId: string,
    userId: number,
    name: string,
    hostname: string
  ): void {
    // Remove existing agent for this user if any
    const existingAgentId = this.userAgents.get(userId);
    if (existingAgentId) {
      this.removeAgent(existingAgentId);
    }

    const agent: AgentConnection = {
      ws,
      agentId,
      userId,
      name,
      hostname,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
    };

    this.agents.set(agentId, agent);
    this.userAgents.set(userId, agentId);

    logger.info(`Agent registered: ${agentId} (${name}@${hostname}) for user ${userId}`);

    // Deliver queued messages
    this.flushQueue(userId, ws);
  }

  /**
   * Remove an agent
   */
  removeAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    this.agents.delete(agentId);
    this.userAgents.delete(agent.userId);

    logger.info(`Agent removed: ${agentId}`);
  }

  /**
   * Get agent for a specific user
   */
  getAgentForUser(userId: number): AgentConnection | undefined {
    const agentId = this.userAgents.get(userId);
    return agentId ? this.agents.get(agentId) : undefined;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentConnection | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Check if a user's agent is online
   */
  isAgentOnline(userId: number): boolean {
    const agentId = this.userAgents.get(userId);
    return agentId ? this.agents.has(agentId) : false;
  }

  /**
   * Send message to a user's agent
   * Returns false if agent is offline
   */
  sendToAgent(userId: number, message: any): boolean {
    const agent = this.getAgentForUser(userId);
    if (!agent || agent.ws.readyState !== 1) { // WebSocket.OPEN
      return false;
    }

    try {
      agent.ws.send(JSON.stringify(message));
      return true;
    } catch (error: any) {
      logger.error(`Failed to send to agent: ${error.message}`);
      return false;
    }
  }

  /**
   * Queue message for offline delivery
   */
  queueMessage(userId: number, message: any): void {
    if (!this.messageQueues.has(userId)) {
      this.messageQueues.set(userId, []);
    }
    this.messageQueues.get(userId)!.push({
      type: message.type,
      data: message,
      timestamp: Date.now(),
    });

    // Limit queue size
    const queue = this.messageQueues.get(userId)!;
    if (queue.length > 100) {
      queue.splice(0, queue.length - 100);
    }
  }

  /**
   * Get and clear queued messages for a user
   */
  getQueuedMessages(userId: number): QueuedMessage[] {
    const queue = this.messageQueues.get(userId) || [];
    this.messageQueues.delete(userId);
    return queue;
  }

  /**
   * Flush queued messages to a newly connected agent
   */
  private flushQueue(userId: number, ws: WebSocket): void {
    const queue = this.messageQueues.get(userId);
    if (!queue || queue.length === 0) return;

    logger.info(`Flushing ${queue.length} queued messages for user ${userId}`);

    for (const msg of queue) {
      if (ws.readyState === 1) { // WebSocket.OPEN
        try {
          ws.send(JSON.stringify(msg.data));
        } catch {
          break;
        }
      }
    }

    this.messageQueues.delete(userId);
  }

  /**
   * Update agent heartbeat timestamp
   */
  updateHeartbeat(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastHeartbeat = Date.now();
    }
  }

  /**
   * Check for and remove stale agents
   */
  checkHeartbeats(timeoutMs: number = 60000): string[] {
    const now = Date.now();
    const staleAgents: string[] = [];

    for (const [agentId, agent] of this.agents.entries()) {
      if (now - agent.lastHeartbeat > timeoutMs) {
        staleAgents.push(agentId);
      }
    }

    for (const agentId of staleAgents) {
      logger.warn(`Agent heartbeat timeout: ${agentId}`);
      this.removeAgent(agentId);
    }

    return staleAgents;
  }

  /**
   * Get status of a user's agent
   */
  getAgentStatus(userId: number): {
    online: boolean;
    agentId?: string;
    name?: string;
    hostname?: string;
    lastHeartbeat?: number;
  } {
    const agent = this.getAgentForUser(userId);
    if (!agent) {
      return { online: false };
    }
    return {
      online: true,
      agentId: agent.agentId,
      name: agent.name,
      hostname: agent.hostname,
      lastHeartbeat: agent.lastHeartbeat,
    };
  }

  /**
   * Get total connected agents count
   */
  getAgentCount(): number {
    return this.agents.size;
  }
}

export const relayManager = new RelayManager();
