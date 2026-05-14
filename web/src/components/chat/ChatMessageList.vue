<template>
  <div class="chat-messages" ref="containerRef">
    <ChatMessage v-for="msg in visibleMessages" :key="msg.id" :msg="msg" />

    <!-- Streaming thinking panel (DeepSeek style) -->
    <div v-if="thinkingContent || isThinking" class="thinking-panel">
      <div class="thinking-header" @click="toggleThinking">
        <svg class="thinking-icon" :class="{ spinning: isThinking }" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="thinking-label">{{ isThinking ? '思考中' : '思考过程' }}</span>
        <svg class="toggle-arrow" :class="{ collapsed: !thinkingExpanded }" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M2 4.5l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div v-show="thinkingExpanded" class="thinking-body">
        <pre class="thinking-text">{{ thinkingContent }}</pre>
      </div>
    </div>

    <div v-if="messages.length === 0 && !isThinking" class="empty-state">
      <p>开始对话 - 输入开发需求让 Agent 团队为你工作</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import ChatMessage from './ChatMessage.vue';
import type { ChatMessage as ChatMessageType } from '../../stores/chat';

const props = defineProps<{
  messages: ChatMessageType[];
  isThinking?: boolean;
  thinkingContent?: string;
  thinkingExpanded?: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-thinking'): void;
}>();

const containerRef = ref<HTMLElement | null>(null);

// Filter out tool messages from display (keep system messages for task creation feedback)
const visibleMessages = computed(() =>
  props.messages.filter(m => m.type !== 'tool_call' && m.type !== 'tool_result')
);

function toggleThinking() {
  emit('toggle-thinking');
}

watch(
  () => [visibleMessages.value.length, props.thinkingContent, props.isThinking],
  async () => {
    await nextTick();
    if (containerRef.value) {
      containerRef.value.scrollTop = containerRef.value.scrollHeight;
    }
  }
);
</script>

<style scoped>
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  margin-bottom: 16px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  font-size: 14px;
}

/* Thinking panel - DeepSeek style */
.thinking-panel {
  margin-bottom: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  animation: fadeIn 0.3s ease;
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: #f9fafb;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}

.thinking-header:hover {
  background: #f3f4f6;
}

.thinking-icon {
  color: #6366f1;
  flex-shrink: 0;
}

.thinking-icon.spinning {
  animation: spin 1.2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.thinking-label {
  font-size: 13px;
  font-weight: 500;
  color: #6366f1;
  flex: 1;
}

.toggle-arrow {
  color: #9ca3af;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.toggle-arrow.collapsed {
  transform: rotate(-90deg);
}

.thinking-body {
  padding: 12px 14px;
  background: #fafafa;
  border-top: 1px solid #e5e7eb;
}

.thinking-text {
  margin: 0;
  font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: #6b7280;
  white-space: pre-wrap;
  word-break: break-word;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
