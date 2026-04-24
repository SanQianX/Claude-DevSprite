import { computed } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledge'

export function useDocument() {
  const knowledgeStore = useKnowledgeStore()

  const currentDocument = computed(() => knowledgeStore.currentDocument)
  const loading = computed(() => knowledgeStore.loading)
  const error = computed(() => knowledgeStore.error)

  async function fetchDocument(projectName: string, path: string) {
    await knowledgeStore.fetchDocument(projectName, path)
  }

  function clearDocument() {
    knowledgeStore.clearDocument()
  }

  return {
    currentDocument,
    loading,
    error,
    fetchDocument,
    clearDocument
  }
}
