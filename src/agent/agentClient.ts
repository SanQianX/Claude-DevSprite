/**
 * Agent Client
 * Local agent that connects to the server, receives commands, executes locally.
 * Also handles remote desktop: captures screen periodically, relays input events.
 */

import WebSocket from 'ws';
import * as os from 'os';
import { createLogger } from '../utils/logger';
import { syncClient } from '../sync/syncClient';
import { screenCapture } from '../remote/screenCapture';
import { inputSimulator } from '../remote/inputSimulator';

const logger = createLogger('agent-client');

export interface AgentClientConfig {
  serverUrl: string;   // e.g., 'ws://myserver:38888/ws/agent'
  token: string;
  name: string;
  /** Enable remote desktop screen streaming */
  remoteDesktop?: boolean;
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

  // Remote desktop state
  private remoteWs: WebSocket | null = null;
  private screenCaptureInterval: NodeJS.Timeout | null = null;
  private remoteAuthenticated = false;

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
        this.stopRemoteDesktop();
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
    this.stopRemoteDesktop();

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

  // ─── Remote Desktop ──────────────────────────────────────────────

  /**
   * Start remote desktop connection to /ws/remote
   */
  private startRemoteDesktop(): void {
    if (!this.config.remoteDesktop) return;

    // Derive remote URL from agent server URL
    const remoteUrl = this.config.serverUrl.replace('/ws/agent', '/ws/remote');
    logger.info(`Starting remote desktop connection: ${remoteUrl}`);

    try {
      this.remoteWs = new WebSocket(remoteUrl);

      this.remoteWs.on('open', () => {
        logger.info('Remote desktop connected');
        this.remoteAuthenticated = false;

        // Authenticate
        this.remoteWs!.send(JSON.stringify({
          type: 'remote.auth',
          token: this.config.token,
          role: 'agent',
          name: this.config.name,
          hostname: os.hostname(),
        }));
      });

      this.remoteWs.on('message', (data: Buffer) => {
        this.handleRemoteMessage(data.toString());
      });

      this.remoteWs.on('close', () => {
        logger.info('Remote desktop disconnected');
        this.remoteAuthenticated = false;
        this.stopScreenCapture();
        // Reconnect after delay
        setTimeout(() => {
          if (this.config.remoteDesktop) {
            this.startRemoteDesktop();
          }
        }, 5000);
      });

      this.remoteWs.on('error', (error: Error) => {
        logger.error(`Remote desktop error: ${error.message}`);
      });
    } catch (error: any) {
      logger.error(`Remote desktop connection failed: ${error.message}`);
    }
  }

  /**
   * Handle messages from remote desktop server
   */
  private handleRemoteMessage(raw: string): void {
    try {
      const message = JSON.parse(raw);

      switch (message.type) {
        case 'remote.auth_ok':
          this.remoteAuthenticated = true;
          logger.info('Remote desktop authenticated');
          // Start screen capture streaming
          this.startScreenCapture();
          break;

        case 'remote.input':
          // Simulate input on local machine
          this.handleRemoteInput(message);
          break;

        case 'remote.pong':
          break;

        default:
          break;
      }
    } catch (error: any) {
      logger.error(`Remote message parse error: ${error.message}`);
    }
  }

  /**
   * Handle input event from remote browser
   */
  private async handleRemoteInput(message: any): Promise<void> {
    if (message.mouse) {
      await inputSimulator.mouse(message.mouse);
    }
    if (message.keyboard) {
      await inputSimulator.keyboard(message.keyboard);
    }
  }

  /**
   * Start periodic screen capture and streaming
   */
  private startScreenCapture(): void {
    if (this.screenCaptureInterval) return;

    const captureAndSend = async () => {
      if (!this.remoteWs || this.remoteWs.readyState !== WebSocket.OPEN) return;

      try {
        const buffer = await screenCapture.capture({
          quality: 40,
          scale: 0.5,
          maxWidth: 1280,
        });

        if (buffer) {
          // Send as base64
          this.remoteWs.send(JSON.stringify({
            type: 'remote.screen',
            data: buffer.toString('base64'),
          }));
        }
      } catch (error: any) {
        logger.error(`Screen capture failed: ${error.message}`);
      }
    };

    // Capture immediately, then every 500ms (2 fps for bandwidth efficiency)
    captureAndSend();
    this.screenCaptureInterval = setInterval(captureAndSend, 500);
    logger.info('Screen capture started (2 fps)');
  }

  private stopScreenCapture(): void {
    if (this.screenCaptureInterval) {
      clearInterval(this.screenCaptureInterval);
      this.screenCaptureInterval = null;
    }
  }

  private stopRemoteDesktop(): void {
    this.stopScreenCapture();
    if (this.remoteWs) {
      this.remoteWs.close(1000, 'Agent disconnect');
      this.remoteWs = null;
    }
    this.remoteAuthenticated = false;
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
          // Start remote desktop if enabled
          this.startRemoteDesktop();
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
