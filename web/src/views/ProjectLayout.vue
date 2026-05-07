<template>
  <div class="project-layout">
    <AppHeader />

    <div class="project-content">
      <AppSidebar v-if="sidebarOpen" class="sidebar" />

      <main class="main-content">
        <router-view />
      </main>

      <router-link
        :to="`/chat`"
        class="dev-chat-fab"
        title="开发聊天"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
          <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
        </svg>
      </router-link>

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

.dev-chat-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  z-index: 100;
  transition: transform 0.2s, box-shadow 0.2s;
}

.dev-chat-fab:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.5);
}
</style>
