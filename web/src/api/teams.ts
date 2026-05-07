/**
 * Teams API Client
 * Handles team configuration and chat API calls
 */

const API_BASE = '/api';

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

export interface ChatEvent {
  type: string;
  team: string;
  content: string;
  taskId?: string;
  metadata?: Record<string, any>;
}

// Helper function for API calls
async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || 'API call failed');
  }

  return response.json();
}

// Team API
export const teamsApi = {
  /**
   * Get all team configurations
   */
  async getAll(): Promise<TeamConfig[]> {
    return apiCall('/teams');
  },

  /**
   * Get single team configuration
   */
  async get(name: string): Promise<TeamConfig> {
    return apiCall(`/teams/${name}`);
  },

  /**
   * Update team configuration
   */
  async update(name: string, config: Partial<TeamConfig>): Promise<TeamConfig> {
    return apiCall(`/teams/${name}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },

  /**
   * Get team status
   */
  async getStatus(name: string): Promise<TeamStatus> {
    return apiCall(`/teams/${name}/status`);
  },

  /**
   * Get all team statuses
   */
  async getAllStatuses(): Promise<TeamStatus[]> {
    return apiCall('/teams/status/all');
  },

  /**
   * Test team connectivity
   */
  async test(name: string): Promise<{ success: boolean; message: string }> {
    return apiCall(`/teams/${name}/test`, {
      method: 'POST',
    });
  },

  /**
   * Abort team execution
   */
  async abort(name: string): Promise<void> {
    await apiCall(`/teams/${name}/abort`, {
      method: 'POST',
    });
  },

  /**
   * Abort all teams
   */
  async abortAll(): Promise<void> {
    await apiCall('/teams/abort-all', {
      method: 'POST',
    });
  },
};

// Chat API
export const chatApi = {
  /**
   * Create SSE stream for real-time updates
   */
  createStream(): EventSource {
    return new EventSource(`${API_BASE}/chat/stream`);
  },

  /**
   * Send chat message
   */
  async send(message: string): Promise<Response> {
    return fetch(`${API_BASE}/chat/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });
  },
};
