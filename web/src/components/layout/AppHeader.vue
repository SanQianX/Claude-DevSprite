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
          :placeholder="t('common.search')"
        />
      </div>
    </div>

    <div class="header-right">
      <div v-if="isRunning" class="analysis-indicator" :title="stepLabel">
        <span class="pulse-dot"></span>
        <span class="indicator-text">{{ currentProject || 'Analyzing...' }}</span>
      </div>

      <!-- Language Switcher -->
      <button class="icon-button" :title="t('common.language')" @click="uiStore.toggleLocale()">
        <span class="lang-label">{{ locale === 'zh-CN' ? '中' : 'EN' }}</span>
      </button>

      <!-- Theme Toggle -->
      <button class="icon-button" :title="t('common.theme')" @click="toggleTheme">
        <svg v-if="theme === 'light'" width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 018 1zm0 10a2 2 0 100-4 2 2 0 000 4zm5.25-2.75a.75.75 0 010 1.5h-1.5a.75.75 0 010-1.5h1.5zM8 12a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 018 12zm-3.75-3.75a.75.75 0 010 1.5h-1.5a.75.75 0 010-1.5h1.5zm7.03-4.28a.75.75 0 010 1.06l-1.06 1.06a.75.75 0 11-1.06-1.06l1.06-1.06a.75.75 0 011.06 0zM5.78 9.72a.75.75 0 010 1.06L4.72 11.84a.75.75 0 01-1.06-1.06l1.06-1.06a.75.75 0 011.06 0zm6.5-6.5a.75.75 0 010 1.06L11.22 5.34a.75.75 0 01-1.06-1.06l1.06-1.06a.75.75 0 011.06 0zM5.78 6.28a.75.75 0 010 1.06L4.72 8.4a.75.75 0 01-1.06-1.06l1.06-1.06a.75.75 0 011.06 0z"/>
        </svg>
        <svg v-else width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
          <path d="M9.598 1.591a.75.75 0 01.785-.175 7 7 0 11-8.967 8.967.75.75 0 01.961-.967 5.5 5.5 0 007.046-7.046.75.75 0 01.175-.785zm1.616 1.334a7.004 7.004 0 01-4.68 9.263 5.504 5.504 0 004.68-9.263z"/>
        </svg>
      </button>

      <!-- Settings -->
      <router-link to="/settings" class="icon-button" :title="t('common.settings')" aria-label="Settings">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
          <path fill-rule="evenodd" d="M9.19 2.53c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM8 10.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" clip-rule="evenodd"/>
        </svg>
      </router-link>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useSearchStore } from '@/stores/search'
import { useAnalysisStore } from '@/stores/analysis'
import { useUIStore } from '@/stores/ui'
import SearchBar from '@/components/common/SearchBar.vue'

const router = useRouter()
const route = useRoute()
const searchStore = useSearchStore()
const analysisStore = useAnalysisStore()
const uiStore = useUIStore()
const { isRunning, currentProject, stepLabel } = storeToRefs(analysisStore)
const { theme, locale, t } = storeToRefs(uiStore)

const searchQuery = ref('')

function toggleTheme() {
  uiStore.setTheme(theme.value === 'light' ? 'dark' : 'light')
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

onMounted(() => {
  analysisStore.connectSSE()
})

// Don't disconnect SSE on unmount — the store is global and the connection
// should persist across page navigations. connectSSE() already handles
// closing any existing connection before creating a new one.
</script>

<style scoped>
.app-header {
  height: 56px;
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
  gap: 4px;
}

.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md, 6px);
  color: var(--color-text-secondary, #656d76);
  transition: all var(--transition-fast, 150ms ease);
  cursor: pointer;
  border: none;
  background: none;
  text-decoration: none;
}

.icon-button:hover {
  background-color: var(--color-bg-secondary, #f6f8fa);
  color: var(--color-text, #1f2328);
}

.lang-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.analysis-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-md, 6px);
  background-color: rgba(59, 130, 246, 0.1);
  font-size: 12px;
  color: var(--color-text-link, #0969da);
  white-space: nowrap;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-text-link, #0969da);
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
