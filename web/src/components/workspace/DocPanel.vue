<template>
  <div class="doc-panel">
    <div class="panel-header">
      <div class="panel-title">
        <span>📄</span> 文档
      </div>
      <button class="panel-close" @click="$emit('close')">✕</button>
    </div>
    <div class="panel-content">
      <div v-if="!currentDoc" class="doc-list">
        <div v-if="loading" class="loading-state">加载中...</div>
        <div v-else-if="documents.length === 0" class="empty-state">
          暂无文档，请先运行分析
        </div>
        <div v-else class="doc-tree">
          <div
            v-for="doc in documents"
            :key="doc.path"
            class="doc-item"
            :class="{ active: currentDocPath === doc.path }"
            @click="selectDoc(doc)"
          >
            <span class="doc-icon">📝</span>
            <span class="doc-name">{{ doc.title }}</span>
          </div>
        </div>
      </div>
      <div v-else class="doc-viewer">
        <div class="doc-nav">
          <button class="back-btn" @click="currentDoc = null">← 返回列表</button>
          <span class="doc-breadcrumb">{{ currentDoc.path }}</span>
        </div>
        <div class="doc-body" ref="docBodyRef" v-html="renderedContent"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const props = withDefaults(defineProps<{
  projectName: string
  activeDocPath?: string
}>(), {
  activeDocPath: '',
})

const emit = defineEmits<{
  close: []
  docSelect: [path: string]
  sourceLinkClick: [path: string, line: number]
}>()

interface DocItem {
  path: string
  title: string
  category: string
}

const documents = ref<DocItem[]>([])
const currentDoc = ref<DocItem | null>(null)
const currentDocPath = ref('')
const renderedContent = ref('')
const loading = ref(false)
const docBodyRef = ref<HTMLElement | null>(null)

// Local marked instance to avoid global mutation
const localMarked = new marked.Marked()

// Custom renderer to convert [source:path:line] to clickable links
const renderer = new localMarked.Renderer()
renderer.paragraph = function (tokens: any) {
  let text = this.parser.parseInline(tokens) as string
  // Replace [source:path:line] patterns with clickable links
  text = text.replace(
    /\[source:([^\]]+?):(\d+)\]/g,
    '<a class="source-link" data-path="$1" data-line="$2" href="#">📍 $1:$2</a>'
  )
  return `<p>${text}</p>`
}

localMarked.use({ renderer })

async function fetchDocuments() {
  loading.value = true
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(props.projectName)}/tree`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.tree?.children) {
      documents.value = flattenTree(data.tree.children)
    }
  } catch (err) {
    console.error('Failed to fetch documents:', err)
    documents.value = []
  } finally {
    loading.value = false
  }
}

function flattenTree(nodes: Array<{ type?: string; path?: string; name?: string; category?: string; children?: unknown[] }>): DocItem[] {
  const docs: DocItem[] = []
  for (const node of nodes) {
    if (node.type === 'file' && node.path?.endsWith('.md')) {
      docs.push({
        path: node.path,
        title: node.name?.replace(/\.md$/, '') || node.path,
        category: node.category || 'uncategorized',
      })
    }
    if (node.children && Array.isArray(node.children)) {
      docs.push(...flattenTree(node.children as Array<{ type?: string; path?: string; name?: string; category?: string; children?: unknown[] }>))
    }
  }
  return docs
}

async function selectDoc(doc: DocItem) {
  currentDoc.value = doc
  currentDocPath.value = doc.path
  emit('docSelect', doc.path)

  try {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(props.projectName)}/file?path=${encodeURIComponent(doc.path)}`
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.content) {
      renderedContent.value = DOMPurify.sanitize(localMarked.parse(data.content) as string)
      await nextTick()
      bindSourceLinks()
    }
  } catch (err) {
    console.error('Failed to load document:', err)
    renderedContent.value = '<p>加载文档失败</p>'
  }
}

function bindSourceLinks() {
  nextTick(() => {
    if (!docBodyRef.value) return
    docBodyRef.value.querySelectorAll('.source-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault()
        const linkPath = (e.target as HTMLElement).getAttribute('data-path')
        const line = parseInt((e.target as HTMLElement).getAttribute('data-line') || '1', 10)
        if (linkPath) {
          emit('sourceLinkClick', linkPath, line)
        }
      })
    })
  })
}

onMounted(() => {
  fetchDocuments()
})

onBeforeUnmount(() => {
  // Cleanup handled by Vue - DOM elements removed automatically
})

watch(() => props.projectName, () => {
  currentDoc.value = null
  fetchDocuments()
})

watch(() => props.activeDocPath, (newPath) => {
  if (newPath && documents.value.length > 0) {
    const doc = documents.value.find(d => d.path === newPath)
    if (doc) selectDoc(doc)
  }
})
</script>

<style scoped>
.doc-panel {
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
  overflow-y: auto;
}

.loading-state, .empty-state {
  padding: 40px 20px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
}

.doc-tree {
  padding: 8px;
}

.doc-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #475569;
  transition: background 150ms;
}

.doc-item:hover {
  background: #f1f5f9;
}

.doc-item.active {
  background: #eff6ff;
  color: #2563eb;
}

.doc-icon {
  font-size: 14px;
}

.doc-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
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

.doc-breadcrumb {
  font-size: 12px;
  color: #94a3b8;
  font-family: monospace;
}

.doc-body {
  padding: 20px;
  font-size: 14px;
  line-height: 1.7;
  color: #1e293b;
}

.doc-body :deep(h1) { font-size: 24px; margin: 20px 0 12px; }
.doc-body :deep(h2) { font-size: 20px; margin: 16px 0 10px; }
.doc-body :deep(h3) { font-size: 16px; margin: 14px 0 8px; }
.doc-body :deep(p) { margin: 8px 0; }
.doc-body :deep(code) {
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}
.doc-body :deep(pre) {
  background: #1e293b;
  color: #e2e8f0;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
}
.doc-body :deep(pre code) {
  background: transparent;
  padding: 0;
  color: inherit;
}

.doc-body :deep(.source-link) {
  color: #3b82f6;
  text-decoration: none;
  font-family: monospace;
  font-size: 12px;
  padding: 2px 6px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 4px;
  cursor: pointer;
}

.doc-body :deep(.source-link:hover) {
  background: #dbeafe;
  text-decoration: underline;
}
</style>
