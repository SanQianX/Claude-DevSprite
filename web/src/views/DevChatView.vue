<template>
  <div class="dev-chat-view">
    <SessionSidebar
      :sessions="sessions"
      :active-session-id="activeSessionId"
      :loading="sessionsLoading"
      @select="handleSelectSession"
      @create="showNewSessionDialog = true"
      @delete="handleDeleteSession"
    />

    <div class="chat-main">
      <div class="chat-header">
        <div class="chat-header-title">
          <span v-if="route.params.projectName" class="project-badge">{{ route.params.projectName }}</span>
          <h1>{{ activeSession?.title || 'Dev Chat' }}</h1>
        </div>
        <TeamStatusPanel @abort-all="handleAbortAll" />
      </div>

      <div class="chat-container">
        <ChatMessageList
          :messages="messages"
          :is-thinking="isThinking"
          :thinking-content="thinkingContent"
          :thinking-expanded="thinkingExpanded"
          @toggle-thinking="chatStore.thinkingExpanded = !chatStore.thinkingExpanded"
        />
        <ChatInput :disabled="isSending || isThinking" @send="handleSend" />
      </div>

      <div v-if="error" class="error-banner">
        {{ error }}
      </div>
    </div>

    <NewSessionDialog
      :visible="showNewSessionDialog"
      @close="showNewSessionDialog = false"
      @create="handleCreateSession"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useChatStore } from '../stores/chat';
import { useTeamsStore } from '../stores/teams';
import { useProjectsStore } from '../stores/projects';
import ChatMessageList from '../components/chat/ChatMessageList.vue';
import ChatInput from '../components/chat/ChatInput.vue';
import TeamStatusPanel from '../components/teams/TeamStatusPanel.vue';
import SessionSidebar from '../components/session/SessionSidebar.vue';
import NewSessionDialog from '../components/session/NewSessionDialog.vue';
import type { CreateSessionParams } from '../types/session';

const route = useRoute();
const chatStore = useChatStore();
const teamsStore = useTeamsStore();
const projectsStore = useProjectsStore();

const { messages, isSending, error, sessions, activeSessionId, activeSession, isThinking, thinkingContent, thinkingExpanded } = storeToRefs(chatStore);

const sessionsLoading = ref(false);
const showNewSessionDialog = ref(false);

/** Resolve project path from route params */
async function resolveProjectPath(): Promise<string> {
  const projectName = route.params.projectName as string;
  if (!projectName) return '';
  // Ensure projects are loaded
  if (projectsStore.projects.length === 0) {
    await projectsStore.fetchProjects();
  }
  const project = projectsStore.getProjectByName(projectName);
  return project?.path || '';
}

onMounted(async () => {
  const projectPath = await resolveProjectPath();
  chatStore.connect(projectPath);
  teamsStore.fetchTeams();
  teamsStore.startPolling();
});

// Reconnect when navigating between projects
watch(
  () => route.params.projectName,
  async (newName) => {
    if (newName) {
      const projectPath = await resolveProjectPath();
      chatStore.connect(projectPath);
    }
  }
);

onUnmounted(() => {
  chatStore.disconnect();
  teamsStore.stopPolling();
});

function handleSend(content: string) {
  // Intercept /task commands for in-chat task creation
  if (content.trim().startsWith('/task ')) {
    const projectName = route.params.projectName as string;
    if (projectName) {
      chatStore.handleTaskCommand(content, projectName);
    } else {
      chatStore.addSystemMessage('无法创建任务: 未指定项目');
    }
    return;
  }
  chatStore.sendMessage(content);
}

function handleAbortAll() {
  if (confirm('确定要中止所有正在执行的任务吗？')) {
    teamsStore.abortAll();
  }
}

function handleSelectSession(sessionId: string) {
  chatStore.activateSession(sessionId);
}

function handleCreateSession(params: CreateSessionParams) {
  chatStore.createSession(params.title);
  showNewSessionDialog.value = false;
}

function handleDeleteSession(sessionId: string) {
  chatStore.deleteSession(sessionId);
}
</script>

<style scoped>
.dev-chat-view {
  display: flex;
  height: 100vh;
  background: #f5f5f5;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.project-badge {
  flex-shrink: 0;
  padding: 2px 10px;
  background: #eff6ff;
  color: #2563eb;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid #bfdbfe;
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
