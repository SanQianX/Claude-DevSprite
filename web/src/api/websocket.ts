/**
 * WebSocket Client
 * Manages WebSocket connection with auto-reconnect and message handling
 */

// WebSocket message types (matching backend protocol)
export interface WsMessage {
  type: string;
  [key: string]: any;
}

// Connection state
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'authenticated';

// Message handler type
type MessageHandler = (message: WsMessage) => void;

/**
 * WebSocket client with auto-reconnect and exponential backoff
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private projectPath: string;

  constructor(projectPath?: string) {
    this.projectPath = projectPath || '';
    // Build WebSocket URL from current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${protocol}//${window.location.host}/ws`;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    this.state = 'connecting';
    this.emit('stateChange', { state: this.state });

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this.state = 'connected';
        this.reconnectAttempts = 0;
        this.emit('stateChange', { state: this.state });

        // Start ping interval
        this.startPing();

        // Send auth message
        this.sendAuth();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WsMessage;
          this.handleMessage(message);
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      };

      this.ws.onclose = (event) => {
        console.log('[WS] Disconnected:', event.code, event.reason);
        this.state = 'disconnected';
        this.stopPing();
        this.emit('stateChange', { state: this.state });
        this.emit('disconnected', { code: event.code, reason: event.reason });

        // Auto-reconnect with exponential backoff
        if (!event.wasClean) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        this.emit('error', { error });
      };
    } catch (err) {
      console.error('[WS] Connection failed:', err);
      this.state = 'disconnected';
      this.emit('stateChange', { state: this.state });
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopPing();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.state = 'disconnected';
    this.emit('stateChange', { state: this.state });
  }

  /**
   * Send message to server
   */
  send(message: WsMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[WS] Not connected');
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send auth message
   */
  private sendAuth(): void {
    this.send({
      type: 'auth',
      projectPath: this.projectPath || '',
    });
  }

  /**
   * Create a new session
   */
  createSession(title?: string): void {
    this.send({
      type: 'session.create',
      title,
    });
  }

  /**
   * Activate a session
   */
  activateSession(sessionId: string): void {
    this.send({
      type: 'session.activate',
      sessionId,
    });
  }

  /**
   * Send chat message
   */
  sendChatMessage(sessionId: string, content: string): void {
    this.send({
      type: 'chat.send',
      sessionId,
      content,
    });
  }

  /**
   * Request missed messages
   */
  syncSession(sessionId: string, lastSequenceId: number): void {
    this.send({
      type: 'session.sync',
      sessionId,
      lastSequenceId,
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: WsMessage): void {
    const { type } = message;

    // Handle auth result
    if (type === 'auth.result') {
      if (message.success) {
        this.state = 'authenticated';
        console.log('[WS] Authenticated');
      } else {
        console.error('[WS] Auth failed');
      }
      this.emit('stateChange', { state: this.state });
    }

    // Emit to specific handlers
    this.emit(type, message);

    // Emit to wildcard handlers
    this.emit('message', message);
  }

  /**
   * Schedule reconnection with exponential backoff and jitter
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnect attempts reached');
      this.emit('reconnectFailed', {});
      return;
    }

    const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    // Add jitter to prevent thundering herd on server restart
    const delay = Math.round(baseDelay * (0.5 + Math.random()));
    this.reconnectAttempts++;

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Start ping interval
   */
  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000);
  }

  /**
   * Stop ping interval
   */
  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Register message handler
   */
  on(type: string, handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  /**
   * Unregister message handler
   */
  off(type: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to handlers (public for custom events)
   */
  emit(type: string, data: any): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (err) {
          console.error(`[WS] Handler error for ${type}:`, err);
        }
      }
    }
  }

  /**
   * Get connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected and authenticated
   */
  isAuthenticated(): boolean {
    return this.state === 'authenticated';
  }

  /**
   * Get the current project path
   */
  getProjectPath(): string {
    return this.projectPath;
  }

  /**
   * Update project path for next auth message
   */
  setProjectPath(path: string): void {
    this.projectPath = path;
  }

  /**
   * Disconnect, update project path, and reconnect
   */
  reconnectWithProject(path: string): void {
    this.disconnect();
    this.projectPath = path;
    this.reconnectAttempts = 0;
    this.connect();
  }
}

// Singleton instance
let instance: WebSocketClient | null = null;

/**
 * Get WebSocket client instance
 */
export function getWebSocketClient(projectPath?: string): WebSocketClient {
  if (!instance) {
    instance = new WebSocketClient(projectPath);
  }
  return instance;
}

/**
 * Reset WebSocket client instance (for testing)
 */
export function resetWebSocketClient(): void {
  if (instance) {
    instance.disconnect();
    instance = null;
  }
}
