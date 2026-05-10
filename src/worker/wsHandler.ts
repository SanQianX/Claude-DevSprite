/**
 * WebSocket Message Handler
 * Routes incoming WebSocket messages to appropriate handlers
 * Manages authentication and session context
 */

import type { WebSocket } from 'ws';
import { createLogger } from '../utils/logger';
import type { WsServer, ClientConnection } from './wsServer';
import type { SessionManager, SessionMessage } from './sessionManager';
import type { TeamManager } from '../teams/teamManager';
import type { ChatEvent, TeamName } from '../teams/types';

const logger = createLogger('ws-handler');

// Message types from client
interface ClientMessage {
  type: string;
  [key: string]: any;
}

// Cache the dynamic import promise to avoid repeated resolution
const teamManagerModule = import('../teams/teamManager');

/**
 * Handles WebSocket message routing and session management
 */
export class WsHandler {
  private sessionManager: SessionManager;
  private wsServer: WsServer;
  private teamManagers: Map<string, TeamManager> = new Map();
  private clientProjects: Map<string, string> = new Map(); // clientId → projectPath

  constructor(sessionManager: SessionManager, wsServer: WsServer) {
    this.sessionManager = sessionManager;
    this.wsServer = wsServer;
  }

  /**
   * Route incoming message to appropriate handler
   */
  handleMessage(client: ClientConnection, message: ClientMessage): void {
    const { type } = message;

    // Auth check - only 'auth' message allowed without authentication
    if (!client.authenticated && type !== 'auth') {
      this.wsServer.sendError(client.ws, 'NOT_AUTHENTICATED', 'Please authenticate first');
      return;
    }

    // Route message based on type
    switch (type) {
      case 'auth':
        this.handleAuth(client, message);
        break;

      case 'session.create':
        this.handleSessionCreate(client, message);
        break;

      case 'session.activate':
        this.handleSessionActivate(client, message);
        break;

      case 'session.sync':
        this.handleSessionSync(client, message);
        break;

      case 'chat.send':
        this.handleChatSend(client, message);
        break;

      case 'ping':
        this.handlePing(client);
        break;

      default:
        logger.warn(`Unknown message type from ${client.id}: ${type}`);
        this.wsServer.sendError(client.ws, 'UNKNOWN_TYPE', `Unknown message type: ${type}`);
    }
  }

  /**
   * Handle client authentication
   * For v1, accept any auth request (localhost tool, no security risk)
   */
  private handleAuth(client: ClientConnection, message: ClientMessage): void {
    // v1: Accept all auth requests without token validation
    // (localhost-only tool, no security risk)
    client.authenticated = true;
    client.projectPath = message.projectPath || process.cwd();

    // Track client-to-project mapping for cleanup
    this.clientProjects.set(client.id, client.projectPath!);

    logger.info(`Client ${client.id} authenticated for project: ${client.projectPath}`);

    this.wsServer.sendToClient(client.ws, {
      type: 'auth.result',
      success: true,
      clientId: client.id,
      timestamp: Date.now(),
    });

    // Send existing sessions for this project
    const sessions = this.sessionManager.getSessions(client.projectPath!);
    this.wsServer.sendToClient(client.ws, {
      type: 'session.list',
      sessions,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle session creation
   */
  private handleSessionCreate(client: ClientConnection, message: ClientMessage): void {
    const { title } = message;
    const projectPath = client.projectPath || process.cwd();

    try {
      const session = this.sessionManager.createSession(projectPath, title);

      logger.info(`Session created: ${session.id} for project: ${projectPath}`);

      this.wsServer.sendToClient(client.ws, {
        type: 'session.created',
        session,
        timestamp: Date.now(),
      });

      // Auto-activate the new session
      client.activeSessionId = session.id;
    } catch (error: any) {
      logger.error(`Failed to create session: ${error.message}`);
      this.wsServer.sendError(client.ws, 'SESSION_CREATE_FAILED', error.message);
    }
  }

  /**
   * Handle session activation (switch active session)
   */
  private handleSessionActivate(client: ClientConnection, message: ClientMessage): void {
    const { sessionId } = message;

    // Verify session exists
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      this.wsServer.sendError(client.ws, 'SESSION_NOT_FOUND', `Session not found: ${sessionId}`);
      return;
    }

    client.activeSessionId = sessionId;
    logger.info(`Client ${client.id} activated session: ${sessionId}`);

    // Send session messages
    const messages = this.sessionManager.getMessages(sessionId);
    this.wsServer.sendToClient(client.ws, {
      type: 'session.activated',
      sessionId,
      messages,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle session sync (request missed messages)
   */
  private handleSessionSync(client: ClientConnection, message: ClientMessage): void {
    const { sessionId, lastSequenceId } = message;

    // Verify session exists
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      this.wsServer.sendError(client.ws, 'SESSION_NOT_FOUND', `Session not found: ${sessionId}`);
      return;
    }

    const messages = this.sessionManager.getMessagesAfter(sessionId, lastSequenceId);

    this.wsServer.sendToClient(client.ws, {
      type: 'session.sync.result',
      sessionId,
      messages,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle chat message from user
   * Core flow: User message -> TeamManager -> Stream events back to client
   */
  private async handleChatSend(client: ClientConnection, message: ClientMessage): Promise<void> {
    const { sessionId, content } = message;

    if (!content || !content.trim()) {
      this.wsServer.sendError(client.ws, 'EMPTY_MESSAGE', 'Message content is required');
      return;
    }

    // Get or verify session
    const session = sessionId
      ? this.sessionManager.getSession(sessionId)
      : this.sessionManager.getActiveSession(client.projectPath!);

    if (!session) {
      this.wsServer.sendError(client.ws, 'SESSION_NOT_FOUND', 'No active session found');
      return;
    }

    // Update client's active session
    client.activeSessionId = session.id;

    // Save and broadcast user message
    const userMessage = this.sessionManager.addMessage(session.id, {
      type: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    });
    this.broadcastChatMessage(session.id, userMessage);

    // Get or create TeamManager for this project
    const projectPath = client.projectPath || process.cwd();
    const teamManager = await this.getTeamManager(projectPath);

    // Stream agent responses via AsyncGenerator -> WebSocket bridge
    // Accumulate streaming tokens into a single message
    let currentAgentContent = '';
    let currentAgentTeam = '';

    // Notify client that agent is thinking
    this.wsServer.broadcastToSession(session.id, {
      type: 'chat.thinking',
      sessionId,
      thinking: true,
      timestamp: Date.now(),
    });

    try {
      for await (const event of teamManager.handleChat(content.trim())) {
        const eventType = this.mapChatEventType(event.type);

        if (event.type === 'agent_message') {
          // Accumulate streaming tokens
          currentAgentContent += event.content;
          currentAgentTeam = event.team || '';

          // Send streaming update to client (not saved to DB yet)
          this.wsServer.broadcastToSession(session.id, {
            type: 'chat.stream',
            sessionId,
            content: currentAgentContent,
            team: currentAgentTeam,
            timestamp: Date.now(),
          });
        } else {
          // Save accumulated agent message before processing other events
          if (currentAgentContent?.trim()) {
            this.sessionManager.addMessage(session.id, {
              type: 'agent',
              team: currentAgentTeam,
              content: currentAgentContent,
              timestamp: Date.now(),
            });
            currentAgentContent = '';
            currentAgentTeam = '';
          }

          // Save tool_call and tool_result to session history and stream as thinking content
          if (event.type === 'tool_call' || event.type === 'tool_result') {
            this.sessionManager.addMessage(session.id, {
              type: eventType,
              team: event.team,
              content: event.content,
              timestamp: Date.now(),
              metadata: event.metadata,
            });
            // Stream thinking content to client
            const toolName = event.metadata?.toolName;
            const thinkingContent = event.type === 'tool_call'
              ? `▸ ${toolName || 'tool'}`
              : `  ✓ ${(event.content || 'done').slice(0, 120)}`;
            this.wsServer.broadcastToSession(session.id, {
              type: 'chat.thinking',
              sessionId,
              content: thinkingContent,
              timestamp: Date.now(),
            });
          } else if (event.type !== 'completed') {
            // Broadcast system and error events
            const agentMessage = this.sessionManager.addMessage(session.id, {
              type: eventType,
              team: event.team,
              content: event.content,
              timestamp: Date.now(),
              metadata: event.metadata,
            });
            this.broadcastChatMessage(session.id, agentMessage);
          }
        }
      }

      // Save any remaining accumulated agent message (skip if empty)
      if (currentAgentContent?.trim()) {
        this.sessionManager.addMessage(session.id, {
          type: 'agent',
          team: currentAgentTeam,
          content: currentAgentContent,
          timestamp: Date.now(),
        });
      }
    } catch (error: any) {
      logger.error(`Chat error for session ${session.id}: ${error.message}`);

      const errorMessage = this.sessionManager.addMessage(session.id, {
        type: 'error',
        content: `Agent error: ${error.message}`,
        timestamp: Date.now(),
      });
      this.broadcastChatMessage(session.id, errorMessage);
    }

    // Notify client that agent is done thinking
    this.wsServer.broadcastToSession(session.id, {
      type: 'chat.done',
      sessionId,
      thinking: false,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast a chat message to all clients in a session
   */
  private broadcastChatMessage(sessionId: string, message: SessionMessage): void {
    this.wsServer.broadcastToSession(sessionId, {
      type: 'chat.message',
      sessionId,
      message,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle ping message (keepalive)
   */
  private handlePing(client: ClientConnection): void {
    client.lastPing = Date.now();
    this.wsServer.sendToClient(client.ws, {
      type: 'pong',
      timestamp: Date.now(),
    });
  }

  /**
   * Handle client disconnection - clean up resources
   */
  handleDisconnect(clientId: string): void {
    const projectPath = this.clientProjects.get(clientId);
    this.clientProjects.delete(clientId);

    // Check if any clients remain for this project
    if (projectPath) {
      const hasOtherClients = Array.from(this.clientProjects.values()).includes(projectPath);
      if (!hasOtherClients) {
        this.teamManagers.delete(projectPath);
        logger.info(`Cleaned up TeamManager for project: ${projectPath}`);
      }
    }

    logger.info(`Cleaned up resources for client: ${clientId}`);
  }

  /**
   * Get or create TeamManager for a project
   */
  private async getTeamManager(projectPath: string): Promise<TeamManager> {
    let manager = this.teamManagers.get(projectPath);
    if (!manager) {
      const { TeamManager } = await teamManagerModule;
      manager = new TeamManager(projectPath);
      await manager.initialize();
      this.teamManagers.set(projectPath, manager);
    }
    return manager;
  }

  /**
   * Map ChatEvent type to SessionMessage type
   */
  private mapChatEventType(chatType: ChatEvent['type']): SessionMessage['type'] {
    switch (chatType) {
      case 'agent_message':
        return 'agent';
      case 'tool_call':
        return 'tool_call';
      case 'tool_result':
        return 'tool_result';
      case 'task_assigned':
      case 'task_completed':
        return 'system';
      case 'error':
        return 'error';
      case 'completed':
        return 'system';
      default:
        return 'system';
    }
  }
}
