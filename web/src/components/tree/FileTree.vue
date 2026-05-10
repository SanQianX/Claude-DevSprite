<template>
  <div class="file-tree">
    <div v-if="!tree.children || tree.children.length === 0" class="empty-tree">
      <span class="empty-icon">📂</span>
      <span class="empty-text">{{ t('home.noFilesYet') || 'No files yet, analysis will generate documents' }}</span>
    </div>
    <FileTreeNodeComponent
      v-for="node in tree.children"
      :key="node.path"
      :node="node"
      :level="0"
    />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { FileTreeNode } from '@/types'
import { useUIStore } from '@/stores/ui'
import FileTreeNodeComponent from './FileTreeNode.vue'

defineProps<{
  tree: FileTreeNode
}>()

const { t } = storeToRefs(useUIStore())
</script>

<style scoped>
.file-tree {
  font-size: 14px;
}

.empty-tree {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 16px;
  color: var(--color-text-secondary, #656d76);
}

.empty-icon {
  font-size: 32px;
}

.empty-text {
  font-size: 13px;
  text-align: center;
}
</style>
