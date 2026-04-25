<template>
  <div class="tree-node">
    <div
      class="tree-node-content"
      :style="{ paddingLeft: `${level * 16 + 8}px` }"
      @click="handleClick"
    >
      <span v-if="node.type === 'directory'" class="tree-expand-icon">
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="currentColor"
          :class="{ 'tree-expand-icon--expanded': isExpanded }"
        >
          <path d="M4 2l4 4-4 4V2z" />
        </svg>
      </span>

      <span v-else class="tree-file-icon">📄</span>

      <span class="tree-node-name">{{ node.name }}</span>
    </div>

    <div v-if="node.type === 'directory' && isExpanded" class="tree-node-children">
      <FileTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :level="level + 1"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { FileTreeNode } from '@/types'
import { useKnowledgeStore } from '@/stores/knowledge'

const props = defineProps<{
  node: FileTreeNode
  level: number
}>()

const router = useRouter()
const knowledgeStore = useKnowledgeStore()

const isExpanded = computed(() => knowledgeStore.isPathExpanded(props.node.path))

function handleClick() {
  if (props.node.type === 'directory') {
    knowledgeStore.togglePath(props.node.path)
  } else {
    const projectName = router.currentRoute.value.params.projectName as string
    router.push(`/project/${projectName}/doc/${props.node.path}`)
  }
}
</script>

<style scoped>
.tree-node {
  user-select: none;
}

.tree-node-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-fast);
}

.tree-node-content:hover {
  background-color: var(--color-bg-secondary);
}

.tree-expand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  color: var(--color-text-muted);
  transition: transform var(--transition-fast);
}

.tree-expand-icon--expanded {
  transform: rotate(90deg);
}

.tree-file-icon {
  font-size: 14px;
}

.tree-node-name {
  flex: 1;
  color: var(--color-text);
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-node-children {
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
