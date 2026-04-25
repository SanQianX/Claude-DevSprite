<template>
  <div class="document-view" ref="documentViewRef">
    <div v-if="loading" class="loading-container">
      <LoadingSpinner />
    </div>

    <div v-else-if="error" class="error-container">
      <p class="error-message">{{ error }}</p>
      <button @click="loadDocument" class="retry-button">Retry</button>
    </div>

    <div v-else-if="!document" class="empty-container">
      <EmptyState
        title="Document not found"
        description="The document you're looking for doesn't exist"
      />
    </div>

    <div v-else class="document-content">
      <div class="document-header">
        <Breadcrumb :items="breadcrumbItems" />

        <h1 class="document-title">{{ document.title }}</h1>

        <div class="document-meta">
          <span class="meta-item">
            <span class="meta-label">Category:</span>
            <span class="meta-value">{{ document.meta.category }}</span>
          </span>
          <span class="meta-item">
            <span class="meta-label">Updated:</span>
            <span class="meta-value">{{ formatDate(document.meta.updatedAt) }}</span>
          </span>
        </div>
      </div>

      <div class="document-body">
        <MarkdownViewer :content="document.content" @link-click="handleLinkClick" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useProjectsStore } from '@/stores/projects'
import MarkdownViewer from '@/components/viewer/MarkdownViewer.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Breadcrumb from '@/components/common/Breadcrumb.vue'

const route = useRoute()
const router = useRouter()
const knowledgeStore = useKnowledgeStore()
const projectsStore = useProjectsStore()

const { currentDocument: document, loading, error } = storeToRefs(knowledgeStore)
const { currentProject } = storeToRefs(projectsStore)

const documentViewRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
let loadGeneration = 0

const breadcrumbItems = computed(() => {
  const projectName = route.params.projectName as string
  const path = (route.params.path as string) || ''

  const items = [
    { label: 'Projects', to: '/' },
    { label: projectName, to: `/project/${projectName}` }
  ]

  if (path) {
    const parts = path.split('/').filter(Boolean)
    items.push(...parts.map((part, index, arr) => ({
      label: part,
      to: index === arr.length - 1 ? undefined : `/project/${projectName}/doc/${parts.slice(0, index + 1).join('/')}`
    })))
  }

  return items
})

async function loadDocument() {
  const projectName = route.params.projectName as string
  const path = (route.params.path as string) || ''
  const thisGeneration = ++loadGeneration
  await knowledgeStore.fetchDocument(projectName, path)
  // Only set up observer if this is still the latest load
  if (thisGeneration === loadGeneration) {
    nextTick(() => {
      setupScrollObserver()
    })
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// TOC scroll sync via IntersectionObserver
function setupScrollObserver() {
  if (observer) {
    observer.disconnect()
    observer = null
  }

  const viewEl = documentViewRef.value
  if (!viewEl) return

  const headings = viewEl.querySelectorAll('.markdown-viewer h1, .markdown-viewer h2, .markdown-viewer h3, .markdown-viewer h4, .markdown-viewer h5, .markdown-viewer h6')
  if (headings.length === 0) return

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const headingId = entry.target.id
          if (headingId) {
            knowledgeStore.setActiveHeading(headingId)
          }
        }
      }
    },
    {
      root: viewEl,
      rootMargin: '-60px 0px -70% 0px',
      threshold: 0
    }
  )

  headings.forEach((heading) => observer!.observe(heading))
}

function handleLinkClick(href: string, _event: MouseEvent) {
  const projectName = route.params.projectName as string
  const currentPath = (route.params.path as string) || ''

  // Source file links: /project/X/source?path=Y
  if (href.startsWith('/project/')) {
    router.push(href)
    return
  }

  // Relative document links
  let resolvedPath = href
  if (href.startsWith('../')) {
    const dir = currentPath.includes('/') ? currentPath.substring(0, currentPath.lastIndexOf('/')) : ''
    const parts = dir ? dir.split('/') : []
    const relativeParts = href.split('/')
    for (const part of relativeParts) {
      if (part === '..') {
        parts.pop()
      } else if (part !== '.' && part !== '') {
        parts.push(part)
      }
    }
    resolvedPath = parts.join('/')
  } else if (!href.startsWith('/')) {
    const dir = currentPath.includes('/') ? currentPath.substring(0, currentPath.lastIndexOf('/') + 1) : ''
    resolvedPath = dir + href
  }

  // Remove .md extension if present
  resolvedPath = resolvedPath.replace(/\.md$/, '')

  // Handle hash fragments
  const [cleanPath, hash] = resolvedPath.split('#')

  router.push({
    path: `/project/${projectName}/doc/${cleanPath}`,
    hash: hash ? `#${hash}` : undefined
  })
}

onMounted(() => {
  loadDocument()
})

onBeforeUnmount(() => {
  if (observer) {
    observer.disconnect()
    observer = null
  }
})

watch(
  () => route.params.path,
  () => {
    loadDocument()
  }
)
</script>

<style scoped>
.document-view {
  height: 100%;
  overflow-y: auto;
}

.loading-container,
.error-container,
.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 32px;
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

.document-content {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px;
}

.document-header {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--color-border);
}

.document-title {
  font-size: 32px;
  font-weight: 700;
  margin: 16px 0;
  color: var(--color-text);
  line-height: 1.2;
}

.document-meta {
  display: flex;
  gap: 24px;
  font-size: 14px;
  color: var(--color-text-secondary);
}

.meta-item {
  display: flex;
  gap: 4px;
}

.meta-label {
  color: var(--color-text-muted);
}

.meta-value {
  font-weight: 500;
}

.document-body {
  line-height: 1.8;
}

@media (max-width: 640px) {
  .document-content {
    padding: 16px;
  }

  .document-title {
    font-size: 24px;
  }

  .document-meta {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
