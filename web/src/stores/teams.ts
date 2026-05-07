/**
 * Teams Store
 * Manages team configurations and statuses
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { teamsApi, type TeamConfig, type TeamStatus } from '../api/teams';

export const useTeamsStore = defineStore('teams', () => {
  // State
  const teams = ref<TeamConfig[]>([]);
  const statuses = ref<Map<string, TeamStatus>>(new Map());
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Computed
  const leadStatus = computed(() => statuses.value.get('lead'));
  const devStatus = computed(() => statuses.value.get('dev'));
  const testStatus = computed(() => statuses.value.get('test'));

  const isAnyBusy = computed(() => {
    return Array.from(statuses.value.values()).some(s => s.status === 'busy');
  });

  // Actions
  async function fetchTeams() {
    loading.value = true;
    error.value = null;

    try {
      teams.value = await teamsApi.getAll();
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch teams';
    } finally {
      loading.value = false;
    }
  }

  async function fetchStatuses() {
    try {
      const allStatuses = await teamsApi.getAllStatuses();
      for (const status of allStatuses) {
        statuses.value.set(status.name, status);
      }
    } catch (err: any) {
      console.error('Failed to fetch statuses:', err);
    }
  }

  async function updateTeam(name: string, config: Partial<TeamConfig>) {
    loading.value = true;
    error.value = null;

    try {
      const updated = await teamsApi.update(name, config);
      const index = teams.value.findIndex(t => t.name === name);
      if (index !== -1) {
        teams.value[index] = updated;
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to update team';
    } finally {
      loading.value = false;
    }
  }

  async function testTeam(name: string): Promise<boolean> {
    try {
      const result = await teamsApi.test(name);
      return result.success;
    } catch {
      return false;
    }
  }

  async function abortTeam(name: string) {
    try {
      await teamsApi.abort(name);
      await fetchStatuses();
    } catch (err: any) {
      console.error('Failed to abort team:', err);
    }
  }

  async function abortAll() {
    try {
      await teamsApi.abortAll();
      await fetchStatuses();
    } catch (err: any) {
      console.error('Failed to abort all teams:', err);
    }
  }

  function updateStatus(status: TeamStatus) {
    statuses.value.set(status.name, status);
  }

  // Start polling for status updates
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  function startPolling(interval = 5000) {
    stopPolling();
    fetchStatuses();
    pollInterval = setInterval(fetchStatuses, interval);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  return {
    // State
    teams,
    statuses,
    loading,
    error,

    // Computed
    leadStatus,
    devStatus,
    testStatus,
    isAnyBusy,

    // Actions
    fetchTeams,
    fetchStatuses,
    updateTeam,
    testTeam,
    abortTeam,
    abortAll,
    updateStatus,
    startPolling,
    stopPolling,
  };
});
