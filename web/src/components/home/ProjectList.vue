<template>
  <div class="project-list">
    <div v-for="project in projects" :key="project.name" class="project-list-item">
      <ProjectCard :project="project" />
    </div>
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
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.project-list-item {
  display: flex;
}

@media (max-width: 640px) {
  .project-list {
    grid-template-columns: 1fr;
  }
}
</style>
