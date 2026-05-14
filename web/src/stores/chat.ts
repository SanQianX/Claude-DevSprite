/**
 * Chat Store
 * Manages chat messages and sessions via WebSocket connection
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getWebSocketClient, type WsMessage, type ConnectionState } from '../api/websocket';
import type { Session, SessionMessage } from '../types/session';
import { dashboardApi } from '../api/dashboard';

export interface ChatMessage {
  id: string;
  type: 'user' | 'agent' | 'tool_call' | 'tool_result' | 'error' | 'system';
  team?: string;
  content: string;
  timestamp: Date;
  sessionId?: string;
  sequenceId?: number;
  metadata?: Record<string, any>;
  isStreaming?: boolean;
}

// Valid message types — module-level constant for O(1) lookup on hot path
const VALID_MESSAGE_TYPES = new Set<ChatMessage['type']>([
  'user', 'agent', 'tool_call', 'tool_result', 'error', 'system'
]);

export const useChatStore = defineStore('chat', () => {
  // State
  const messages = ref<ChatMessage[]>([]);
  const sessions = ref<Session[]>([]);
  const isConnected = ref(false);
  const isAuthenticated = ref(false);
  const isSending = ref(false);
  const error = ref<string | null>(null);
  const activeSessionId = ref<string | null>(null);
  const isThinking = ref(false);
  const thinkingContent = ref('');
  const thinkingExpanded = ref(true);

  // Sync state (remote mode)
  const agentOnline = ref(false);
  const agentName = ref('');

  // WebSocket client
  let wsClient = getWebSocketClient();
  let _handlersRegistered = false;
  let currentProjectPath: string | null = null;

  // Event handler registry — single source of truth for on/off pairing
  const eventHandlers: [string, (data: WsMessage) => void][] = [
    ['stateChange', handleStateChange],
    ['auth.result', handleAuthResult],
    ['session.list', handleSessionList],
    ['session.created', handleSessionCreated],
    ['session.activated', handleSessionActivated],
    ['chat.message', handleChatMessage],
    ['chat.stream', handleChatStream],
    ['chat.thinking', handleThinking],
    ['chat.done', handleDone],
    ['session.sync.result', handleSyncResult],
    ['sync.state', handleSyncState],
    ['sync.full', handleSyncFull],
    ['agent.online', handleAgentOnline],
    ['agent.offline', handleAgentOffline],
    ['chat.error', handleChatError],
    ['error', handleError],
    ['disconnected', handleDisconnected],
  ];

  // Computed
  const agentMessages = computed(() =>
    messages.value.filter(m => m.type === 'agent')
  );

  const toolMessages = computed(() =>
    messages.value.filter(m => m.type === 'tool_call' || m.type === 'tool_result')
  );

  const activeSession = computed(() =>
    sessions.value.find(s => s.id === activeSessionId.value) || null
  );

  // Actions
  function connect(projectPath?: string) {
    // If projectPath changed, disconnect and reconnect with new path
    if (projectPath !== undefined && projectPath !== currentProjectPath) {
      currentProjectPath = projectPath;
      // Extract project name from path (last segment)
      currentProjectName = projectPath ? projectPath.split(/[/\\]/).pop() || null : null;
      // Unregister existing handlers before disconnect
      if (_handlersRegistered) {
        for (const [event, handler] of eventHandlers) {
          wsClient.off(event, handler);
        }
        _handlersRegistered = false;
      }
      // Reset state for new project
      messages.value = [];
      sessions.value = [];
      activeSessionId.value = null;
      isThinking.value = false;
      thinkingContent.value = '';
      thinkingExpanded.value = true;
      // Reconnect with new project path (handles disconnect + connect internally)
      wsClient.reconnectWithProject(projectPath);
      // Register handlers for the new connection
      _handlersRegistered = true;
      for (const [event, handler] of eventHandlers) {
        wsClient.on(event, handler);
      }
      return;
    }

    if (_handlersRegistered) return;
    _handlersRegistered = true;

    for (const [event, handler] of eventHandlers) {
      wsClient.on(event, handler);
    }

    wsClient.connect();
  }

  function disconnect() {
    if (!_handlersRegistered) return;

    for (const [event, handler] of eventHandlers) {
      wsClient.off(event, handler);
    }

    wsClient.disconnect();
    isConnected.value = false;
    isAuthenticated.value = false;
    _handlersRegistered = false;
  }

  // Event handlers
  function handleStateChange(data: WsMessage) {
    const state = data.state as ConnectionState;
    isConnected.value = state === 'connected' || state === 'authenticated';
    isAuthenticated.value = state === 'authenticated';
  }

  function handleAuthResult(data: WsMessage) {
    if (!data.success) {
      error.value = '认证失败';
      addSystemMessage('认证失败');
    }
    // Success is handled by handleStateChange setting isAuthenticated
  }

  function handleSessionList(data: WsMessage) {
    sessions.value = data.sessions || [];
  }

  function handleSessionCreated(data: WsMessage) {
    const session = data.session as Session;
    activeSessionId.value = session.id;
    // Add new session to list so sidebar can display it
    if (!sessions.value.find(s => s.id === session.id)) {
      sessions.value = [session, ...sessions.value];
    }
    messages.value = [];
  }

  function handleSessionActivated(data: WsMessage) {
    const { sessionId, messages: sessionMessages } = data;
    activeSessionId.value = sessionId;

    // Load messages from session
    if (sessionMessages && Array.isArray(sessionMessages)) {
      messages.value = sessionMessages.map(mapSessionMessage);
    } else {
      messages.value = [];
    }
  }

  function handleChatMessage(data: WsMessage) {
    const { sessionId, message } = data;

    // Only add if it's for our active session
    if (sessionId === activeSessionId.value) {
      const chatMessage = mapSessionMessage(message);

      // Remove streaming message if this is an agent message
      if (chatMessage.type === 'agent') {
        const streamIndex = messages.value.findIndex(m => m.id === `stream-${sessionId}`);
        if (streamIndex >= 0) {
          messages.value.splice(streamIndex, 1);
        }
      }

      messages.value.push(chatMessage);
    }
  }

  function handleChatStream(data: WsMessage) {
    const { sessionId, content, team } = data;

    // Only handle if it's for our active session
    if (sessionId !== activeSessionId.value) return;

    // Find or create the streaming message
    const streamId = `stream-${sessionId}`;
    const existingIndex = messages.value.findIndex(m => m.id === streamId);

    if (existingIndex >= 0) {
      // Update existing streaming message
      messages.value[existingIndex] = {
        ...messages.value[existingIndex],
        content,
      };
    } else {
      // Create new streaming message
      messages.value.push({
        id: streamId,
        type: 'agent',
        team,
        content,
        timestamp: new Date(),
        isStreaming: true,
      });
    }
  }

  function handleThinking(data: WsMessage) {
    if (data.sessionId !== activeSessionId.value) return;
    isThinking.value = true;
    if (data.content) {
      thinkingContent.value += data.content + '\n';
    }
  }

  function handleDone(_data: WsMessage) {
    isThinking.value = false;
    thinkingExpanded.value = false;

    // Auto-create tasks from AI response markers
    if (currentProjectName) {
      handleSuggestedTasks(currentProjectName).catch(() => {
        // Error handling is done inside handleSuggestedTasks
      });
    }
  }

  function handleSyncState(data: WsMessage) {
    // Received incremental state update from server
    const { stateType, stateData } = data;
    // For now, just log — specific state types can update relevant stores
    console.log(`[Sync] State update: ${stateType}`);
  }

  function handleSyncFull(data: WsMessage) {
    // Received full state snapshot from server
    const { stateData } = data;
    console.log('[Sync] Full state received', stateData?.projects?.length || 0, 'projects');
  }

  function handleAgentOnline(data: WsMessage) {
    agentOnline.value = true;
    agentName.value = data.agentName || '';
    addSystemMessage(`本地机器已连接: ${data.agentName}@${data.hostname}`);
  }

  function handleAgentOffline() {
    agentOnline.value = false;
    agentName.value = '';
    addSystemMessage('本地机器已断开连接');
  }

  function handleChatError(data: WsMessage) {
    addSystemMessage(`错误: ${data.message || 'Unknown error'}`);
  }

  function handleSyncResult(data: WsMessage) {
    const { sessionId, messages: syncedMessages } = data;

    if (sessionId === activeSessionId.value && Array.isArray(syncedMessages)) {
      // Batch into single reactive update to avoid N individual re-renders
      const existingIds = new Set(messages.value.map(m => m.id));
      const newMsgs = syncedMessages
        .map(mapSessionMessage)
        .filter(m => !existingIds.has(m.id));
      if (newMsgs.length > 0) {
        messages.value = [...messages.value, ...newMsgs]
          .sort((a, b) => (a.sequenceId || 0) - (b.sequenceId || 0));
      }
    }
  }

  function handleError(data: WsMessage) {
    error.value = data.message || '发生错误';
    addSystemMessage(`错误: ${error.value}`);
  }

  function handleDisconnected(_data: WsMessage) {
    isConnected.value = false;
    isAuthenticated.value = false;
    addSystemMessage('连接断开，正在重连...');
  }

  // Helper to map session message to chat message
  function mapSessionMessage(msg: SessionMessage): ChatMessage {
    return {
      id: msg.id || generateId(),
      type: VALID_MESSAGE_TYPES.has(msg.type) ? msg.type : 'system',
      team: msg.team,
      content: msg.content,
      timestamp: new Date(msg.timestamp || Date.now()),
      sessionId: msg.sessionId,
      sequenceId: msg.sequenceId,
      metadata: msg.metadata,
    };
  }

  async function sendMessage(content: string) {
    if (!content.trim() || isSending.value) return;

    // Create a new session if none active
    if (!activeSessionId.value) {
      await createSessionAndWait();
      if (!activeSessionId.value) {
        error.value = '无法创建会话';
        return;
      }
    }

    isSending.value = true;
    error.value = null;
    // Reset thinking state for new message
    isThinking.value = false;
    thinkingContent.value = '';
    thinkingExpanded.value = true;

    try {
      wsClient.sendChatMessage(activeSessionId.value, content);
    } catch (err: any) {
      error.value = err.message || '发送失败';
      addSystemMessage(`发送失败: ${error.value}`);
    } finally {
      isSending.value = false;
    }
  }

  /**
   * Create a session and wait for server confirmation via Promise
   */
  function createSessionAndWait(title?: string, timeoutMs = 5000): Promise<Session | null> {
    return new Promise((resolve) => {
      if (activeSessionId.value) {
        // Already have an active session
        resolve(activeSession.value);
        return;
      }

      const timeout = setTimeout(() => {
        wsClient.off('session.created', onCreated);
        resolve(null);
      }, timeoutMs);

      function onCreated(data: WsMessage) {
        clearTimeout(timeout);
        wsClient.off('session.created', onCreated);
        resolve(data.session as Session);
      }

      wsClient.on('session.created', onCreated);
      wsClient.createSession(title);
    });
  }

  function createSession(title?: string) {
    wsClient.createSession(title);
  }

  function activateSession(sessionId: string) {
    wsClient.activateSession(sessionId);
  }

  function syncSession(lastSequenceId: number) {
    if (activeSessionId.value) {
      wsClient.syncSession(activeSessionId.value, lastSequenceId);
    }
  }

  function addSystemMessage(content: string) {
    const message: ChatMessage = {
      id: generateId(),
      type: 'system',
      content,
      timestamp: new Date(),
    };
    messages.value.push(message);
  }

  function clearMessages() {
    messages.value = [];
  }

  function deleteSession(sessionId: string) {
    sessions.value = sessions.value.filter(s => s.id !== sessionId);
    if (activeSessionId.value === sessionId) {
      const next = sessions.value[0];
      if (next) {
        activateSession(next.id);
      } else {
        clearMessages();
      }
    }
  }

  function generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  // ─── Current project name for auto task creation ────────────────────────
  let currentProjectName: string | null = null;

  // ─── /task Command ──────────────────────────────────────────────────────

  const TASK_COMMAND_RE = /^\/task\s+(.+)/i;

  function parseTaskCommand(content: string): { title: string; description?: string; priority?: string; status?: string } | null {
    const match = content.trim().match(TASK_COMMAND_RE);
    if (!match) return null;

    let rest = match[1].trim();
    const result: { title: string; description?: string; priority?: string; status?: string } = { title: '' };

    // Extract --priority <value>
    const priorityMatch = rest.match(/--priority\s+(high|medium|low|critical)/i);
    if (priorityMatch) {
      result.priority = priorityMatch[1].toLowerCase();
      rest = rest.replace(/--priority\s+\S+/i, '').trim();
    }

    // Extract --status <value>
    const statusMatch = rest.match(/--status\s+(backlog|todo|in_progress|review|done)/i);
    if (statusMatch) {
      result.status = statusMatch[1].toLowerCase();
      rest = rest.replace(/--status\s+\S+/i, '').trim();
    }

    // Extract --desc <value> (optional description)
    const descMatch = rest.match(/--desc\s+"([^"]+)"/i) || rest.match(/--desc\s+(\S+)/i);
    if (descMatch) {
      result.description = descMatch[1];
      rest = rest.replace(/--desc\s+"[^"]*"/i, '').replace(/--desc\s+\S+/i, '').trim();
    }

    // Remaining text is the title
    result.title = rest.replace(/\s+/g, ' ').trim();
    return result.title ? result : null;
  }

  // ─── Auto Task Creation from AI Response ────────────────────────────────

  // Match [TASK: title] or [TASK: title | priority: high | status: todo | desc: ...]
  const TASK_MARKER_RE = /\[TASK:\s*([^\]]+)\]/gi;

  function parseTaskMarkers(content: string): Array<{ title: string; description?: string; priority?: string; status?: string }> {
    const tasks: Array<{ title: string; description?: string; priority?: string; status?: string }> = [];
    let match;

    while ((match = TASK_MARKER_RE.exec(content)) !== null) {
      const parts = match[1].split('|').map(s => s.trim());
      const task: { title: string; description?: string; priority?: string; status?: string } = {
        title: parts[0],
      };

      for (const part of parts.slice(1)) {
        const colonIdx = part.indexOf(':');
        if (colonIdx === -1) continue;
        const key = part.slice(0, colonIdx).trim().toLowerCase();
        const value = part.slice(colonIdx + 1).trim();
        switch (key) {
          case 'priority':
            task.priority = value;
            break;
          case 'status':
            task.status = value;
            break;
          case 'desc':
          case 'description':
            task.description = value;
            break;
        }
      }

      if (task.title) tasks.push(task);
    }

    return tasks;
  }

  async function handleSuggestedTasks(projectName: string) {
    // Find the last agent message
    const lastAgentMsg = [...messages.value].reverse().find(m => m.type === 'agent');
    if (!lastAgentMsg) return;

    const tasks = parseTaskMarkers(lastAgentMsg.content);
    if (tasks.length === 0) return;

    try {
      const result = await dashboardApi.batchCreateTasks(projectName, tasks);
      addSystemMessage(`AI 建议的任务已自动创建 (${result.tasks.length} 个): ${result.tasks.map(t => `#${t.id} ${t.title}`).join(', ')}`);
    } catch (err: any) {
      addSystemMessage(`自动创建任务失败: ${err.message || '未知错误'}`);
    }
  }

  async function handleTaskCommand(content: string, projectName: string): Promise<boolean> {
    const parsed = parseTaskCommand(content);
    if (!parsed) return false;

    try {
      const task = await dashboardApi.createTask(projectName, {
        title: parsed.title,
        description: parsed.description,
        priority: parsed.priority || 'medium',
        status: parsed.status || 'backlog',
      });
      addSystemMessage(`任务已创建: #${task.id} ${task.title} (优先级: ${task.priority}, 状态: ${task.status})`);
      return true;
    } catch (err: any) {
      addSystemMessage(`创建任务失败: ${err.message || '未知错误'}`);
      return true; // still consumed the command
    }
  }

  return {
    // State
    messages,
    sessions,
    isConnected,
    isAuthenticated,
    isSending,
    error,
    activeSessionId,
    isThinking,
    thinkingContent,
    thinkingExpanded,

    // Sync state
    agentOnline,
    agentName,

    // Computed
    agentMessages,
    toolMessages,
    activeSession,

    // Actions
    connect,
    disconnect,
    sendMessage,
    createSession,
    createSessionAndWait,
    activateSession,
    syncSession,
    deleteSession,
    addSystemMessage,
    clearMessages,
    handleTaskCommand,
    handleSuggestedTasks,
  };
});
