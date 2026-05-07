/**
 * Chat Store
 * Manages chat messages and SSE connection
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { chatApi, type ChatEvent } from '../api/teams';

export interface ChatMessage {
  id: string;
  type: 'user' | 'agent' | 'tool' | 'error' | 'system';
  team?: string;
  content: string;
  timestamp: Date;
  taskId?: string;
  metadata?: Record<string, any>;
}

export const useChatStore = defineStore('chat', () => {
  // State
  const messages = ref<ChatMessage[]>([]);
  const isConnected = ref(false);
  const isSending = ref(false);
  const error = ref<string | null>(null);
  let eventSource: EventSource | null = null;

  // Computed
  const agentMessages = computed(() =>
    messages.value.filter(m => m.type === 'agent')
  );

  const toolMessages = computed(() =>
    messages.value.filter(m => m.type === 'tool')
  );

  // Actions
  function connect() {
    if (eventSource) {
      eventSource.close();
    }

    eventSource = chatApi.createStream();

    eventSource.onopen = () => {
      isConnected.value = true;
      error.value = null;
      addSystemMessage('已连接到服务器');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ChatEvent;
        handleChatEvent(data);
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = () => {
      isConnected.value = false;
      error.value = '连接断开，正在重连...';
      addSystemMessage('连接断开');

      // Reconnect after 3 seconds
      setTimeout(() => {
        if (!isConnected.value) {
          connect();
        }
      }, 3000);
    };
  }

  function disconnect() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
      isConnected.value = false;
    }
  }

  function handleChatEvent(event: ChatEvent) {
    const message: ChatMessage = {
      id: generateId(),
      type: mapEventType(event.type),
      team: event.team,
      content: event.content,
      timestamp: new Date(),
      taskId: event.taskId,
      metadata: event.metadata,
    };

    messages.value.push(message);

    // Auto-scroll to bottom
    scrollToBottom();
  }

  async function sendMessage(content: string) {
    if (!content.trim() || isSending.value) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      type: 'user',
      content,
      timestamp: new Date(),
    };
    messages.value.push(userMessage);

    isSending.value = true;
    error.value = null;

    try {
      await chatApi.send(content);
    } catch (err: any) {
      error.value = err.message || '发送失败';
      addSystemMessage(`发送失败: ${error.value}`);
    } finally {
      isSending.value = false;
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

  function mapEventType(eventType: string): ChatMessage['type'] {
    switch (eventType) {
      case 'agent_message':
        return 'agent';
      case 'tool_call':
      case 'tool_result':
        return 'tool';
      case 'error':
        return 'error';
      default:
        return 'system';
    }
  }

  function generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function scrollToBottom() {
    setTimeout(() => {
      const container = document.querySelector('.chat-messages');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 100);
  }

  return {
    // State
    messages,
    isConnected,
    isSending,
    error,

    // Computed
    agentMessages,
    toolMessages,

    // Actions
    connect,
    disconnect,
    sendMessage,
    addSystemMessage,
    clearMessages,
  };
});
