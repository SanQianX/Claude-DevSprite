<template>
  <div class="home-page">
    <AppHeader />

    <div class="home-content">
      <div class="projects-section">
        <div v-if="loading" class="loading-container">
          <LoadingSpinner />
        </div>

        <div v-else-if="error" class="error-container">
          <p class="error-message">{{ error }}</p>
          <button @click="fetchProjects" class="retry-button">Retry</button>
        </div>

        <div v-else-if="projects.length === 0" class="empty-container">
          <EmptyState
            title="No projects found"
            description="Connect your first project to get started"
          />
        </div>

        <ProjectList v-else :projects="projects" />
      </div>
    </div>

    <ConsolePanel />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectsStore } from '@/stores/projects'
import { useLogsStore } from '@/stores/logs'
import ProjectList from '@/components/home/ProjectList.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import ConsolePanel from '@/components/home/ConsolePanel.vue'

const projectsStore = useProjectsStore()
const { projects, loading, error } = storeToRefs(projectsStore)
const { fetchProjects } = projectsStore

onMounted(() => {
  fetchProjects()
})
</script>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--color-bg-primary, #fff);
}

.home-content {
  flex: 1;
  overflow-y: auto;
}

.projects-section {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 64px 24px;
}

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64px 24px;
}

.error-message {
  color: #cf222e;
  margin-bottom: 16px;
}

.retry-button {
  padding: 8px 24px;
  background-color: var(--color-text-link, #0969da);
  color: white;
  border-radius: var(--radius-md, 6px);
  font-weight: 500;
  cursor: pointer;
  border: none;
}

.retry-button:hover {
  background-color: #0550ae;
}

.empty-container {
  padding: 64px 24px;
}
</style>
