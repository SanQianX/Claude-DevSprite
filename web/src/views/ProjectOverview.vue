<template>
  <div class="project-overview">
    <div v-if="loading" class="loading-container">
      <LoadingSpinner />
    </div>

    <div v-else-if="error" class="error-container">
      <p class="error-message">{{ error }}</p>
    </div>

    <div v-else-if="!project" class="empty-container">
      <EmptyState title="Project not found" description="The project you're looking for doesn't exist" />
    </div>

    <div v-else class="overview-content">
      <div class="overview-header">
        <div
          class="project-badge"
          :style="{ backgroundColor: project.color }"
        >
          {{ project.name.charAt(0).toUpperCase() }}
        </div>
        <div class="project-info">
          <h1 class="project-title">{{ project.name }}</h1>
          <p class="project-description">{{ project.description }}</p>
          <p class="project-path">{{ project.path }}</p>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📄</div>
          <div class="stat-content">
            <div class="stat-value">{{ project.documentCount }}</div>
            <div class="stat-label">Documents</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">🔍</div>
          <div class="stat-content">
            <div class="stat-value">{{ project.analysisCount }}</div>
            <div class="stat-label">Analyses</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">📅</div>
          <div class="stat-content">
            <div class="stat-value">{{ formatDate(project.lastUpdated) }}</div>
            <div class="stat-label">Last Updated</div>
          </div>
        </div>
      </div>

      <div v-if="fileTree" class="recent-section">
        <h2 class="section-title">File Structure</h2>
        <div class="file-tree-preview">
          <FileTreeNode :node="fileTree" :level="0" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useProjectsStore } from '@/stores/projects'
import { useKnowledgeStore } from '@/stores/knowledge'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import FileTreeNode from '@/components/tree/FileTreeNode.vue'

const projectsStore = useProjectsStore()
const knowledgeStore = useKnowledgeStore()
const { currentProject: project } = projectsStore
const { fileTree, loading, error } = knowledgeStore

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
</script>

<style scoped>
.project-overview {
  padding: 32px;
  max-width: 1000px;
  margin: 0 auto;
}

.loading-container,
.error-container,
.empty-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

.error-message {
  color: var(--color-danger);
}

.overview-header {
  display: flex;
  gap: 20px;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--color-border);
}

.project-badge {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}

.project-info {
  flex: 1;
}

.project-title {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 8px;
  color: var(--color-text);
}

.project-description {
  font-size: 16px;
  color: var(--color-text-secondary);
  margin: 0 0 8px;
  line-height: 1.5;
}

.project-path {
  font-family: var(--font-family-mono);
  font-size: 14px;
  color: var(--color-text-muted);
  margin: 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.stat-icon {
  font-size: 32px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.recent-section {
  padding: 24px 0;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px;
  color: var(--color-text);
}

.file-tree-preview {
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  padding: 16px;
  border: 1px solid var(--color-border);
}

@media (max-width: 640px) {
  .project-overview {
    padding: 16px;
  }

  .overview-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .project-title {
    font-size: 24px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
