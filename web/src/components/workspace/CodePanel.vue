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
        <div class="code-body" ref="codeBodyRef">
          <div class="line-numbers">
            <div
              v-for="(_, i) in codeLines"
              :key="i"
              class="line-num"
              :class="{ highlighted: i + 1 === highlightedLine }"
            >{{ i + 1 }}</div>
          </div>
          <pre class="code-content"><code v-for="(line, i) in codeLines" :key="i" :class="['code-line', 'code-line-' + (i + 1), { highlighted: i + 1 === highlightedLine }]">{{ line }}
</code></pre>
        </div>
        <!-- Related Docs Section -->
        <div v-if="relatedDocs.length > 0 || loadingRelated" class="related-docs">
          <div class="related-header">
            <span class="related-icon">📄</span>
            <span class="related-title">关联文档</span>
            <span class="related-count">{{ relatedDocs.length }}</span>
          </div>
          <div v-if="loadingRelated" class="related-loading">搜索中...</div>
          <div v-else class="related-list">
            <div
              v-for="doc in relatedDocs"
              :key="doc.path"
              class="related-item"
              @click="openRelatedDoc(doc.path)"
            >
              <span class="related-doc-title">{{ doc.title }}</span>
              <span class="related-doc-path">{{ doc.path }}</span>
              <span class="related-doc-lines">L{{ doc.lines.join(', L') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import FileTreeNode from './FileTreeNode.vue'

const props = withDefaults(defineProps<{
  projectName: string
  highlightPath?: string
  highlightLine?: number
}>(), {
  highlightPath: '',
  highlightLine: 0,
})

const emit = defineEmits<{
  close: []
  fileSelect: [path: string]
  docNavigate: [docPath: string]
}>()

interface TreeNode {
  name: string
  path: string
  type: string
  children?: TreeNode[]
}

interface RelatedDoc {
  path: string
  title: string
  lines: number[]
}

const tree = ref<TreeNode[]>([])
const currentFile = ref<TreeNode | null>(null)
const codeContent = ref('')
const codeLines = ref<string[]>([])
const loading = ref(false)
const loadingFile = ref(false)
const highlightedLine = ref(0)
const relatedDocs = ref<RelatedDoc[]>([])
const loadingRelated = ref(false)
const codeBodyRef = ref<HTMLElement | null>(null)

async function fetchTree() {
  loading.value = true
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(props.projectName)}/source-tree`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    tree.value = data.tree || []
  } catch (err) {
    console.error('Failed to fetch source tree:', err)
    tree.value = []
  } finally {
    loading.value = false
  }
}

async function loadFile(filePath: string, line: number = 0) {
  loadingFile.value = true
  try {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(props.projectName)}/source-file?path=${encodeURIComponent(filePath)}`
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.content) {
      // Find the node in tree
      const node = findNodeInTree(tree.value, filePath)
      currentFile.value = node || { name: filePath.split('/').pop() || filePath, path: filePath, type: 'file' }
      codeContent.value = data.content
      codeLines.value = data.content.split('\n')
      highlightedLine.value = line
      emit('fileSelect', filePath)

      if (line > 0) {
        await nextTick()
        scrollToLine(line)
      }

      fetchRelatedDocs(filePath)
    }
  } catch (err) {
    console.error('Failed to load file:', err)
    codeContent.value = '// 加载文件失败'
    codeLines.value = ['// 加载文件失败']
  } finally {
    loadingFile.value = false
  }
}

async function fetchRelatedDocs(filePath: string) {
  loadingRelated.value = true
  try {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(props.projectName)}/related-docs?path=${encodeURIComponent(filePath)}`
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    relatedDocs.value = data.docs || []
  } catch (err) {
    console.error('Failed to fetch related docs:', err)
    relatedDocs.value = []
  } finally {
    loadingRelated.value = false
  }
}

function findNodeInTree(nodes: TreeNode[], path: string): TreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.children) {
      const found = findNodeInTree(node.children, path)
      if (found) return found
    }
  }
  return null
}

function scrollToLine(line: number) {
  if (!codeBodyRef.value) return
  const lineEl = codeBodyRef.value.querySelector(`.code-line-${line}`)
  if (lineEl) {
    lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

async function selectFile(node: TreeNode) {
  currentFile.value = node
  emit('fileSelect', node.path)
  loadingFile.value = true

  try {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(props.projectName)}/source-file?path=${encodeURIComponent(node.path)}`
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.content) {
      codeContent.value = data.content
      codeLines.value = data.content.split('\n')
      fetchRelatedDocs(node.path)
    }
  } catch (err) {
    console.error('Failed to load file:', err)
    codeContent.value = '// 加载文件失败'
    codeLines.value = ['// 加载文件失败']
  } finally {
    loadingFile.value = false
  }
}

function openRelatedDoc(docPath: string) {
  emit('docNavigate', docPath)
}

onMounted(() => {
  fetchTree()
})

watch(() => props.projectName, () => {
  currentFile.value = null
  fetchTree()
})

watch(() => props.highlightPath, (newPath) => {
  if (newPath) {
    loadFile(newPath, props.highlightLine)
  }
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

.line-num.highlighted {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.code-line.highlighted {
  background: rgba(59, 130, 246, 0.15);
  border-left: 3px solid #3b82f6;
  animation: highlight-fade 2s ease-out;
}

@keyframes highlight-fade {
  0% { background: rgba(59, 130, 246, 0.4); }
  100% { background: rgba(59, 130, 246, 0.15); }
}

.related-docs {
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  flex-shrink: 0;
  max-height: 180px;
  overflow-y: auto;
}

.related-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
}

.related-icon {
  font-size: 12px;
}

.related-count {
  background: #e2e8f0;
  color: #64748b;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 500;
}

.related-loading {
  padding: 12px 16px;
  font-size: 12px;
  color: #94a3b8;
  text-align: center;
}

.related-list {
  padding: 4px 0;
}

.related-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  cursor: pointer;
  font-size: 12px;
  transition: background 150ms;
}

.related-item:hover {
  background: #eff6ff;
}

.related-doc-title {
  font-weight: 500;
  color: #1e293b;
  flex-shrink: 0;
}

.related-doc-path {
  color: #94a3b8;
  font-family: monospace;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.related-doc-lines {
  color: #3b82f6;
  font-family: monospace;
  font-size: 10px;
  flex-shrink: 0;
}
</style>
