import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SearchResult } from '@/types'
import { searchApi } from '@/api/search'

export const useSearchStore = defineStore('search', () => {
  const query = ref('')
  const results = ref<SearchResult[]>([])
  const isSearching = ref(false)
  const error = ref<string | null>(null)

  async function searchProject(projectName: string, searchQuery: string) {
    if (!searchQuery.trim()) {
      results.value = []
      return
    }

    isSearching.value = true
    error.value = null
    query.value = searchQuery

    try {
      const response = await searchApi.searchProject(projectName, searchQuery)
      results.value = response.results
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      results.value = []
    } finally {
      isSearching.value = false
    }
  }

  async function searchAllProjects(searchQuery: string) {
    if (!searchQuery.trim()) {
      results.value = []
      return
    }

    isSearching.value = true
    error.value = null
    query.value = searchQuery

    try {
      const response = await searchApi.searchAllProjects(searchQuery)
      results.value = response.results
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      results.value = []
    } finally {
      isSearching.value = false
    }
  }

  function clearResults() {
    results.value = []
    query.value = ''
    error.value = null
  }

  return {
    query,
    results,
    isSearching,
    error,
    searchProject,
    searchAllProjects,
    clearResults
  }
})
