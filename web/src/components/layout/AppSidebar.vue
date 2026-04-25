<template>
  <aside class="app-sidebar">
    <div class="sidebar-header">
      <h2 class="sidebar-title">Files</h2>
      <button class="refresh-button" @click="refreshTree" aria-label="Refresh">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.5 2.5A5 5 0 0110 1h1v2h-1a3 3 0 00-3 3v1H5V4a5 5 0 00-.5-1.5zM1 8a7 7 0 1112.5 4.5L15 14l-1.414-1.414A5 5 0 011 8zm1 0a6 6 0 1011.26 2.894l1.06 1.06A7 7 0 112 8z" />
        </svg>
      </button>
    </div>

    <div v-if="loading" class="sidebar-loading">
      <LoadingSpinner size="small" />
    </div>

    <div v-else-if="error" class="sidebar-error">
      <p>{{ error }}</p>
    </div>

    <div v-else-if="!fileTree" class="sidebar-empty">
      <EmptyState
        title="No files"
        description="Project has no files yet"
        size="small"
      />
    </div>

    <FileTree v-else :tree="fileTree" class="sidebar-tree" />
  </aside>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useKnowledgeStore } from '@/stores/knowledge'
import FileTree from '@/components/tree/FileTree.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'

const route = useRoute()
const knowledgeStore = useKnowledgeStore()
const { fileTree, loading, error } = storeToRefs(knowledgeStore)

async function refreshTree() {
  const projectName = route.params.projectName as string
  await knowledgeStore.fetchFileTree(projectName)
}

onMounted(() => {
  if (!fileTree) {
    refreshTree()
  }
})
</script>

<style scoped>
.app-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--color-bg);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.sidebar-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: var(--color-text);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.refresh-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.refresh-button:hover {
  background-color: var(--color-bg-secondary);
  color: var(--color-text);
}

.sidebar-loading {
  display: flex;
  justify-content: center;
  padding: 32px 16px;
}

.sidebar-error {
  padding: 16px;
  color: var(--color-danger);
  font-size: 14px;
}

.sidebar-empty {
  padding: 32px 16px;
}

.sidebar-tree {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
</style>
