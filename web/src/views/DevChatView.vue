<template>
  <div class="dev-chat-view">
    <div class="chat-header">
      <h1>开发聊天</h1>
      <TeamStatusPanel @abort-all="handleAbortAll" />
    </div>

    <div class="chat-container">
      <ChatMessageList :messages="messages" />
      <ChatInput :disabled="isSending" @send="handleSend" />
    </div>

    <div v-if="error" class="error-banner">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useChatStore } from '../stores/chat';
import { useTeamsStore } from '../stores/teams';
import ChatMessageList from '../components/chat/ChatMessageList.vue';
import ChatInput from '../components/chat/ChatInput.vue';
import TeamStatusPanel from '../components/teams/TeamStatusPanel.vue';

const chatStore = useChatStore();
const teamsStore = useTeamsStore();

const { messages, isSending, error } = storeToRefs(chatStore);

onMounted(() => {
  chatStore.connect();
  teamsStore.fetchTeams();
  teamsStore.startPolling();
});

onUnmounted(() => {
  chatStore.disconnect();
  teamsStore.stopPolling();
});

function handleSend(content: string) {
  chatStore.sendMessage(content);
}

function handleAbortAll() {
  if (confirm('确定要中止所有正在执行的任务吗？')) {
    teamsStore.abortAll();
  }
}
</script>

<style scoped>
.dev-chat-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.chat-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 20px;
}

.error-banner {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  background: #dc3545;
  color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}
</style>
