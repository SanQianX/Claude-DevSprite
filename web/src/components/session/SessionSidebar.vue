<!--
  @brief Left sidebar displaying session list and controls
  @props sessions - Array of session objects
  @props activeSessionId - Currently active session ID
  @props loading - Whether sessions are being loaded
  @emits select - When a session is selected
  @emits create - When new session button is clicked
  @emits delete - When a session is deleted
-->
<template>
  <div class="session-sidebar" :class="{ collapsed: isCollapsed }">
    <div class="sidebar-header">
      <h3 v-if="!isCollapsed">Sessions</h3>
      <button class="toggle-btn" @click="isCollapsed = !isCollapsed" :title="isCollapsed ? 'Expand' : 'Collapse'">
        <span :class="{ rotated: !isCollapsed }">&#x25C0;</span>
      </button>
    </div>

    <div v-if="!isCollapsed" class="sidebar-content">
      <button class="new-session-btn" @click="$emit('create')">
        <span>+</span> New Chat
      </button>

      <div v-if="loading" class="loading-state">
        <LoadingSpinner size="small" />
        <span>Loading...</span>
      </div>

      <EmptyState
        v-else-if="sessions.length === 0"
        title="No sessions yet"
        description='Click "New Chat" to start'
        size="small"
      />

      <div v-else class="session-list">
        <div
          v-for="session in sortedSessions"
          :key="session.id"
          class="session-item"
          :class="{ active: session.id === activeSessionId }"
          @click="$emit('select', session.id)"
        >
          <div class="session-title">{{ session.title }}</div>
          <div class="session-meta">
            <span class="message-count">{{ session.messageCount }} msgs</span>
            <span class="session-time">{{ formatTime(session.updatedAt) }}</span>
          </div>
          <button
            class="delete-btn"
            @click.stop="$emit('delete', session.id)"
            title="Delete session"
          >
            &#x1F5D1;
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Session } from '../../types/session';
import LoadingSpinner from '../common/LoadingSpinner.vue';
import EmptyState from '../common/EmptyState.vue';

const props = defineProps<{
  sessions: Session[];
  activeSessionId: string | null;
  loading?: boolean;
}>();

defineEmits<{
  select: [sessionId: string];
  create: [];
  delete: [sessionId: string];
}>();

const isCollapsed = ref(false);

const sortedSessions = computed(() => {
  return [...props.sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
});

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}
</script>

<style scoped>
.session-sidebar {
  width: 280px;
  min-width: 280px;
  background: #1e1e1e;
  color: #d4d4d4;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #333;
  transition: width 0.2s, min-width 0.2s;
}

.session-sidebar.collapsed {
  width: 48px;
  min-width: 48px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #333;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #e0e0e0;
}

.toggle-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 4px;
  font-size: 12px;
  display: flex;
  align-items: center;
}

.toggle-btn:hover {
  color: #e0e0e0;
}

.toggle-btn span {
  display: inline-block;
  transition: transform 0.2s;
}

.toggle-btn span.rotated {
  transform: rotate(180deg);
}

.sidebar-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.new-session-btn {
  margin: 12px 16px;
  padding: 10px 16px;
  background: #0078d4;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s;
}

.new-session-btn:hover {
  background: #106ebe;
}

.new-session-btn span {
  font-size: 16px;
  font-weight: bold;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: #888;
  font-size: 13px;
}

.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.session-item {
  position: relative;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  margin-bottom: 2px;
}

.session-item:hover {
  background: #2d2d2d;
}

.session-item.active {
  background: #094771;
}

.session-title {
  font-size: 13px;
  font-weight: 500;
  color: #e0e0e0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 24px;
}

.session-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 11px;
  color: #888;
}

.delete-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 2px 4px;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
}

.session-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  color: #f44336;
}
</style>
