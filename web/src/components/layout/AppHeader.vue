<template>
  <header class="app-header">
    <div class="header-left">
      <button
        class="menu-toggle"
        @click="toggleSidebar"
        :aria-label="sidebarOpen ? 'Close sidebar' : 'Open sidebar'"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path v-if="!sidebarOpen" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" />
          <path v-else d="M4.53 4.22a.75.75 0 010 1.06L1.06 8.75l3.47 3.47a.75.75 0 01-1.06 1.06l-4-4a.75.75 0 010-1.06l4-4a.75.75 0 011.06 0z" />
        </svg>
      </button>

      <router-link to="/" class="logo">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="6" fill="#3b82f6"/>
          <path d="M14 7L19 12L14 17L9 12L14 7Z" fill="white"/>
          <circle cx="14" cy="7" r="3" fill="white"/>
          <circle cx="9" cy="17" r="2" fill="white"/>
          <circle cx="19" cy="17" r="2" fill="white"/>
        </svg>
        <span class="logo-text">DevSprite</span>
      </router-link>
    </div>

    <div class="header-center">
      <div class="search-container">
        <SearchBar
          v-model="searchQuery"
          @search="handleSearch"
          placeholder="Search project..."
        />
      </div>
    </div>

    <div class="header-right">
      <button class="icon-button" aria-label="Notifications">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
        </svg>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useUIStore } from '@/stores/ui'
import { useSearchStore } from '@/stores/search'
import SearchBar from '@/components/common/SearchBar.vue'

const router = useRouter()
const route = useRoute()
const uiStore = useUIStore()
const searchStore = useSearchStore()
const { sidebarOpen } = storeToRefs(uiStore)

const searchQuery = ref('')

function toggleSidebar() {
  uiStore.toggleSidebar()
}

async function handleSearch(q: string) {
  if (!q.trim()) {
    searchStore.clearResults()
    return
  }
  const projectName = route.params.projectName as string
  const searchParams: Record<string, string> = { q }
  if (projectName) {
    searchParams.project = projectName
  }
  router.push({ name: 'search', query: searchParams })
}
</script>

<style scoped>
.app-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background-color: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.menu-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.menu-toggle:hover {
  background-color: var(--color-bg-secondary);
  color: var(--color-text);
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: var(--color-text);
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
}

.header-center {
  flex: 1;
  max-width: 480px;
  margin: 0 20px;
}

.search-container {
  width: 100%;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.icon-button:hover {
  background-color: var(--color-bg-secondary);
  color: var(--color-text);
}

@media (max-width: 640px) {
  .header-center {
    display: none;
  }

  .logo-text {
    display: none;
  }
}
</style>
