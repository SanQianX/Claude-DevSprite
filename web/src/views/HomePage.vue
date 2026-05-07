<template>
  <div class="home-page">
    <AppHeader />

    <div class="home-body">
      <!-- Left Sidebar Navigation -->
      <HomeSidebar :projects="projects" />

      <!-- Main Content -->
      <div class="home-main">
        <div class="main-header">
          <h1 class="page-title">{{ t('home.title') }}</h1>
          <div class="header-actions">
            <span v-if="projects.length > 0" class="project-count">
              {{ t('home.totalProjects', { n: projects.length }) }}
            </span>
            <button class="add-project-btn" @click="showAddModal = true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M7.75 2a.75.75 0 01.75.75V7h4.25a.75.75 0 010 1.5H8.5v4.25a.75.75 0 01-1.5 0V8.5H2.75a.75.75 0 010-1.5H7V2.75A.75.75 0 017.75 2z"/>
              </svg>
              {{ t('home.addProject') }}
            </button>
          </div>
        </div>

        <div class="main-content">
          <div v-if="loading" class="loading-container">
            <LoadingSpinner />
          </div>

          <div v-else-if="error" class="error-container">
            <p class="error-message">{{ error }}</p>
            <button @click="fetchProjects" class="btn-primary">{{ t('common.retry') }}</button>
          </div>

          <div v-else-if="projects.length === 0" class="empty-container">
            <EmptyState
              :title="t('home.noProjects')"
              :description="t('home.noProjectsDesc')"
            />
            <button class="add-project-btn add-project-btn-lg" @click="showAddModal = true">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                <path d="M7.75 2a.75.75 0 01.75.75V7h4.25a.75.75 0 010 1.5H8.5v4.25a.75.75 0 01-1.5 0V8.5H2.75a.75.75 0 010-1.5H7V2.75A.75.75 0 017.75 2z"/>
              </svg>
              {{ t('home.addProject') }}
            </button>
          </div>

          <ProjectList v-else :projects="projects" @deleted="fetchProjects" />
        </div>
      </div>
    </div>

    <ConsolePanel />

    <!-- Add Project Modal -->
    <AddProjectModal
      v-if="showAddModal"
      @close="showAddModal = false"
      @added="onProjectAdded"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectsStore } from '@/stores/projects'
import { useUIStore } from '@/stores/ui'
import ProjectList from '@/components/home/ProjectList.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import ConsolePanel from '@/components/home/ConsolePanel.vue'
import HomeSidebar from '@/components/home/HomeSidebar.vue'
import AddProjectModal from '@/components/home/AddProjectModal.vue'

const projectsStore = useProjectsStore()
const { projects, loading, error } = storeToRefs(projectsStore)
const { fetchProjects } = projectsStore
const { t } = storeToRefs(useUIStore())

const showAddModal = ref(false)

function onProjectAdded() {
  fetchProjects()
}

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

.home-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.home-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.main-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--color-border, #d0d7de);
  flex-shrink: 0;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary, #1f2328);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.project-count {
  font-size: 13px;
  color: var(--color-text-secondary, #656d76);
}

.add-project-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  background: #2da44e;
  color: white;
  border: 1px solid rgba(27, 31, 35, 0.15);
  border-radius: var(--radius-md, 6px);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s;
}

.add-project-btn:hover {
  background: #2c974b;
}

.add-project-btn-lg {
  padding: 10px 24px;
  font-size: 15px;
  margin-top: 16px;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 24px 24px;
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

.btn-primary {
  padding: 8px 24px;
  background-color: var(--color-text-link, #0969da);
  color: white;
  border-radius: var(--radius-md, 6px);
  font-weight: 500;
  cursor: pointer;
  border: none;
}

.btn-primary:hover {
  background-color: #0550ae;
}

.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64px 24px;
}

@media (max-width: 768px) {
  .main-header {
    padding: 12px 16px;
  }

  .main-content {
    padding: 0 16px 16px;
  }
}
</style>
