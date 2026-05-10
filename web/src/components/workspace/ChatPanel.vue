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
          <span class="memory-stats">{{ memoryContext.stats.pendingTasks }} 待办 / {{ memoryContext.stats.pendingReviews }} 待查</span>
          <span class="memory-toggle">{{ memoryExpanded ? '▼' : '▶' }}</span>
        </div>
        <div v-if="memoryExpanded" class="memory-body">
          <div class="memory-summary">{{ memoryContext.summary }}</div>
          <div v-if="memoryContext.activeTasks.length > 0" class="memory-section">
            <div class="memory-section-title">进行中任务</div>
            <div v-for="task in memoryContext.activeTasks.slice(0, 3)" :key="task.id" class="memory-item">
              {{ task.title }}
            </div>
          </div>
          <div v-if="memoryContext.recentReviews.length > 0" class="memory-section">
            <div class="memory-section-title">最近审查</div>
            <div v-for="review in memoryContext.recentReviews.slice(0, 3)" :key="review.id" class="memory-item">
              <span :class="'severity-' + review.severity">{{ review.severity }}</span> {{ review.title }}
            </div>
          </div>
        </div>
      </div>

      <div v-if="messages.length === 0 && !memoryContext" class="chat-empty">
        开始新的对话...
      </div>
      <div v-for="(msg, i) in messages" :key="i" class="message" :class="'msg-' + msg.role">
        <div class="msg-header">{{ msg.role === 'user' ? '你' : 'AI' }}</div>
        <div class="msg-body">{{ msg.content }}</div>
      </div>
    </div>
    <div class="chat-input-area">
      <div class="chat-input-wrapper">
        <input
          v-model="input"
          class="chat-input"
          placeholder="输入消息..."
          @keydown.enter="send"
        />
        <button class="chat-send" @click="send" :disabled="!input.trim()">发送</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'

const props = defineProps<{
  projectName: string
}>()

defineEmits<{
  close: []
}>()

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface MemoryContext {
  summary: string
  activeTasks: Array<{ id: number; title: string; status: string }>
  recentReviews: Array<{ id: number; title: string; severity: string; status: string }>
  stats: { pendingTasks: number; pendingReviews: number; totalTasks: number; totalReviews: number }
}

const messages = ref<Message[]>([])
const input = ref('')
const messagesRef = ref<HTMLElement | null>(null)
const memoryContext = ref<MemoryContext | null>(null)
const memoryExpanded = ref(false)

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

onMounted(() => {
  fetchMemory()
})

async function send() {
  const text = input.value.trim()
  if (!text) return

  messages.value.push({ role: 'user', content: text })
  input.value = ''

  await nextTick()
  scrollToBottom()

  // Simulate AI response (will be replaced with real WebSocket chat)
  setTimeout(() => {
    messages.value.push({
      role: 'assistant',
      content: `收到你的消息: "${text}"。\n\n这是开发对话面板的占位响应。完整的对话功能将通过 WebSocket 连接到 AI 代理。`,
    })
    nextTick(() => scrollToBottom())
  }, 500)
}

function scrollToBottom() {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
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

.chat-empty {
  text-align: center;
  color: #94a3b8;
  padding: 40px;
}

.memory-banner {
  margin: 0 0 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f0fdf4;
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
  background: #dcfce7;
}

.memory-icon {
  font-size: 14px;
}

.memory-title {
  font-weight: 600;
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

.memory-section-title {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 4px;
  text-transform: uppercase;
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

.message {
  margin-bottom: 16px;
}

.msg-header {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 6px;
}

.msg-body {
  font-size: 14px;
  color: #1e293b;
  line-height: 1.7;
  padding: 12px 16px;
  border-radius: 10px;
  max-width: 85%;
  white-space: pre-wrap;
}

.msg-user .msg-body {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  margin-left: auto;
}

.msg-assistant .msg-body {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.chat-input-area {
  padding: 12px 16px;
  border-top: 1px solid #e2e8f0;
}

.chat-input-wrapper {
  display: flex;
  gap: 8px;
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
