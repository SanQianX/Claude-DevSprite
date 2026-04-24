import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FileTreeNode, DocumentData, TocItem } from '@/types'
import { projectsApi } from '@/api/projects'

export const useKnowledgeStore = defineStore('knowledge', () => {
  const fileTree = ref<FileTreeNode | null>(null)
  const currentDocument = ref<DocumentData | null>(null)
  const toc = ref<TocItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const expandedPaths = ref<Set<string>>(new Set())

  async function fetchFileTree(projectName: string) {
    loading.value = true
    error.value = null
    try {
      const response = await projectsApi.getProjectTree(projectName)
      fileTree.value = response.tree
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  async function fetchDocument(projectName: string, path: string) {
    loading.value = true
    error.value = null
    try {
      const document = await projectsApi.getProjectFile(projectName, path)
      currentDocument.value = document
      generateToc(document.content)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  function generateToc(content: string) {
    const items: TocItem[] = []
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/)
      if (match) {
        const level = match[1].length
        const text = match[2].trim()
        items.push({
          id: `heading-${index}`,
          text,
          level
        })
      }
    })

    toc.value = items
  }

  function togglePath(path: string) {
    if (expandedPaths.value.has(path)) {
      expandedPaths.value.delete(path)
    } else {
      expandedPaths.value.add(path)
    }
  }

  function isPathExpanded(path: string): boolean {
    return expandedPaths.value.has(path)
  }

  function clearDocument() {
    currentDocument.value = null
    toc.value = []
  }

  return {
    fileTree,
    currentDocument,
    toc,
    loading,
    error,
    expandedPaths,
    fetchFileTree,
    fetchDocument,
    generateToc,
    togglePath,
    isPathExpanded,
    clearDocument
  }
})
