<template>
  <div class="file-tree">
    <FileTreeNodeComponent
      v-for="node in tree.children"
      :key="node.path"
      :node="node"
      :level="0"
    />
  </div>
</template>

<script setup lang="ts">
import type { FileTreeNode } from '@/types'
import FileTreeNodeComponent from './FileTreeNode.vue'

defineProps<{
  tree: FileTreeNode
}>()
</script>

<style scoped>
.file-tree {
  font-size: 14px;
}
</style>
