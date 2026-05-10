/**
 * Session Manager
 * Manages chat sessions with file-based persistence
 * Uses JSON files for storage (consistent with fileProtocol.ts pattern)
 */

import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('session-manager');

// Session data structure
export interface Session {
  id: string;
  projectPath: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'archived';
  metadata: {
    model?: string;
    teamConfig?: string[];
    messageCount: number;
  };
}

// Message data structure
export interface SessionMessage {
  id: string;
  sessionId: string;
  sequenceId: number;
  type: 'user' | 'agent' | 'tool_call' | 'tool_result' | 'system' | 'error';
  team?: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

// Message input (without generated fields)
interface MessageInput {
  type: string;
  team?: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Manages chat sessions with file-based persistence
 */
export class SessionManager {
  private basePath: string;
  private sessions: Map<string, Session> = new Map();
  private messages: Map<string, SessionMessage[]> = new Map();
  private sequenceCounters: Map<string, number> = new Map();
  // Write queues per file path to serialize concurrent writes
  private writeQueues: Map<string, Promise<void>> = new Map();

  constructor(basePath?: string) {
    this.basePath = basePath || path.join(
      process.env.HOME || process.env.USERPROFILE || '.',
      '.claude',
      'claude-dev-sprite',
      'sessions'
    );
    fs.mkdirSync(this.basePath, { recursive: true });
    this.loadSessions();
  }

  /**
   * Create a new session
   */
  createSession(projectPath: string, title?: string): Session {
    const id = this.generateId();
    const now = Date.now();

    const session: Session = {
      id,
      projectPath,
      title: title || `Session ${new Date().toLocaleString('zh-CN')}`,
      createdAt: now,
      updatedAt: now,
      status: 'active',
      metadata: {
        messageCount: 0,
      },
    };

    this.sessions.set(id, session);
    this.messages.set(id, []);
    this.sequenceCounters.set(id, 0);

    // Persist to file
    this.saveSession(session);

    logger.info(`Created session: ${id} for project: ${projectPath}`);
    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get active session for a project (most recent non-archived)
   */
  getActiveSession(projectPath: string): Session | undefined {
    let activeSession: Session | undefined;

    for (const session of this.sessions.values()) {
      if (session.projectPath === projectPath && session.status === 'active') {
        if (!activeSession || session.updatedAt > activeSession.updatedAt) {
          activeSession = session;
        }
      }
    }

    return activeSession;
  }

  /**
   * Get all sessions for a project
   */
  getSessions(projectPath: string): Session[] {
    const sessions: Session[] = [];

    for (const session of this.sessions.values()) {
      if (session.projectPath === projectPath) {
        sessions.push(session);
      }
    }

    // Sort by updatedAt descending
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Archive a session
   */
  archiveSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = 'archived';
    session.updatedAt = Date.now();

    this.saveSession(session);
    logger.info(`Archived session: ${sessionId}`);

    return true;
  }

  /**
   * Update session title
   */
  updateSessionTitle(sessionId: string, title: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.title = title;
    session.updatedAt = Date.now();

    this.saveSession(session);
    return true;
  }

  /**
   * Add a message to a session
   */
  addMessage(sessionId: string, input: MessageInput): SessionMessage {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Get next sequence ID
    const sequenceId = (this.sequenceCounters.get(sessionId) || 0) + 1;
    this.sequenceCounters.set(sessionId, sequenceId);

    const message: SessionMessage = {
      id: this.generateId(),
      sessionId,
      sequenceId,
      type: input.type as SessionMessage['type'],
      team: input.team,
      content: input.content,
      timestamp: input.timestamp,
      metadata: input.metadata,
    };

    // Add to in-memory list
    const messages = this.messages.get(sessionId) || [];
    messages.push(message);
    this.messages.set(sessionId, messages);

    // Update session metadata
    session.metadata.messageCount = messages.length;
    session.updatedAt = Date.now();

    // Persist message
    this.saveMessage(sessionId, message);
    this.saveSession(session);

    return message;
  }

  /**
   * Get all messages for a session
   */
  getMessages(sessionId: string): SessionMessage[] {
    return this.messages.get(sessionId) || [];
  }

  /**
   * Get messages after a specific sequence ID
   */
  getMessagesAfter(sessionId: string, afterSequenceId: number): SessionMessage[] {
    const messages = this.messages.get(sessionId) || [];
    return messages.filter(m => m.sequenceId > afterSequenceId);
  }

  /**
   * Load sessions from disk
   */
  private loadSessions(): void {
    try {
      const files = fs.readdirSync(this.basePath);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.basePath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const session = JSON.parse(content) as Session;

        this.sessions.set(session.id, session);

        // Load messages for this session
        this.loadMessages(session.id);
      }

      logger.info(`Loaded ${this.sessions.size} sessions from disk`);
    } catch (error) {
      // Directory might not exist yet
      logger.info('No existing sessions found');
    }
  }

  /**
   * Load messages for a session
   */
  private loadMessages(sessionId: string): void {
    const messagesDir = path.join(this.basePath, sessionId, 'messages');

    try {
      if (!fs.existsSync(messagesDir)) {
        this.messages.set(sessionId, []);
        return;
      }

      const files = fs.readdirSync(messagesDir);
      const messages: SessionMessage[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(messagesDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const message = JSON.parse(content) as SessionMessage;
        messages.push(message);
      }

      // Sort by sequenceId
      messages.sort((a, b) => a.sequenceId - b.sequenceId);

      this.messages.set(sessionId, messages);

      // Update sequence counter (use loop to avoid stack overflow with large arrays)
      let maxSeq = 0;
      for (const msg of messages) {
        if (msg.sequenceId > maxSeq) maxSeq = msg.sequenceId;
      }
      if (maxSeq > 0) {
        this.sequenceCounters.set(sessionId, maxSeq);
      }
    } catch (error) {
      logger.warn(`Failed to load messages for session ${sessionId}: ${error}`);
      this.messages.set(sessionId, []);
    }
  }

  /**
   * Save session to disk (async, fire-and-forget)
   * Serialized per file to prevent concurrent write corruption
   */
  private saveSession(session: Session): void {
    const filePath = path.join(this.basePath, `${session.id}.json`);
    const prev = this.writeQueues.get(filePath) || Promise.resolve();
    const next = prev.then(() =>
      fsPromises.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8')
    ).catch(err => {
      logger.error(`Failed to save session ${session.id}: ${err.message}`);
    });
    this.writeQueues.set(filePath, next);
    // Clean up completed entry
    next.finally(() => {
      if (this.writeQueues.get(filePath) === next) {
        this.writeQueues.delete(filePath);
      }
    });
  }

  /**
   * Save message to disk (async, fire-and-forget)
   */
  private saveMessage(sessionId: string, message: SessionMessage): void {
    const messagesDir = path.join(this.basePath, sessionId, 'messages');
    // mkdirSync with recursive: true is idempotent — no TOCTOU risk
    fs.mkdirSync(messagesDir, { recursive: true });

    const filePath = path.join(messagesDir, `${message.sequenceId.toString().padStart(6, '0')}.json`);
    fsPromises.writeFile(filePath, JSON.stringify(message, null, 2), 'utf-8').catch(err => {
      logger.error(`Failed to save message in session ${sessionId}: ${err.message}`);
    });
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Wait for all pending file writes to complete
   */
  async flush(): Promise<void> {
    const pending = Array.from(this.writeQueues.values());
    await Promise.all(pending);
  }
}
