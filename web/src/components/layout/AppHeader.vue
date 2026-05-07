<template>
  <header class="app-header">
    <div class="header-left">
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

    <router-link to="/settings" class="icon-button settings-btn" aria-label="Settings" title="System Settings">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
      </svg>
    </router-link>

    <div class="header-right">
      <div v-if="isRunning" class="analysis-indicator" :title="stepLabel">
        <span class="pulse-dot"></span>
        <span class="indicator-text">{{ currentProject || 'Analyzing...' }}</span>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useSearchStore } from '@/stores/search'
import { useAnalysisStore } from '@/stores/analysis'
import SearchBar from '@/components/common/SearchBar.vue'

const router = useRouter()
const route = useRoute()
const searchStore = useSearchStore()
const analysisStore = useAnalysisStore()
const { isRunning, currentProject, stepLabel } = storeToRefs(analysisStore)

const searchQuery = ref('')

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

onMounted(() => {
  analysisStore.connectSSE()
})

onUnmounted(() => {
  analysisStore.disconnectSSE()
})
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
  max-width: 680px;
  margin: 0 16px;
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

.analysis-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-md);
  background-color: rgba(59, 130, 246, 0.1);
  font-size: 12px;
  color: var(--color-primary);
  white-space: nowrap;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-primary);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.indicator-text {
  font-weight: 500;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
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
