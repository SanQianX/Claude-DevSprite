<template>
  <div class="file-tree">
    <FileTreeNode
      v-for="node in tree.children"
      :key="node.path"
      :node="node"
      :level="0"
    />
  </div>
</template>

<script setup lang="ts">
import type { TreeNode } from '@/types'
import FileTreeNode from './FileTreeNode.vue'

defineProps<{
  tree: TreeNode
}>()
</script>

<style scoped>
.file-tree {
  font-size: 14px;
}
</style>
