/**
 * Teams API Client
 * Handles team configuration and session API calls
 */

import { apiClient, unwrap } from './client';

// Types
export interface TeamConfig {
  name: string;
  displayName: string;
  model: string;
  maxTurns: number;
  allowedTools: string[];
  disallowedTools?: string[];
  timeout: number;
  skills?: string[];
}

export interface TeamStatus {
  name: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  currentTask?: string;
  lastActivity?: string;
  error?: string;
}

// Team API
export const teamsApi = {
  /**
   * Get all team configurations
   */
  async getAll(): Promise<TeamConfig[]> {
    return unwrap(apiClient.get<TeamConfig[]>('/teams'));
  },

  /**
   * Get single team configuration
   */
  async get(name: string): Promise<TeamConfig> {
    return unwrap(apiClient.get<TeamConfig>(`/teams/${name}`));
  },

  /**
   * Update team configuration
   */
  async update(name: string, config: Partial<TeamConfig>): Promise<TeamConfig> {
    return unwrap(apiClient.put<TeamConfig>(`/teams/${name}`, config as Record<string, unknown>));
  },

  /**
   * Get team status
   */
  async getStatus(name: string): Promise<TeamStatus> {
    return unwrap(apiClient.get<TeamStatus>(`/teams/${name}/status`));
  },

  /**
   * Get all team statuses
   */
  async getAllStatuses(): Promise<TeamStatus[]> {
    return unwrap(apiClient.get<TeamStatus[]>('/teams/status/all'));
  },

  /**
   * Test team connectivity
   */
  async test(name: string): Promise<{ success: boolean; message: string }> {
    return unwrap(apiClient.post<{ success: boolean; message: string }>(`/teams/${name}/test`, {}));
  },

  /**
   * Abort team execution
   */
  async abort(name: string): Promise<void> {
    await unwrap(apiClient.post<void>(`/teams/${name}/abort`, {}));
  },

  /**
   * Abort all teams
   */
  async abortAll(): Promise<void> {
    await unwrap(apiClient.post<void>('/teams/abort-all', {}));
  },
};

// Re-export canonical session types from shared type definitions
export type { Session, SessionMessage } from '../types/session';
import type { Session, SessionMessage } from '../types/session';

// Session API (REST endpoints)
export const sessionsApi = {
  /**
   * List sessions for a project
   */
  async list(projectPath?: string): Promise<Session[]> {
    const params = projectPath ? `?projectPath=${encodeURIComponent(projectPath)}` : '';
    return unwrap(apiClient.get<Session[]>(`/sessions${params}`));
  },

  /**
   * Get session by ID
   */
  async get(sessionId: string): Promise<Session> {
    return unwrap(apiClient.get<Session>(`/sessions/${sessionId}`));
  },

  /**
   * Get messages for a session
   */
  async getMessages(sessionId: string, afterSeq?: number): Promise<SessionMessage[]> {
    const params = afterSeq !== undefined ? `?afterSeq=${afterSeq}` : '';
    return unwrap(apiClient.get<SessionMessage[]>(`/sessions/${sessionId}/messages${params}`));
  },

  /**
   * Update session (title, etc.)
   */
  async update(sessionId: string, data: Partial<Session>): Promise<Session> {
    return unwrap(apiClient.put<Session>(`/sessions/${sessionId}`, data as Record<string, unknown>));
  },

  /**
   * Archive (soft delete) a session
   */
  async archive(sessionId: string): Promise<void> {
    await unwrap(apiClient.delete<void>(`/sessions/${sessionId}`));
  },
};
