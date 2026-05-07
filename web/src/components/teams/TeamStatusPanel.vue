<template>
  <div class="team-status-panel">
    <div
      v-for="team in teams"
      :key="team"
      class="team-indicator"
      :class="{ busy: getStatus(team) === 'busy' }"
    >
      <span class="status-dot" :class="getStatus(team)"></span>
      <span class="team-name">{{ displayNames[team] || team }}</span>
    </div>
    <button
      class="abort-btn"
      @click="$emit('abort-all')"
      :disabled="!isAnyBusy"
    >
      中止所有
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useTeamsStore } from '../../stores/teams';

const teams = ['lead', 'dev', 'test'] as const;
const displayNames: Record<string, string> = { lead: 'Lead', dev: 'Dev', test: 'Test' };

const teamsStore = useTeamsStore();
const { isAnyBusy } = storeToRefs(teamsStore);

defineEmits<{
  'abort-all': [];
}>();

function getStatus(team: string): string {
  const status = teamsStore.statuses.get(team);
  return status?.status || 'offline';
}
</script>

<style scoped>
.team-status-panel {
  display: flex;
  align-items: center;
  gap: 16px;
}

.team-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #f8f9fa;
  border-radius: 20px;
  font-size: 13px;
}

.team-indicator.busy {
  background: #fff3cd;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6c757d;
}

.status-dot.idle {
  background: #28a745;
}

.status-dot.busy {
  background: #ffc107;
  animation: pulse 1.5s infinite;
}

.status-dot.error {
  background: #dc3545;
}

.status-dot.offline {
  background: #6c757d;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.abort-btn {
  padding: 8px 16px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.abort-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}
</style>
