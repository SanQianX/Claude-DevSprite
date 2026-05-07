<template>
  <aside class="home-sidebar">
    <nav class="sidebar-nav">
      <div class="nav-section">
        <router-link to="/" class="nav-item" :class="{ active: isHome }">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0l8 6.5V15a1 1 0 01-1 1H1a1 1 0 01-1-1V6.5L8 0zm0 2L2 6.8V14h12V6.8L8 2z"/>
            <path d="M6 10h4v5H6z"/>
          </svg>
          <span>{{ t('nav.home') }}</span>
        </router-link>
        <router-link to="/chat" class="nav-item" :class="{ active: isChat }">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 1a1 1 0 00-1 1v9a1 1 0 001 1h2.5a.5.5 0 01.5.5v2.207l2.854-2.854A.5.5 0 018.207 12H12a1 1 0 001-1V2a1 1 0 00-1-1H2zm0-1h10a2 2 0 012 2v9a2 2 0 01-2 2H8.207l-3.147 3.146A.5.5 0 014 13.793V13H2a2 2 0 01-2-2V2a2 2 0 012-2z"/>
          </svg>
          <span>{{ t('nav.chat') }}</span>
        </router-link>
      </div>

      <div class="nav-section">
        <h4 class="nav-section-title">{{ t('nav.projects') }}</h4>

        <div v-if="projects.length === 0" class="nav-empty">
          {{ t('home.noProjects') }}
        </div>

        <div v-else class="nav-project-list">
          <router-link
            v-for="project in projects"
            :key="project.name"
            :to="`/project/${project.name}`"
            class="nav-item nav-project-item"
          >
            <div class="project-dot" :style="{ backgroundColor: project.color || '#3b82f6' }"></div>
            <span class="project-label">{{ project.name }}</span>
          </router-link>
        </div>
      </div>
    </nav>

    <div class="sidebar-footer">
      <router-link to="/settings" class="nav-item">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path fill-rule="evenodd" d="M9.19 2.53c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM8 10.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" clip-rule="evenodd"/>
        </svg>
        <span>{{ t('nav.settings') }}</span>
      </router-link>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useProjectsStore } from '@/stores/projects'
import { useUIStore } from '@/stores/ui'
import type { Project } from '@/types'

defineProps<{
  projects: Project[]
}>()

const route = useRoute()
const { t } = storeToRefs(useUIStore())
const isHome = computed(() => route.path === '/')
const isChat = computed(() => route.path === '/chat')
</script>

<style scoped>
.home-sidebar {
  width: 240px;
  min-width: 240px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  border-right: 1px solid var(--color-border);
  overflow: hidden;
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0;
}

.nav-section {
  margin-bottom: 8px;
}

.nav-section-title {
  margin: 0;
  padding: 6px 16px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary, #656d76);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  color: var(--color-text-secondary, #656d76);
  text-decoration: none;
  font-size: 14px;
  transition: all var(--transition-fast, 150ms ease);
  cursor: pointer;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
}

.nav-item:hover {
  background: var(--color-bg-secondary, #f6f8fa);
  color: var(--color-text-primary, #1f2328);
}

.nav-item.active {
  background: var(--color-bg-secondary, #f6f8fa);
  color: var(--color-text-link, #0969da);
  font-weight: 500;
}

.nav-empty {
  padding: 8px 16px;
  font-size: 13px;
  color: var(--color-text-secondary, #656d76);
}

.nav-project-item {
  padding: 6px 16px 6px 24px;
}

.project-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.project-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-footer {
  padding: 8px 0;
  border-top: 1px solid var(--color-border, #d0d7de);
}

@media (max-width: 768px) {
  .home-sidebar {
    display: none;
  }
}
</style>
