import { computed } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledge'

export function useFileTree() {
  const knowledgeStore = useKnowledgeStore()

  const fileTree = computed(() => knowledgeStore.fileTree)
  const loading = computed(() => knowledgeStore.loading)
  const error = computed(() => knowledgeStore.error)

  async function fetchFileTree(projectName: string) {
    await knowledgeStore.fetchFileTree(projectName)
  }

  function togglePath(path: string) {
    knowledgeStore.togglePath(path)
  }

  function isPathExpanded(path: string) {
    return knowledgeStore.isPathExpanded(path)
  }

  return {
    fileTree,
    loading,
    error,
    fetchFileTree,
    togglePath,
    isPathExpanded
  }
}
