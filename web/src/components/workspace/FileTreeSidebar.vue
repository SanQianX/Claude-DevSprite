<template>
  <div class="file-tree-sidebar">
    <div class="sidebar-tabs">
      <button
        class="sidebar-tab"
        :class="{ active: activeTab === 'knowledge' }"
        @click="activeTab = 'knowledge'"
      >
        📄 知识库
      </button>
      <button
        class="sidebar-tab"
        :class="{ active: activeTab === 'source' }"
        @click="activeTab = 'source'"
      >
        📁 源码
      </button>
    </div>
    <div class="sidebar-content">
      <div v-if="loading" class="sidebar-loading">加载中...</div>
      <div v-else-if="currentTree.length === 0" class="sidebar-empty">暂无文件</div>
      <template v-else>
        <FileTreeNode
          v-for="node in currentTree"
          :key="node.path"
          :node="node"
          :selected-path="selectedPath"
          @select="$emit('file-select', $event)"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import FileTreeNode from './FileTreeNode.vue'

const props = defineProps<{
  projectName: string
  selectedPath?: string
}>()

defineEmits<{
  'file-select': [path: string]
}>()

const activeTab = ref<'knowledge' | 'source'>('knowledge')
const loading = ref(false)
const knowledgeTree = ref<any[]>([])
const sourceTree = ref<any[]>([])

const currentTree = computed(() =>
  activeTab.value === 'knowledge' ? knowledgeTree.value : sourceTree.value
)

async function fetchKnowledgeTree() {
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(props.projectName)}/tree`)
    if (res.ok) {
      const data = await res.json()
      knowledgeTree.value = data.tree || data || []
    }
  } catch {
    knowledgeTree.value = []
  }
}

async function fetchSourceTree() {
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(props.projectName)}/source-tree`)
    if (res.ok) {
      const data = await res.json()
      sourceTree.value = data.tree || data || []
    }
  } catch {
    sourceTree.value = []
  }
}

async function fetchTrees() {
  loading.value = true
  await Promise.all([fetchKnowledgeTree(), fetchSourceTree()])
  loading.value = false
}

onMounted(fetchTrees)

watch(() => props.projectName, fetchTrees)
</script>

<style scoped>
.file-tree-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: 1px solid #e2e8f0;
  background: #f8fafc;
}

.sidebar-tabs {
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.sidebar-tab {
  flex: 1;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 150ms;
}

.sidebar-tab:hover {
  color: #1e293b;
  background: #f1f5f9;
}

.sidebar-tab.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
  background: #fff;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.sidebar-loading,
.sidebar-empty {
  text-align: center;
  color: #94a3b8;
  font-size: 12px;
  padding: 20px;
}
</style>
