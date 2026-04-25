<template>
  <div class="source-view">
    <AppHeader />

    <div v-if="loading" class="loading-container">
      <LoadingSpinner />
    </div>

    <div v-else-if="error" class="error-container">
      <p class="error-message">{{ error }}</p>
      <button @click="loadSource" class="retry-button">Retry</button>
    </div>

    <div v-else-if="!source" class="empty-container">
      <EmptyState title="Source not found" description="The source file doesn't exist" />
    </div>

    <div v-else class="source-content">
      <div class="source-header">
        <Breadcrumb :items="breadcrumbItems" />
        <div class="source-meta">
          <span class="meta-badge">{{ source.language }}</span>
          <span class="meta-lines">{{ source.startLine }}-{{ source.endLine }} of {{ source.totalLines }} lines</span>
        </div>
      </div>

      <div class="source-body">
        <SourceViewer :data="source" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ref } from 'vue'
import { filesApi } from '@/api/files'
import type { SourceCodeData } from '@/types'
import AppHeader from '@/components/layout/AppHeader.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Breadcrumb from '@/components/common/Breadcrumb.vue'
import SourceViewer from '@/components/viewer/SourceViewer.vue'

const route = useRoute()
const source = ref<SourceCodeData | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const projectName = computed(() => route.params.projectName as string)
const filePath = computed(() => (route.query.path as string) || '')

const breadcrumbItems = computed(() => [
  { label: 'Projects', to: '/' },
  { label: projectName.value, to: `/project/${projectName.value}` },
  { label: filePath.value.split('/').pop() || 'Source' }
])

async function loadSource() {
  if (!filePath.value) {
    error.value = 'No file path specified'
    return
  }
  loading.value = true
  error.value = null
  try {
    source.value = await filesApi.getSourceCode(projectName.value, filePath.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load source'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadSource()
})
</script>

<style scoped>
.source-view {
  min-height: 100vh;
  background-color: var(--color-bg);
}

.loading-container,
.error-container,
.empty-container {
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

.source-content {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px;
}

.source-header {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
}

.source-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.meta-badge {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: var(--radius-sm);
  background-color: var(--color-primary);
  color: white;
}

.meta-lines {
  font-size: 13px;
  color: var(--color-text-muted);
}

.source-body {
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}
</style>
