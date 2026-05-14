/**
 * Sync Protocol Message Types
 * Defines all message types for agent ↔ server ↔ browser synchronization
 */

// === Sync State Types ===
export type SyncStateType =
  | 'projects'
  | 'tasks'
  | 'reviews'
  | 'chat.messages'
  | 'scanner.status'
  | 'fixer.status'
  | 'config'
  | 'documents';

// === Full State Data ===
export interface FullStateData {
  projects?: any[];
  tasks?: any[];
  reviews?: any[];
  config?: Record<string, any>;
  scanner?: { status: string; lastRun?: string };
  fixer?: { status: string; lastRun?: string };
}

// === Agent → Server Messages ===
export interface AgentRegisterMessage {
  type: 'agent.register';
  token: string;
  name: string;
  hostname: string;
}

export interface AgentHeartbeatMessage {
  type: 'agent.heartbeat';
  agentId: string;
}

export interface SyncStateMessage {
  type: 'sync.state';
  agentId: string;
  stateType: SyncStateType;
  data: any;
}

export interface SyncFullMessage {
  type: 'sync.full';
  agentId: string;
  data: FullStateData;
}

export interface ChatStreamMessage {
  type: 'chat.stream';
  agentId: string;
  sessionId: string;
  content: string;
}

export interface ChatDoneMessage {
  type: 'chat.done';
  agentId: string;
  sessionId: string;
}

// === Server → Browser Messages ===
export interface ServerSyncStateMessage {
  type: 'sync.state';
  stateType: SyncStateType;
  data: any;
}

export interface ServerSyncFullMessage {
  type: 'sync.full';
  data: FullStateData;
}

export interface AgentOnlineMessage {
  type: 'agent.online';
  agentName: string;
  hostname: string;
}

export interface AgentOfflineMessage {
  type: 'agent.offline';
}

export interface ServerChatStreamMessage {
  type: 'chat.stream';
  sessionId: string;
  content: string;
}

export interface ServerChatDoneMessage {
  type: 'chat.done';
  sessionId: string;
}

// === Browser → Server → Agent Commands ===
export interface ChatSendCommand {
  type: 'chat.send';
  sessionId: string;
  content: string;
}

export interface ScanTriggerCommand {
  type: 'scan.trigger';
  projectName: string;
}

export interface FixTriggerCommand {
  type: 'fix.trigger';
}

export interface ConfigUpdateCommand {
  type: 'config.update';
  config: Record<string, any>;
}

// === Union Types ===
export type AgentMessage =
  | AgentRegisterMessage
  | AgentHeartbeatMessage
  | SyncStateMessage
  | SyncFullMessage
  | ChatStreamMessage
  | ChatDoneMessage;

export type ServerMessage =
  | ServerSyncStateMessage
  | ServerSyncFullMessage
  | AgentOnlineMessage
  | AgentOfflineMessage
  | ServerChatStreamMessage
  | ServerChatDoneMessage;

export type BrowserCommand =
  | ChatSendCommand
  | ScanTriggerCommand
  | FixTriggerCommand
  | ConfigUpdateCommand;
