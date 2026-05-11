<template>
  <div class="workspace-view">
    <!-- Toolbar -->
    <div class="toolbar">
      <div class="toolbar-panels">
        <button
          class="panel-toggle"
          :class="{ active: showDoc, inactive: !showDoc }"
          @click="togglePanel('doc')"
        >
          <span>📄</span> Doc
        </button>
        <button
          class="panel-toggle"
          :class="{ active: showCode, inactive: !showCode }"
          @click="togglePanel('code')"
        >
          <span>📁</span> Code
        </button>
        <button
          class="panel-toggle"
          :class="{ active: showChat, inactive: !showChat }"
          @click="togglePanel('chat')"
        >
          <span>💬</span> Chat
        </button>
      </div>
      <div class="toolbar-sep"></div>
      <button class="toolbar-btn" @click="toggleSidebar">
        <span>{{ showSidebar ? '◀' : '▶' }}</span> 文件树
      </button>
      <button class="toolbar-btn" @click="equalizePanels">═ 均分</button>
    </div>

    <!-- Workspace Body -->
    <div class="workspace-body">
      <!-- Sidebar -->
      <FileTreeSidebar
        v-if="showSidebar"
        :project-name="projectName"
        :selected-path="activeFilePath"
        @file-select="onFileSelect"
      />

      <!-- Panels Container -->
      <div class="panels-container" ref="panelsContainer">
        <!-- Doc Panel -->
        <div
          v-if="showDoc"
          class="panel"
          :style="{ width: panelWidths.doc + 'px' }"
        >
          <DocPanel
            :project-name="projectName"
            :active-doc-path="activeDocPath"
            @close="togglePanel('doc')"
            @doc-select="onDocSelect"
            @source-link-click="onSourceLinkClick"
          />
        </div>

        <!-- Doc/Code Divider -->
        <div
          v-if="showDoc && showCode"
          class="panel-divider"
          @mousedown="startResize('doc-code', $event)"
        ></div>

        <!-- Code Panel -->
        <div
          v-if="showCode"
          class="panel"
          :style="{ width: panelWidths.code + 'px' }"
        >
          <CodePanel
            :project-name="projectName"
            :highlight-path="highlightedSourcePath"
            :highlight-line="highlightedSourceLine"
            @close="togglePanel('code')"
            @file-select="onFileSelect"
            @doc-navigate="onDocNavigate"
          />
        </div>

        <!-- Code/Chat Divider -->
        <div
          v-if="showCode && showChat"
          class="panel-divider"
          @mousedown="startResize('code-chat', $event)"
        ></div>

        <!-- Chat Panel -->
        <div
          v-if="showChat"
          class="panel panel-chat"
        >
          <ChatPanel
            :project-name="projectName"
            @close="togglePanel('chat')"
          />
        </div>
      </div>
    </div>

    <!-- Status Bar -->
    <div class="status-bar">
      <div class="status-dot"></div>
      <span>{{ projectName }}</span>
      <span v-if="activePanelCount > 1">{{ activePanelCount }} 面板</span>
      <span v-if="showSidebar">| 文件树已显示</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DocPanel from '@/components/workspace/DocPanel.vue'
import CodePanel from '@/components/workspace/CodePanel.vue'
import ChatPanel from '@/components/workspace/ChatPanel.vue'
import FileTreeSidebar from '@/components/workspace/FileTreeSidebar.vue'

const props = defineProps<{
  projectName: string
}>()

const route = useRoute()
const router = useRouter()

const showDoc = ref(false)
const showCode = ref(false)
const showChat = ref(true)

const panelWidths = reactive({
  doc: 400,
  code: 400,
})

const showSidebar = ref(true)
const panelsContainer = ref<HTMLElement | null>(null)

const highlightedSourcePath = ref('')
const highlightedSourceLine = ref(0)
const activeDocPath = ref('')
const activeFilePath = ref('')

const activePanelCount = computed(() =>
  [showDoc.value, showCode.value, showChat.value].filter(Boolean).length
)

// Sync URL query params → panel state (on mount / route change)
function syncFromUrl() {
  const q = route.query
  if (q.doc) activeDocPath.value = q.doc as string
  if (q.code) activeFilePath.value = q.code as string
  if (q.panels) {
    const names = (q.panels as string).split(',')
    showDoc.value = names.includes('doc')
    showCode.value = names.includes('code')
    showChat.value = names.includes('chat')
  }
}

// Sync panel state → URL query params
function syncToUrl() {
  const query: Record<string, string> = { ...route.query } as Record<string, string>
  query.tab = 'workspace'
  if (activeDocPath.value) query.doc = activeDocPath.value
  else delete query.doc
  if (activeFilePath.value) query.code = activeFilePath.value
  else delete query.code
  const panelNames: string[] = []
  if (showDoc.value) panelNames.push('doc')
  if (showCode.value) panelNames.push('code')
  if (showChat.value) panelNames.push('chat')
  if (panelNames.length < 3) query.panels = panelNames.join(',')
  else delete query.panels
  router.replace({ query })
}

function togglePanel(name: 'doc' | 'code' | 'chat') {
  if (name === 'doc') showDoc.value = !showDoc.value
  else if (name === 'code') showCode.value = !showCode.value
  else if (name === 'chat') showChat.value = !showChat.value
  syncToUrl()
}

function toggleSidebar() {
  showSidebar.value = !showSidebar.value
}

function equalizePanels() {
  const openPanels = activePanelCount.value
  if (openPanels === 0) return
  const totalWidth = window.innerWidth - (showSidebar.value ? 220 : 0) - 48
  const eachWidth = Math.floor(totalWidth / openPanels)
  panelWidths.doc = eachWidth
  panelWidths.code = eachWidth
}

function onDocSelect(path: string) {
  activeDocPath.value = path
  syncToUrl()
}

function onFileSelect(path: string) {
  activeFilePath.value = path
  // Determine if it's a doc or source file and open appropriate panel
  const isDoc = path.endsWith('.md') || path.includes('knowledge')
  if (isDoc) {
    if (!showDoc.value) showDoc.value = true
    activeDocPath.value = path
  } else {
    if (!showCode.value) showCode.value = true
    highlightedSourcePath.value = path
  }
  syncToUrl()
}

function onDocNavigate(docPath: string) {
  if (!showDoc.value) {
    showDoc.value = true
  }
  activeDocPath.value = docPath
  syncToUrl()
}

function onSourceLinkClick(path: string, line: number) {
  if (!showCode.value) {
    showCode.value = true
  }
  highlightedSourcePath.value = path
  highlightedSourceLine.value = line
  activeFilePath.value = path
  syncToUrl()
}

let resizeState: { type: string; startX: number; startWidths: Record<string, number> } | null = null

function startResize(type: string, e: MouseEvent) {
  e.preventDefault()
  resizeState = {
    type,
    startX: e.clientX,
    startWidths: { ...panelWidths },
  }
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

function onResize(e: MouseEvent) {
  if (!resizeState) return
  const delta = e.clientX - resizeState.startX
  const maxPanelWidth = Math.min(window.innerWidth - 300, 1200)
  if (resizeState.type === 'doc-code') {
    panelWidths.doc = Math.min(maxPanelWidth, Math.max(250, resizeState.startWidths.doc + delta))
    panelWidths.code = Math.min(maxPanelWidth, Math.max(250, resizeState.startWidths.code - delta))
  } else if (resizeState.type === 'code-chat') {
    panelWidths.code = Math.min(maxPanelWidth, Math.max(250, resizeState.startWidths.code + delta))
  }
}

function stopResize() {
  resizeState = null
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}

onBeforeUnmount(() => {
  stopResize()
})

// Initialize from URL on mount
syncFromUrl()

// Watch for external route changes (e.g., browser back/forward)
watch(() => route.query, () => {
  syncFromUrl()
})
</script>

<style scoped>
.workspace-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 24px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.toolbar-panels {
  display: flex;
  gap: 6px;
}

.toolbar-sep {
  width: 1px;
  height: 20px;
  background: #d1d5db;
  margin: 0 4px;
}

.toolbar-btn {
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-btn:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.panel-toggle {
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 150ms;
}

.panel-toggle.active {
  background: #eff6ff;
  color: #2563eb;
  border-color: #93c5fd;
}

.panel-toggle.inactive {
  background: #f9fafb;
  color: #9ca3af;
  border-color: #e5e7eb;
}

.workspace-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.panels-container {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.panel {
  display: flex;
  flex-direction: column;
  min-width: 250px;
  overflow: hidden;
}

.panel-chat {
  flex: 1;
}

.panel-divider {
  width: 4px;
  background: #e2e8f0;
  cursor: col-resize;
  flex-shrink: 0;
  transition: background 150ms;
}

.panel-divider:hover {
  background: #3b82f6;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 24px;
  background: #f1f5f9;
  border-top: 1px solid #e2e8f0;
  font-size: 11px;
  color: #64748b;
  flex-shrink: 0;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
}
</style>
