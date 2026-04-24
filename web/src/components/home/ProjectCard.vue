<template>
  <router-link
    :to="`/project/${project.name}`"
    class="project-card"
    :style="{ '--project-color': project.color }"
  >
    <div class="project-card-header">
      <div class="project-icon" :style="{ backgroundColor: project.color }">
        {{ project.name.charAt(0).toUpperCase() }}
      </div>
      <h3 class="project-name">{{ project.name }}</h3>
    </div>

    <p class="project-description">{{ project.description }}</p>

    <div class="project-stats">
      <div class="project-stat">
        <span class="stat-label">Documents</span>
        <span class="stat-value">{{ project.documentCount }}</span>
      </div>
      <div class="project-stat">
        <span class="stat-label">Analyses</span>
        <span class="stat-value">{{ project.analysisCount }}</span>
      </div>
    </div>

    <div class="project-footer">
      <span class="project-path">{{ project.path }}</span>
      <span class="project-updated">{{ formatDate(project.lastUpdated) }}</span>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import type { Project } from '@/types'

defineProps<{
  project: Project
}>()

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return `${Math.floor(diffDays / 30)} months ago`
}
</script>

<style scoped>
.project-card {
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 20px;
  text-decoration: none;
  color: var(--color-text);
  transition: all var(--transition-normal);
  box-shadow: var(--shadow-sm);
}

.project-card:hover {
  box-shadow: var(--shadow-lg);
  border-color: var(--project-color);
  transform: translateY(-2px);
}

.project-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.project-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 18px;
  color: white;
}

.project-name {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: var(--color-text);
}

.project-description {
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 0 0 16px;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.project-stats {
  display: flex;
  gap: 24px;
  padding: 12px 0;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 12px;
}

.project-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}

.project-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--color-text-muted);
}

.project-path {
  font-family: var(--font-family-mono);
}
</style>
