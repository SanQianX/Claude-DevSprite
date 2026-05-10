<template>
  <div class="code-panel">
    <div class="panel-header">
      <div class="panel-title">
        <span>📁</span> 源码
      </div>
      <button class="panel-close" @click="$emit('close')">✕</button>
    </div>
    <div class="panel-content">
      <div v-if="!currentFile" class="file-tree-container">
        <div v-if="loading" class="loading-state">加载中...</div>
        <div v-else-if="tree.length === 0" class="empty-state">
          暂无源码文件
        </div>
        <div v-else class="file-tree">
          <FileTreeNode
            v-for="node in tree"
            :key="node.path"
            :node="node"
            :project-name="projectName"
            @select="selectFile"
          />
        </div>
      </div>
      <div v-else class="code-viewer">
        <div class="code-nav">
          <button class="back-btn" @click="currentFile = null">← 文件树</button>
          <span class="file-path">{{ currentFile.path }}</span>
        </div>
        <div class="code-body">
          <div class="line-numbers">
            <div v-for="(_, i) in codeLines" :key="i" class="line-num">{{ i + 1 }}</div>
          </div>
          <pre class="code-content"><code>{{ codeContent }}</code></pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import FileTreeNode from './FileTreeNode.vue'

const props = defineProps<{
  projectName: string
}>()

const emit = defineEmits<{
  close: []
  fileSelect: [path: string]
}>()

interface TreeNode {
  name: string
  path: string
  type: string
  children?: TreeNode[]
}

const tree = ref<TreeNode[]>([])
const currentFile = ref<TreeNode | null>(null)
const codeContent = ref('')
const codeLines = ref<string[]>([])
const loading = ref(false)

async function fetchTree() {
  loading.value = true
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(props.projectName)}/source-tree`)
    const data = await res.json()
    tree.value = data.tree || []
  } catch {
    tree.value = []
  } finally {
    loading.value = false
  }
}

async function selectFile(node: TreeNode) {
  currentFile.value = node
  emit('fileSelect', node.path)

  try {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(props.projectName)}/source-file?path=${encodeURIComponent(node.path)}`
    )
    const data = await res.json()
    if (data.content) {
      codeContent.value = data.content
      codeLines.value = data.content.split('\n')
    }
  } catch {
    codeContent.value = '// 加载文件失败'
    codeLines.value = ['// 加载文件失败']
  }
}

onMounted(() => {
  fetchTree()
})

watch(() => props.projectName, () => {
  currentFile.value = null
  fetchTree()
})
</script>

<style scoped>
.code-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  flex-shrink: 0;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-close {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #94a3b8;
  cursor: pointer;
  background: none;
  border: none;
}

.panel-close:hover {
  background: #fee2e2;
  color: #dc2626;
}

.panel-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.loading-state, .empty-state {
  padding: 40px 20px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
}

.file-tree-container {
  overflow-y: auto;
  padding: 8px;
}

.file-tree {
  font-size: 13px;
}

.code-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  flex-shrink: 0;
}

.back-btn {
  padding: 4px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  background: #fff;
  color: #475569;
}

.back-btn:hover {
  background: #f1f5f9;
}

.file-path {
  font-size: 12px;
  color: #94a3b8;
  font-family: monospace;
}

.code-body {
  flex: 1;
  display: flex;
  overflow: auto;
  background: #1e293b;
}

.line-numbers {
  padding: 16px 12px;
  text-align: right;
  color: #64748b;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.6;
  user-select: none;
  border-right: 1px solid #334155;
}

.line-num {
  min-width: 30px;
}

.code-content {
  flex: 1;
  padding: 16px;
  margin: 0;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: #e2e8f0;
  overflow-x: auto;
  white-space: pre;
}
</style>
