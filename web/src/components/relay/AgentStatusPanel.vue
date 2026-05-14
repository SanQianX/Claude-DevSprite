<script setup lang="ts">
import { computed } from 'vue'
import { useChatStore } from '../../stores/chat'

const chatStore = useChatStore()
const isOnline = computed(() => chatStore.agentOnline)
const agentDisplayName = computed(() => chatStore.agentName || 'unknown')
</script>

<template>
  <div class="agent-status-panel" :class="{ online: isOnline }">
    <div class="status-dot" :class="{ online: isOnline }"></div>
    <span class="status-text">
      {{ isOnline ? `本地已连接: ${agentDisplayName}` : '本地未连接' }}
    </span>
  </div>
</template>

<style scoped>
.agent-status-panel {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 6px;
  background: var(--bg-secondary, #f5f5f5);
  font-size: 13px;
  color: var(--text-secondary, #666);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ccc;
  transition: background 0.3s;
}

.status-dot.online {
  background: #4caf50;
  box-shadow: 0 0 6px rgba(76, 175, 80, 0.5);
}

.status-text {
  white-space: nowrap;
}
</style>
