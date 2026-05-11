<template>
  <div class="chat-panel">
    <div class="panel-header">
      <div class="panel-title">
        <span>💬</span> 开发对话
      </div>
      <button class="panel-close" @click="$emit('close')">✕</button>
    </div>
    <div class="chat-messages" ref="messagesRef">
      <!-- Memory Banner -->
      <div v-if="memoryContext" class="memory-banner">
        <div class="memory-header" @click="memoryExpanded = !memoryExpanded">
          <span class="memory-icon">🧠</span>
          <span class="memory-title">项目记忆</span>
          <div class="memory-context-tags">
            <span v-if="memoryContext.activeTasks.length > 0" class="context-tag context-tag-task">任务</span>
            <span v-if="memoryContext.recentReviews.length > 0" class="context-tag context-tag-review">审查</span>
          </div>
          <span class="memory-stats">{{ memoryContext.stats.pendingTasks }} 待办 / {{ memoryContext.stats.pendingReviews }} 待查</span>
          <span class="memory-toggle">{{ memoryExpanded ? '▼' : '▶' }}</span>
        </div>
        <div v-if="memoryExpanded" class="memory-body">
          <!-- Current Tasks -->
          <div v-if="memoryContext.activeTasks.length > 0" class="memory-section">
            <div class="memory-label">📋 当前任务</div>
            <div v-for="task in memoryContext.activeTasks.slice(0, 3)" :key="task.id" class="memory-item">
              {{ task.title }} <span class="memory-meta">— {{ task.status }}</span>
            </div>
          </div>
          <!-- Recent Reviews -->
          <div v-if="memoryContext.recentReviews.length > 0" class="memory-section">
            <div class="memory-label">🔍 待处理审查</div>
            <div v-for="review in memoryContext.recentReviews.slice(0, 3)" :key="review.id" class="memory-item">
              <span :class="'severity-' + review.severity">{{ review.severity }}</span> {{ review.title }}
            </div>
          </div>
          <!-- Recent Sessions -->
          <div v-if="memoryContext.recentSessions && memoryContext.recentSessions.length > 0" class="memory-section">
            <div class="memory-label">💬 最近会话</div>
            <div v-for="session in memoryContext.recentSessions.slice(0, 2)" :key="session.id" class="memory-item">
              {{ session.title }} <span class="memory-meta">({{ session.messageCount }} 条消息)</span>
            </div>
          </div>
          <!-- Summary -->
          <div class="memory-section">
            <div class="memory-label">📊 概览</div>
            <div class="memory-item">{{ memoryContext.summary }}</div>
          </div>
        </div>
      </div>

      <ChatMessageList
        :messages="messages"
        :is-thinking="isThinking"
        :thinking-content="thinkingContent"
        :thinking-expanded="thinkingExpanded"
        @toggle-thinking="chatStore.thinkingExpanded = !chatStore.thinkingExpanded"
      />
    </div>

    <!-- Attachment Bar -->
    <div v-if="attachments.length > 0" class="attachment-bar">
      <span
        v-for="(att, i) in attachments"
        :key="i"
        class="attachment-tag"
      >
        <span class="attachment-type">{{ att.type === 'doc' ? '📄' : '📁' }}</span>
        {{ att.label }}
        <button class="attachment-remove" @click="removeAttachment(i)">✕</button>
      </span>
    </div>

    <div class="chat-input-area">
      <div class="chat-input-wrapper">
        <button class="chat-attach" @click="$refs.fileInput?.click()" title="添加上下文附件">
          📎
        </button>
        <input
          ref="fileInput"
          type="file"
          class="hidden-file-input"
          @change="handleFileAttach"
          accept=".md,.ts,.js,.vue,.json,.txt,.py,.go,.rs"
        />
        <input
          v-model="input"
          class="chat-input"
          placeholder="输入消息..."
          @keydown.enter="send"
        />
        <button class="chat-send" @click="send" :disabled="!input.trim() || isSending">发送</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '@/stores/chat'
import { useProjectsStore } from '@/stores/projects'
import ChatMessageList from '@/components/chat/ChatMessageList.vue'
import ChatInput from '@/components/chat/ChatInput.vue'

const props = defineProps<{
  projectName: string
}>()

defineEmits<{
  close: []
}>()

interface MemoryContext {
  summary: string
  activeTasks: Array<{ id: number; title: string; status: string }>
  recentReviews: Array<{ id: number; title: string; severity: string; status: string }>
  stats: { pendingTasks: number; pendingReviews: number; totalTasks: number; totalReviews: number }
}

interface Attachment {
  type: 'doc' | 'code'
  label: string
  path: string
}

const chatStore = useChatStore()
const projectsStore = useProjectsStore()

const { messages, isSending, isThinking, thinkingContent, thinkingExpanded } = storeToRefs(chatStore)

const messagesRef = ref<HTMLElement | null>(null)
const memoryContext = ref<MemoryContext | null>(null)
const memoryExpanded = ref(false)
const input = ref('')
const attachments = ref<Attachment[]>([])
const fileInput = ref<HTMLInputElement | null>(null)

async function fetchMemory() {
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(props.projectName)}/memory`)
    if (res.ok) {
      const data = await res.json()
      memoryContext.value = data
    }
  } catch {
    // Memory not available yet
  }
}

async function resolveProjectPath(): Promise<string> {
  if (!props.projectName) return ''
  if (projectsStore.projects.length === 0) {
    await projectsStore.fetchProjects()
  }
  const project = projectsStore.getProjectByName(props.projectName)
  return project?.path || ''
}

onMounted(async () => {
  const projectPath = await resolveProjectPath()
  chatStore.connect(projectPath)
  fetchMemory()
})

onBeforeUnmount(() => {
  chatStore.disconnect()
})

// Reconnect when project changes
watch(
  () => props.projectName,
  async (newName) => {
    if (newName) {
      const projectPath = await resolveProjectPath()
      chatStore.connect(projectPath)
      fetchMemory()
    }
  }
)

function send() {
  let text = input.value.trim()
  if (!text || isSending.value) return

  // Prepend attachment context to message
  if (attachments.value.length > 0) {
    const contextParts = attachments.value.map(a => `[${a.type === 'doc' ? '文档' : '代码'}: ${a.path}]`)
    text = `上下文: ${contextParts.join(', ')}\n\n${text}`
  }

  chatStore.sendMessage(text)
  input.value = ''
  attachments.value = []
}

function handleFileAttach(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // Determine type from extension
  const ext = file.name.split('.').pop() || ''
  const isDoc = ['md', 'txt'].includes(ext)
  attachments.value.push({
    type: isDoc ? 'doc' : 'code',
    label: file.name,
    path: file.name,
  })

  // Reset input so same file can be re-attached
  target.value = ''
}

function removeAttachment(index: number) {
  attachments.value.splice(index, 1)
}
</script>

<style scoped>
.chat-panel {
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

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* Memory Banner */
.memory-banner {
  margin: 0 0 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: linear-gradient(135deg, #eff6ff, #f5f3ff);
  overflow: hidden;
}

.memory-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: #166534;
}

.memory-header:hover {
  background: rgba(255, 255, 255, 0.5);
}

.memory-icon {
  font-size: 14px;
}

.memory-title {
  font-weight: 600;
}

.memory-context-tags {
  display: flex;
  gap: 4px;
  margin-left: 4px;
}

.context-tag {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

.context-tag-task {
  background: #f3e8ff;
  color: #7c3aed;
}

.context-tag-review {
  background: #fee2e2;
  color: #dc2626;
}

.context-tag-doc {
  background: #dbeafe;
  color: #2563eb;
}

.context-tag-code {
  background: #dcfce7;
  color: #16a34a;
}

.context-tag-session {
  background: #fef3c7;
  color: #d97706;
}

.memory-stats {
  margin-left: auto;
  color: #64748b;
  font-size: 11px;
  font-weight: 400;
}

.memory-toggle {
  font-size: 10px;
  color: #94a3b8;
}

.memory-body {
  padding: 0 12px 10px;
}

.memory-summary {
  font-size: 12px;
  color: #475569;
  margin-bottom: 8px;
  line-height: 1.5;
}

.memory-section {
  margin-top: 6px;
}

.memory-label {
  font-size: 11px;
  font-weight: 600;
  color: #6366f1;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.memory-meta {
  font-size: 11px;
  color: #94a3b8;
}

.memory-item {
  font-size: 12px;
  color: #475569;
  padding: 2px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.severity-critical {
  color: #dc2626;
  font-weight: 600;
  font-size: 10px;
}

.severity-warning {
  color: #d97706;
  font-weight: 600;
  font-size: 10px;
}

.severity-info {
  color: #2563eb;
  font-weight: 600;
  font-size: 10px;
}

/* Attachment Bar */
.attachment-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 16px;
  border-top: 1px solid #f1f5f9;
  background: #f8fafc;
}

.attachment-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  font-size: 11px;
  color: #2563eb;
  font-weight: 500;
}

.attachment-type {
  font-size: 12px;
}

.attachment-remove {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #93c5fd;
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
  line-height: 1;
}

.attachment-remove:hover {
  color: #dc2626;
  background: #fee2e2;
}

/* Chat Input */
.chat-input-area {
  padding: 12px 16px;
  border-top: 1px solid #e2e8f0;
}

.chat-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.chat-attach {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  cursor: pointer;
  background: none;
  border: 1px solid #d1d5db;
  color: #64748b;
  flex-shrink: 0;
  padding: 0;
}

.chat-attach:hover {
  background: #f1f5f9;
  color: #2563eb;
  border-color: #93c5fd;
}

.hidden-file-input {
  display: none;
}

.chat-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
}

.chat-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.chat-send {
  padding: 10px 18px;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.chat-send:hover:not(:disabled) {
  background: #1d4ed8;
}

.chat-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
