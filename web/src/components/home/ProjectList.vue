<template>
  <div class="project-list">
    <table class="project-table">
      <thead>
        <tr>
          <th class="col-project">Project</th>
          <th class="col-repo">Repo Type</th>
          <th class="col-docs">Docs</th>
          <th class="col-update">Last Update</th>
          <th class="col-status">Status</th>
        </tr>
      </thead>
      <tbody>
        <ProjectCard
          v-for="project in projects"
          :key="project.name"
          :project="project"
        />
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { Project } from '@/types'
import ProjectCard from './ProjectCard.vue'

defineProps<{
  projects: Project[]
}>()
</script>

<style scoped>
.project-list {
  width: 100%;
}

.project-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.project-table thead {
  border-bottom: 2px solid var(--color-border);
}

.project-table th {
  text-align: left;
  padding: 10px 12px;
  font-weight: 600;
  color: var(--color-text-secondary, #656d76);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.col-project { width: 35%; }
.col-repo { width: 12%; }
.col-docs { width: 8%; text-align: center; }
.col-update { width: 30%; }
.col-status { width: 15%; text-align: center; }
</style>
