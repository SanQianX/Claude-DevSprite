<template>
  <div class="home-page">
    <AppHeader />

    <div class="home-body">
      <!-- Tokens Consumption Bar -->
      <TokensBar />

      <!-- Project Table Section -->
      <div class="project-section">
        <div class="section-header">
          <div class="section-title">{{ t('home.title') }}</div>
          <div class="section-actions">
            <button class="btn btn-secondary" @click="fetchProjects">
              {{ t('common.refresh') }}
            </button>
            <button class="btn btn-primary" @click="showAddModal = true">
              + {{ t('home.addProject') }}
            </button>
          </div>
        </div>

        <div class="table-container">
          <div v-if="loading" class="loading-container">
            <LoadingSpinner />
          </div>

          <div v-else-if="error" class="error-container">
            <p class="error-message">{{ error }}</p>
            <button @click="fetchProjects" class="btn btn-primary">{{ t('common.retry') }}</button>
          </div>

          <div v-else-if="projects.length === 0" class="empty-container">
            <EmptyState
              :title="t('home.noProjects')"
              :description="t('home.noProjectsDesc')"
            />
            <button class="btn btn-primary" style="margin-top: 16px" @click="showAddModal = true">
              + {{ t('home.addProject') }}
            </button>
          </div>

          <table v-else class="project-table">
            <thead>
              <tr>
                <th style="width:32%">{{ t('home.title') }}</th>
                <th style="width:8%">{{ t('project.repoType') }}</th>
                <th style="width:8%;text-align:center">{{ t('project.docs') || 'Docs' }}</th>
                <th style="width:22%">{{ t('project.lastUpdate') }}</th>
                <th style="width:12%;text-align:center">{{ t('project.status') }}</th>
                <th style="width:8%"></th>
              </tr>
            </thead>
            <tbody>
              <ProjectCard
                v-for="project in projects"
                :key="project.name"
                :project="project"
                @deleted="fetchProjects"
              />
            </tbody>
          </table>
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
import ProjectCard from '@/components/home/ProjectCard.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import TokensBar from '@/components/home/TokensBar.vue'
import ConsolePanel from '@/components/home/ConsolePanel.vue'
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
  flex-direction: column;
  overflow: hidden;
}

.project-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}

.section-actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid;
}

.btn-primary {
  background: #22c55e;
  color: #fff;
  border-color: #16a34a;
}

.btn-primary:hover {
  background: #16a34a;
}

.btn-secondary {
  background: #fff;
  color: #475569;
  border-color: #d1d5db;
}

.btn-secondary:hover {
  background: #f8fafc;
}

.table-container {
  flex: 1;
  overflow-y: auto;
  padding: 0 24px 20px;
}

.project-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.project-table thead {
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
}

.project-table th {
  text-align: left;
  padding: 10px 12px;
  font-weight: 600;
  color: #64748b;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 2px solid #e2e8f0;
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

.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64px 24px;
}

@media (max-width: 768px) {
  .section-header {
    padding: 12px 16px;
  }

  .table-container {
    padding: 0 16px 16px;
  }
}
</style>
