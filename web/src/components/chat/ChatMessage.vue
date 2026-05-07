<template>
  <div class="message" :class="[msg.type, { 'user-message': msg.type === 'user' }]">
    <div class="message-avatar">
      <span v-if="msg.type === 'user'">&#x1f464;</span>
      <span v-else-if="msg.type === 'agent'">{{ teamEmoji }}</span>
      <span v-else-if="msg.type === 'tool'">&#x1f527;</span>
      <span v-else>&#x2139;&#xfe0f;</span>
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-sender">{{ senderName }}</span>
        <span class="message-time">{{ formattedTime }}</span>
      </div>
      <div class="message-text">{{ msg.content }}</div>
      <div v-if="msg.taskId" class="message-task-id">任务: {{ msg.taskId }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ChatMessage } from '../../stores/chat';

const props = defineProps<{
  msg: ChatMessage;
}>();

const teamNames: Record<string, string> = { lead: 'Lead', dev: 'Dev', test: 'Test' };
const teamEmojis: Record<string, string> = { lead: '\ud83e\udd16', dev: '\ud83d\udcbb', test: '\ud83e\uddea' };

const senderName = computed(() => {
  if (props.msg.type === 'user') return '你';
  if (props.msg.team) return teamNames[props.msg.team] || props.msg.team;
  return '系统';
});

const teamEmoji = computed(() => {
  return props.msg.team ? (teamEmojis[props.msg.team] || '\ud83e\udd16') : '\ud83e\udd16';
});

const formattedTime = computed(() => {
  return props.msg.timestamp.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
});
</script>

<style scoped>
.message {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.message.user-message {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.message-content {
  flex: 1;
  max-width: 70%;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.message-sender {
  font-weight: 600;
  font-size: 13px;
  color: #333;
}

.message-time {
  font-size: 11px;
  color: #999;
}

.message-text {
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.user-message .message-text {
  background: #007bff;
  color: white;
}

.agent .message-text {
  background: #e3f2fd;
}

.tool .message-text {
  background: #f3e5f5;
  font-family: monospace;
  font-size: 12px;
}

.error .message-text {
  background: #fce4ec;
  color: #c62828;
}

.system .message-text {
  background: #f5f5f5;
  color: #666;
  font-style: italic;
}

.message-task-id {
  margin-top: 6px;
  font-size: 11px;
  color: #666;
  padding: 4px 8px;
  background: #f0f0f0;
  border-radius: 4px;
  display: inline-block;
}
</style>
