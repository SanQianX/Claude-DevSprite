<template>
  <div class="workspace-view">
    <!-- Toolbar -->
    <div class="toolbar">
      <div class="toolbar-panels">
        <button
          class="panel-toggle"
          :class="{ active: panels.doc, inactive: !panels.doc }"
          @click="togglePanel('doc')"
        >
          <span>📄</span> Doc
        </button>
        <button
          class="panel-toggle"
          :class="{ active: panels.code, inactive: !panels.code }"
          @click="togglePanel('code')"
        >
          <span>📁</span> Code
        </button>
        <button
          class="panel-toggle"
          :class="{ active: panels.chat, inactive: !panels.chat }"
          @click="togglePanel('chat')"
        >
          <span>💬</span> Chat
        </button>
      </div>
    </div>

    <!-- Panels Container -->
    <div class="panels-container" ref="panelsContainer">
      <!-- Doc Panel -->
      <div
        v-if="panels.doc"
        class="panel"
        :style="{ width: panelWidths.doc + 'px' }"
      >
        <div class="panel-header">
          <div class="panel-title">📄 文档</div>
          <button class="panel-close" @click="togglePanel('doc')">✕</button>
        </div>
        <div class="panel-content">
          <p class="panel-placeholder">选择文档以查看内容</p>
        </div>
      </div>

      <!-- Doc/Code Divider -->
      <div
        v-if="panels.doc && panels.code"
        class="panel-divider"
        @mousedown="startResize('doc-code', $event)"
      ></div>

      <!-- Code Panel -->
      <div
        v-if="panels.code"
        class="panel"
        :style="{ width: panelWidths.code + 'px' }"
      >
        <div class="panel-header">
          <div class="panel-title">📁 源码</div>
          <button class="panel-close" @click="togglePanel('code')">✕</button>
        </div>
        <div class="panel-content">
          <p class="panel-placeholder">选择文件以查看源码</p>
        </div>
      </div>

      <!-- Code/Chat Divider -->
      <div
        v-if="panels.code && panels.chat"
        class="panel-divider"
        @mousedown="startResize('code-chat', $event)"
      ></div>

      <!-- Chat Panel -->
      <div
        v-if="panels.chat"
        class="panel panel-chat"
      >
        <div class="panel-header">
          <div class="panel-title">💬 开发对话</div>
          <button class="panel-close" @click="togglePanel('chat')">✕</button>
        </div>
        <div class="panel-content chat-content">
          <div class="chat-messages">
            <div class="chat-empty">开始新的对话...</div>
          </div>
          <div class="chat-input-area">
            <div class="chat-input-wrapper">
              <input
                v-model="chatInput"
                class="chat-input"
                placeholder="输入消息..."
                @keydown.enter="sendMessage"
              />
              <button class="chat-send" @click="sendMessage">发送</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Status Bar -->
    <div class="status-bar">
      <div class="status-dot"></div>
      <span>{{ projectName }}</span>
      <span v-if="activePanelCount > 1">{{ activePanelCount }} 面板</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'

const props = defineProps<{
  projectName: string
}>()

const panels = reactive({
  doc: true,
  code: true,
  chat: true,
})

const panelWidths = reactive({
  doc: 400,
  code: 400,
})

const chatInput = ref('')
const panelsContainer = ref<HTMLElement | null>(null)

const activePanelCount = computed(() =>
  Object.values(panels).filter(Boolean).length
)

function togglePanel(name: 'doc' | 'code' | 'chat') {
  panels[name] = !panels[name]
}

function sendMessage() {
  if (!chatInput.value.trim()) return
  chatInput.value = ''
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
  if (resizeState.type === 'doc-code') {
    panelWidths.doc = Math.max(250, resizeState.startWidths.doc + delta)
    panelWidths.code = Math.max(250, resizeState.startWidths.code - delta)
  } else if (resizeState.type === 'code-chat') {
    panelWidths.code = Math.max(250, resizeState.startWidths.code + delta)
  }
}

function stopResize() {
  resizeState = null
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}
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
  padding: 16px;
}

.panel-placeholder {
  color: #94a3b8;
  font-size: 14px;
  text-align: center;
  padding: 40px 20px;
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

.chat-content {
  display: flex;
  flex-direction: column;
  padding: 0;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.chat-empty {
  text-align: center;
  color: #94a3b8;
  padding: 40px;
}

.chat-input-area {
  padding: 16px;
  border-top: 1px solid #e2e8f0;
}

.chat-input-wrapper {
  display: flex;
  gap: 10px;
}

.chat-input {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  font-size: 14px;
}

.chat-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.chat-send {
  padding: 10px 20px;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.chat-send:hover {
  background: #1d4ed8;
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
