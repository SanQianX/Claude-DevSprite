<template>
  <div class="project-view">
    <!-- Project Header with Tabs -->
    <div class="project-header">
      <div class="header-left">
        <router-link to="/" class="back-btn" title="Back to projects">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M7.78 12.53a.75.75 0 01-1.06 0L2.47 8.28a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 1.06L4.81 7h7.44a.75.75 0 010 1.5H4.81l2.97 2.97a.75.75 0 010 1.06z"/>
          </svg>
        </router-link>
        <span class="project-name">{{ projectName }}</span>
        <div class="header-tabs">
          <button
            class="header-tab"
            :class="{ active: activeTab === 'dashboard' }"
            @click="setTab('dashboard')"
          >
            Dashboard
          </button>
          <button
            class="header-tab"
            :class="{ active: activeTab === 'workspace' }"
            @click="setTab('workspace')"
          >
            Workspace
          </button>
        </div>
      </div>
      <div class="header-right">
        <input
          class="search-box"
          type="text"
          placeholder="搜索知识库..."
        />
      </div>
    </div>

    <!-- Dashboard Mode -->
    <DashboardView
      v-if="activeTab === 'dashboard'"
      :project-name="projectName"
    />

    <!-- Workspace Mode -->
    <WorkspaceView
      v-if="activeTab === 'workspace'"
      :project-name="projectName"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DashboardView from './DashboardView.vue'
import WorkspaceView from './WorkspaceView.vue'

const route = useRoute()
const router = useRouter()

const projectName = ref(route.params.projectName as string)
const activeTab = ref<'dashboard' | 'workspace'>('dashboard')

// Sync tab from URL query
watch(
  () => route.query.tab,
  (tab) => {
    if (tab === 'workspace') activeTab.value = 'workspace'
    else activeTab.value = 'dashboard'
  },
  { immediate: true }
)

// Sync project name from route
watch(
  () => route.params.projectName,
  (name) => {
    projectName.value = name as string
  }
)

function setTab(tab: 'dashboard' | 'workspace') {
  activeTab.value = tab
  router.replace({ query: { ...route.query, tab } })
}
</script>

<style scoped>
.project-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.project-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  background: var(--color-bg-secondary, #f8fafc);
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  color: var(--color-text-secondary, #64748b);
  text-decoration: none;
  transition: all 150ms;
}

.back-btn:hover {
  background: var(--color-bg-tertiary, #e2e8f0);
  color: var(--color-text-primary, #1e293b);
}

.project-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary, #1e293b);
}

.header-tabs {
  display: flex;
  gap: 4px;
  margin-left: 8px;
}

.header-tab {
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  color: var(--color-text-secondary, #64748b);
  background: transparent;
  border: none;
  transition: all 150ms;
}

.header-tab:hover:not(.active) {
  background: var(--color-bg-tertiary, #e2e8f0);
}

.header-tab.active {
  background: #3b82f6;
  color: #fff;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-box {
  background: var(--color-bg-primary, #fff);
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 6px 12px;
  color: var(--color-text-secondary, #64748b);
  font-size: 13px;
  width: 200px;
  transition: border-color 150ms;
}

.search-box:focus {
  outline: none;
  border-color: #3b82f6;
}
</style>
