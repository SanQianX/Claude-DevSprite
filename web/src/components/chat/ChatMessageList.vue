<template>
  <div class="chat-messages" ref="containerRef">
    <ChatMessage v-for="msg in messages" :key="msg.id" :msg="msg" />
    <div v-if="messages.length === 0" class="empty-state">
      <p>开始对话 - 输入开发需求让 Agent 团队为你工作</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import ChatMessage from './ChatMessage.vue';
import type { ChatMessage as ChatMessageType } from '../../stores/chat';

const props = defineProps<{
  messages: ChatMessageType[];
}>();

const containerRef = ref<HTMLElement | null>(null);

watch(
  () => props.messages.length,
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
</style>
