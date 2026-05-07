/**
 * Multi-Agent Team System - Type Definitions
 * Unified types for TeamExecutor, FileProtocol, TeamManager
 */

// ============================================================================
// AgentEvent - Unified event type for all Team outputs
// ============================================================================

export type AgentEventType =
  | 'agent_message'
  | 'tool_call'
  | 'tool_result'
  | 'file_change'
  | 'error'
  | 'completed';

export type TeamName = 'lead' | 'dev' | 'test';

export interface AgentEvent {
  type: AgentEventType;
  team: TeamName;
  content: string;
  metadata?: {
    toolName?: string;
    toolArgs?: Record<string, any>;
    filePath?: string;
    fileAction?: 'created' | 'modified' | 'deleted';
    duration?: number;
    tokenUsage?: { prompt: number; completion: number };
  };
}

// ============================================================================
// Team Configuration
// ============================================================================

export interface TeamConfig {
  name: TeamName;
  displayName: string;
  model: string;
  maxTurns: number;
  allowedTools: string[];
  disallowedTools?: string[];
  timeout: number;
  skills?: string[];
  skillConfig?: Record<string, any>;
}

export interface GlobalSettings {
  version: string;
  projectName: string;
  teams: Record<TeamName, {
    enabled: boolean;
    displayName: string;
    description: string;
  }>;
  communication: {
    protocol: 'file-based';
    pollInterval: number;
    taskTimeout: number;
  };
  knowledge: {
    autoUpdateOnCommit: boolean;
    knowledgePath: string;
    developmentPath: string;
  };
}

// ============================================================================
// Task & Result - File Protocol types
// ============================================================================

export type TaskType = 'development' | 'testing' | 'design' | 'review';
export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface Task {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  assignedTo: TeamName;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  createdAt: string;
  status: TaskStatus;
  context?: string;
}

export interface TaskResult {
  taskId: string;
  status: 'completed' | 'failed';
  completedAt: string;
  model: string;
  summary: string;
  changedFiles: string[];
  error?: string;
}

// ============================================================================
// TeamExecutor Configuration
// ============================================================================

export interface TeamExecutorConfig {
  model: string;
  maxTurns: number;
  allowedTools: string[];
  disallowedTools?: string[];
  timeout?: number;
}

// ============================================================================
// Chat Events - SSE stream types
// ============================================================================

export type ChatEventType =
  | 'agent_message'
  | 'task_assigned'
  | 'task_completed'
  | 'tool_call'
  | 'tool_result'
  | 'file_change'
  | 'error'
  | 'completed';

export interface ChatEvent {
  type: ChatEventType;
  team: TeamName;
  content: string;
  taskId?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// Team Status
// ============================================================================

export type TeamStatusType = 'idle' | 'busy' | 'error' | 'offline';

export interface TeamStatus {
  name: TeamName;
  status: TeamStatusType;
  currentTask?: string;
  lastActivity?: string;
  error?: string;
}

// ============================================================================
// Development Session
// ============================================================================

export interface DevSession {
  id: string;
  projectPath: string;
  startedAt: string;
  endedAt?: string;
  status: 'active' | 'completed' | 'failed';
  tasks: Task[];
  results: TaskResult[];
}

// ============================================================================
// Skill System
// ============================================================================

export interface Skill {
  name: string;
  description: string;
  tools: ToolDefinition[];
  initialize(config: any): Promise<void>;
  cleanup(): Promise<void>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (args: any) => Promise<any>;
}
