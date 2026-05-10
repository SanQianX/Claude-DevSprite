/**
 * Session and Tool Call types for the chat system
 * Canonical type definitions matching the backend sessionManager.ts
 */

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

export interface ToolCallInfo {
  id: string;
  sessionId: string;
  messageId?: string;
  team: string;
  toolName: string;
  toolArgs?: Record<string, any>;
  toolResult?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  createdAt: string;
}

export interface CreateSessionParams {
  title?: string;
  projectPath?: string;
}
