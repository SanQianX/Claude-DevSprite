<template>
  <div class="project-layout">
    <AppHeader />

    <div class="project-content">
      <AppSidebar v-if="sidebarOpen" class="sidebar" />

      <main class="main-content">
        <router-view />
      </main>

      <AppTocPanel v-if="tocPanelOpen" class="toc-panel" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useProjectsStore } from '@/stores/projects'
import { useKnowledgeStore } from '@/stores/knowledge'
import { onMounted, watch } from 'vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppTocPanel from '@/components/layout/AppTocPanel.vue'
import { useUIStore } from '@/stores/ui'

const route = useRoute()
const projectsStore = useProjectsStore()
const knowledgeStore = useKnowledgeStore()
const uiStore = useUIStore()
const { sidebarOpen, tocPanelOpen } = storeToRefs(uiStore)

onMounted(async () => {
  const projectName = route.params.projectName as string

  // Fetch projects list if empty (e.g. direct navigation via SPA fallback)
  if (projectsStore.projects.length === 0) {
    await projectsStore.fetchProjects()
  }

  const project = projectsStore.getProjectByName(projectName)
  if (project) {
    projectsStore.setCurrentProject(project)
    await knowledgeStore.fetchFileTree(projectName)
  }
})

watch(
  () => route.params.projectName,
  async (newProjectName) => {
    if (newProjectName) {
      const project = projectsStore.getProjectByName(newProjectName as string)
      if (project) {
        projectsStore.setCurrentProject(project)
        await knowledgeStore.fetchFileTree(newProjectName as string)
      }
    }
  }
)
</script>

<style scoped>
.project-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg);
}

.project-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
  height: calc(100vh - 60px);
}

.main-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  height: calc(100vh - 60px);
}

.toc-panel {
  width: 220px;
  flex-shrink: 0;
  border-left: 1px solid var(--color-border);
  overflow-y: auto;
  height: calc(100vh - 60px);
}

@media (max-width: 1400px) {
  .toc-panel {
    display: none;
  }
}

@media (max-width: 1200px) {
  .sidebar {
    width: 240px;
  }
}

@media (max-width: 768px) {
  .sidebar {
    display: none;
  }

  .main-content {
    padding: 16px;
  }
}
</style>
