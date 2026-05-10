<template>
  <div class="chat-panel">
    <div class="panel-header">
      <div class="panel-title">
        <span>💬</span> 开发对话
      </div>
      <button class="panel-close" @click="$emit('close')">✕</button>
    </div>
    <div class="chat-messages" ref="messagesRef">
      <div v-if="messages.length === 0" class="chat-empty">
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
import { ref, nextTick } from 'vue'

defineProps<{
  projectName: string
}>()

defineEmits<{
  close: []
}>()

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const messages = ref<Message[]>([])
const input = ref('')
const messagesRef = ref<HTMLElement | null>(null)

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
