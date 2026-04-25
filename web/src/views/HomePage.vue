<template>
  <div class="home-page">
    <AppHeader />

    <header class="home-header">
      <h1 class="home-title">DevSprite Knowledge Base</h1>
      <p class="home-subtitle">AI-powered development documentation hub</p>
    </header>

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

    <div v-else class="projects-container">
      <ProjectList :projects="projects" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectsStore } from '@/stores/projects'
import ProjectList from '@/components/home/ProjectList.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import AppHeader from '@/components/layout/AppHeader.vue'

const projectsStore = useProjectsStore()
const { projects, loading, error } = storeToRefs(projectsStore)
const { fetchProjects } = projectsStore

onMounted(() => {
  fetchProjects()
})
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  background-color: var(--color-bg);
}

.home-header {
  text-align: center;
  padding: 48px 24px 32px;
  border-bottom: 1px solid var(--color-border);
}

.home-title {
  font-size: 36px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 12px;
}

.home-subtitle {
  font-size: 18px;
  color: var(--color-text-secondary);
  margin: 0;
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
  color: var(--color-danger);
  margin-bottom: 16px;
}

.retry-button {
  padding: 8px 24px;
  background-color: var(--color-primary);
  color: white;
  border-radius: var(--radius-md);
  font-weight: 500;
}

.retry-button:hover {
  background-color: var(--color-primary-hover);
}

.empty-container {
  padding: 64px 24px;
}

.projects-container {
  padding: 32px 24px;
  max-width: 1400px;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .home-title {
    font-size: 28px;
  }

  .home-subtitle {
    font-size: 16px;
  }
}
</style>
