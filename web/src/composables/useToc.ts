import { computed } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledge'

export function useToc() {
  const knowledgeStore = useKnowledgeStore()

  const toc = computed(() => knowledgeStore.toc)

  function generateToc(content: string) {
    knowledgeStore.generateToc(content)
  }

  return {
    toc,
    generateToc
  }
}
