<template>
  <div class="search-results-page">
    <AppHeader />

    <header class="search-header">
      <h1 class="search-title">Search Results</h1>
      <p class="search-subtitle" v-if="query">
        {{ results.length }} result{{ results.length !== 1 ? 's' : '' }} for "<span class="query-text">{{ query }}</span>"
      </p>
    </header>

    <div v-if="isSearching" class="loading-container">
      <LoadingSpinner />
    </div>

    <div v-else-if="error" class="error-container">
      <p class="error-message">{{ error }}</p>
      <button @click="retrySearch" class="retry-button">Retry</button>
    </div>

    <div v-else-if="results.length === 0 && query" class="empty-container">
      <EmptyState
        title="No results found"
        description="Try different keywords or check your spelling"
      />
    </div>

    <div v-else-if="!query" class="empty-container">
      <EmptyState
        title="Search your projects"
        description="Enter keywords in the search bar above to find documents"
      />
    </div>

    <div v-else class="results-container">
      <div
        v-for="result in results"
        :key="result.path + result.projectName"
        class="result-card"
        @click="navigateToResult(result)"
      >
        <div class="result-header">
          <span class="result-type-badge">{{ result.type }}</span>
          <span v-if="result.category" class="result-category">{{ result.category }}</span>
          <span class="result-matches">{{ result.matches }} match{{ result.matches !== 1 ? 'es' : '' }}</span>
        </div>
        <h3 class="result-title">{{ result.title }}</h3>
        <p class="result-path">{{ result.projectName ? result.projectName + ' / ' : '' }}{{ result.path }}</p>
        <p class="result-snippet" v-html="highlightSnippet(result.snippet)"></p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useSearchStore } from '@/stores/search'
import type { SearchResult } from '@/types'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import AppHeader from '@/components/layout/AppHeader.vue'

const route = useRoute()
const router = useRouter()
const searchStore = useSearchStore()
const { query, results, isSearching, error } = storeToRefs(searchStore)

const searchQueryFromUrl = computed(() => (route.query.q as string) || '')

onMounted(() => {
  if (searchQueryFromUrl.value) {
    performSearch(searchQueryFromUrl.value)
  }
})

watch(searchQueryFromUrl, (newQuery) => {
  if (newQuery && newQuery !== query.value) {
    performSearch(newQuery)
  }
})

async function performSearch(q: string) {
  const projectName = route.query.project as string
  if (projectName) {
    await searchStore.searchProject(projectName, q)
  } else {
    await searchStore.searchAllProjects(q)
  }
}

function retrySearch() {
  if (searchQueryFromUrl.value) {
    performSearch(searchQueryFromUrl.value)
  }
}

function navigateToResult(result: SearchResult) {
  const projectName = result.projectName || (route.query.project as string)
  if (projectName && result.type === 'document') {
    router.push(`/project/${projectName}/doc/${result.path}`)
  }
}

function highlightSnippet(snippet: string): string {
  if (!query.value || !snippet) return escapeHtml(snippet || '')
  const escaped = escapeHtml(snippet)
  const q = escapeHtml(query.value)
  const regex = new RegExp(`(${escapeRegex(q)})`, 'gi')
  return escaped.replace(regex, '<mark>$1</mark>')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
</script>

<style scoped>
.search-results-page {
  min-height: 100vh;
  background-color: var(--color-bg);
}

.search-header {
  text-align: center;
  padding: 48px 24px 32px;
  border-bottom: 1px solid var(--color-border);
}

.search-title {
  font-size: 36px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 12px;
}

.search-subtitle {
  font-size: 16px;
  color: var(--color-text-secondary);
  margin: 0;
}

.query-text {
  color: var(--color-primary);
  font-weight: 600;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 64px 24px;
}

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64px 24px;
}

.error-message {
  color: var(--color-danger);
  margin-bottom: 16px;
}

.retry-button {
  padding: 8px 24px;
  background-color: var(--color-primary);
  color: white;
  border-radius: var(--radius-md);
  font-weight: 500;
}

.retry-button:hover {
  background-color: var(--color-primary-hover);
}

.empty-container {
  padding: 64px 24px;
}

.results-container {
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
}

.result-card {
  padding: 16px 20px;
  margin-bottom: 12px;
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.result-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.result-type-badge {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background-color: var(--color-primary);
  color: white;
}

.result-category {
  font-size: 12px;
  color: var(--color-text-muted);
  background-color: var(--color-bg-tertiary);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}

.result-matches {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-left: auto;
}

.result-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 4px;
}

.result-path {
  font-size: 13px;
  color: var(--color-text-muted);
  margin: 0 0 8px;
}

.result-snippet {
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 0;
  white-space: pre-line;
}

.result-snippet :deep(mark) {
  background-color: rgba(59, 130, 246, 0.2);
  color: var(--color-primary);
  padding: 1px 2px;
  border-radius: 2px;
}

@media (max-width: 768px) {
  .search-title {
    font-size: 28px;
  }

  .results-container {
    padding: 16px;
  }

  .result-card {
    padding: 12px 16px;
  }
}
</style>
