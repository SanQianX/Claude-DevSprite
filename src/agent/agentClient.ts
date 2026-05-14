/**
 * Agent Client
 * Local agent that connects to the server, receives commands, executes locally
 */

import WebSocket from 'ws';
import * as os from 'os';
import { createLogger } from '../utils/logger';
import { syncClient } from '../sync/syncClient';

const logger = createLogger('agent-client');

export interface AgentClientConfig {
  serverUrl: string;   // e.g., 'ws://myserver:38888/ws/agent'
  token: string;
  name: string;
}

export class AgentClient {
  private ws: WebSocket | null = null;
  private config: AgentClientConfig;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 50;
  private agentId: string = '';
  private authenticated = false;

  constructor(config: AgentClientConfig) {
    this.config = config;
  }

  /**
   * Connect to server
   */
  connect(): void {
    const url = this.config.serverUrl;
    logger.info(`Connecting to server: ${url}`);

    try {
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        logger.info('Connected to server');
        this.reconnectAttempts = 0;
        this.authenticated = false;

        // Send registration
        this.send({
          type: 'agent.register',
          token: this.config.token,
          name: this.config.name,
          hostname: os.hostname(),
        });
      });

      this.ws.on('message', (data: Buffer) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        logger.info(`Disconnected from server (code: ${code}, reason: ${reason.toString()})`);
        this.authenticated = false;
        this.stopHeartbeat();
        syncClient.stop();
        this.scheduleReconnect();
      });

      this.ws.on('error', (error: Error) => {
        logger.error(`WebSocket error: ${error.message}`);
      });
    } catch (error: any) {
      logger.error(`Connection failed: ${error.message}`);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    this.maxReconnectAttempts = 0; // Prevent reconnect
    this.stopHeartbeat();
    syncClient.stop();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Agent disconnect');
      this.ws = null;
    }

    logger.info('Disconnected from server');
  }

  /**
   * Handle incoming message from server
   */
  private handleMessage(raw: string): void {
    try {
      const message = JSON.parse(raw);

      switch (message.type) {
        case 'connected':
          logger.info(`Server assigned agentId: ${message.agentId}`);
          this.agentId = message.agentId;
          break;

        case 'agent.registered':
          this.authenticated = true;
          logger.info(`Registered as agent: ${message.agentId}`);
          // Start heartbeat
          this.startHeartbeat();
          // Start sync client
          syncClient.start(this.agentId, this.ws!);
          break;

        case 'pong':
          // Heartbeat response
          break;

        case 'chat.send':
          this.handleChatSend(message);
          break;

        case 'scan.trigger':
          this.handleScanTrigger(message);
          break;

        case 'fix.trigger':
          this.handleFixTrigger(message);
          break;

        case 'config.update':
          this.handleConfigUpdate(message);
          break;

        default:
          logger.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error: any) {
      logger.error(`Failed to handle message: ${error.message}`);
    }
  }

  /**
   * Handle chat.send command from browser
   */
  private async handleChatSend(message: any): Promise<void> {
    const { sessionId, content } = message;
    logger.info(`Received chat command for session ${sessionId}: ${content.substring(0, 100)}`);

    try {
      // Dynamic import to avoid circular dependencies
      const { TeamManager } = await import('../teams/teamManager');
      const teamManager = new TeamManager(process.cwd());
      await teamManager.initialize();

      // Stream responses back
      let currentContent = '';

      for await (const event of teamManager.handleChat(content)) {
        if (event.type === 'agent_message') {
          currentContent += event.content;
          this.send({
            type: 'chat.stream',
            agentId: this.agentId,
            sessionId,
            content: currentContent,
          });
        }
      }

      // Send done
      this.send({
        type: 'chat.done',
        agentId: this.agentId,
        sessionId,
      });
    } catch (error: any) {
      logger.error(`Chat execution failed: ${error.message}`);
      this.send({
        type: 'chat.stream',
        agentId: this.agentId,
        sessionId,
        content: `Error: ${error.message}`,
      });
      this.send({
        type: 'chat.done',
        agentId: this.agentId,
        sessionId,
      });
    }
  }

  /**
   * Handle scan.trigger command
   */
  private async handleScanTrigger(message: any): Promise<void> {
    logger.info(`Scan triggered for: ${message.projectName || 'all projects'}`);
    // TODO: trigger project scan via analyzer
  }

  /**
   * Handle fix.trigger command
   */
  private async handleFixTrigger(_message: any): Promise<void> {
    logger.info('Fix triggered');
    // TODO: trigger fixer
  }

  /**
   * Handle config.update command
   */
  private handleConfigUpdate(message: any): void {
    logger.info('Config update received');
    // TODO: apply config changes
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.send({
        type: 'agent.heartbeat',
        agentId: this.agentId,
      });
    }, 30000);
  }

  /**
   * Stop heartbeat interval
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnect attempts reached');
      return;
    }

    const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    const delay = Math.round(baseDelay * (0.5 + Math.random()));
    this.reconnectAttempts++;

    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Send message to server
   */
  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}
