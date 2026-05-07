<template>
  <div class="chat-input-container">
    <textarea
      v-model="inputValue"
      @keydown.enter.exact="handleSend"
      placeholder="输入开发需求..."
      :disabled="disabled"
      rows="3"
    ></textarea>
    <button
      class="send-btn"
      @click="handleSend"
      :disabled="!inputValue.trim() || disabled"
    >
      {{ disabled ? '发送中...' : '发送' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{
  send: [content: string];
}>();

const inputValue = ref('');

function handleSend(event: KeyboardEvent) {
  if (event.shiftKey) return;
  event.preventDefault();
  if (inputValue.value.trim() && !props.disabled) {
    emit('send', inputValue.value);
    inputValue.value = '';
  }
}
</script>

<style scoped>
.chat-input-container {
  display: flex;
  gap: 12px;
  background: white;
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

textarea {
  flex: 1;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  resize: none;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.5;
}

textarea:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.send-btn {
  padding: 12px 24px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  align-self: flex-end;
}

.send-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}
</style>
