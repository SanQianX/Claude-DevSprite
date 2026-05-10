<!--
  @brief Dialog for creating a new chat session
  @props visible - Whether the dialog is shown
  @emits close - When dialog is closed
  @emits create - When session creation is confirmed, returns CreateSessionParams
-->
<template>
  <Teleport to="body">
    <div v-if="visible" class="dialog-overlay" @click.self="$emit('close')">
      <div class="dialog">
        <div class="dialog-header">
          <h3>New Chat Session</h3>
          <button class="close-btn" @click="$emit('close')">&#x2715;</button>
        </div>

        <div class="dialog-body">
          <div class="form-group">
            <label for="session-title">Title</label>
            <input
              id="session-title"
              v-model="title"
              type="text"
              placeholder="e.g., Fix login bug"
              @keydown.enter="handleCreate"
              autofocus
            />
          </div>

          <div class="form-group">
            <label for="project-path">Project Path (optional)</label>
            <input
              id="project-path"
              v-model="projectPath"
              type="text"
              placeholder="e.g., D:\Code\MyProject"
            />
          </div>
        </div>

        <div class="dialog-footer">
          <button class="btn-cancel" @click="$emit('close')">Cancel</button>
          <button class="btn-create" @click="handleCreate" :disabled="!title.trim()">
            Create
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { CreateSessionParams } from '../../types/session';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  close: [];
  create: [params: CreateSessionParams];
}>();

const title = ref('');
const projectPath = ref('');

watch(() => props.visible, (val) => {
  if (val) {
    title.value = '';
    projectPath.value = '';
  }
});

function handleCreate() {
  if (!title.value.trim()) return;
  emit('create', {
    title: title.value.trim(),
    projectPath: projectPath.value.trim() || undefined,
  });
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: white;
  border-radius: 12px;
  width: 420px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  animation: dialogIn 0.2s ease;
}

@keyframes dialogIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
}

.dialog-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
}

.close-btn:hover {
  color: #333;
}

.dialog-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #555;
}

.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #0078d4;
  box-shadow: 0 0 0 2px rgba(0, 120, 212, 0.2);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #e0e0e0;
}

.btn-cancel {
  padding: 8px 16px;
  background: #f5f5f5;
  color: #666;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn-cancel:hover {
  background: #e9ecef;
}

.btn-create {
  padding: 8px 20px;
  background: #0078d4;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.btn-create:hover {
  background: #106ebe;
}

.btn-create:disabled {
  background: #a0c4e8;
  cursor: not-allowed;
}
</style>
