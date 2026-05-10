<template>
  <div class="tree-node">
    <div
      class="node-row"
      :style="{ paddingLeft: (depth * 16) + 'px' }"
      @click="handleClick"
    >
      <span v-if="node.type === 'directory'" class="node-arrow" :class="{ open: expanded }">
        ▸
      </span>
      <span v-else class="node-spacer"></span>
      <span class="node-icon">{{ node.type === 'directory' ? '📁' : '📄' }}</span>
      <span class="node-name">{{ node.name }}</span>
    </div>
    <div v-if="node.type === 'directory' && expanded && node.children" class="node-children">
      <FileTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :project-name="projectName"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface TreeNode {
  name: string
  path: string
  type: string
  children?: TreeNode[]
}

const props = withDefaults(defineProps<{
  node: TreeNode
  depth?: number
  projectName: string
}>(), {
  depth: 0,
})

const emit = defineEmits<{
  select: [node: TreeNode]
}>()

const expanded = ref(props.depth < 1)

function handleClick() {
  if (props.node.type === 'directory') {
    expanded.value = !expanded.value
  } else {
    emit('select', props.node)
  }
}
</script>

<style scoped>
.node-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: #475569;
  transition: background 100ms;
}

.node-row:hover {
  background: #f1f5f9;
}

.node-arrow {
  font-size: 10px;
  color: #94a3b8;
  width: 12px;
  text-align: center;
  transition: transform 150ms;
}

.node-arrow.open {
  transform: rotate(90deg);
}

.node-spacer {
  width: 12px;
}

.node-icon {
  font-size: 14px;
}

.node-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
