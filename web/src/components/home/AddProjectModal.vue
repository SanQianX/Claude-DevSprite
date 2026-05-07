<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">{{ t('home.addProject') }}</h3>
          <button class="modal-close" @click="$emit('close')" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <label class="input-label">{{ t('home.projectPath') }}</label>
          <input
            ref="pathInput"
            v-model="projectPath"
            class="input"
            :placeholder="t('home.projectPathPlaceholder')"
            @keyup.enter="handleAdd"
          />
          <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="$emit('close')">
            {{ t('common.cancel') }}
          </button>
          <button class="btn btn-primary" :disabled="!projectPath.trim() || adding" @click="handleAdd">
            <span v-if="adding" class="spinner"></span>
            {{ t('common.add') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectsStore } from '@/stores/projects'
import { useUIStore } from '@/stores/ui'

const emit = defineEmits<{
  close: []
  added: []
}>()

const projectsStore = useProjectsStore()
const { t } = storeToRefs(useUIStore())

const projectPath = ref('')
const adding = ref(false)
const errorMsg = ref('')
const pathInput = ref<HTMLInputElement | null>(null)

nextTick(() => {
  pathInput.value?.focus()
})

async function handleAdd() {
  const path = projectPath.value.trim()
  if (!path || adding.value) return

  adding.value = true
  errorMsg.value = ''

  try {
    await projectsStore.addProject(path)
    emit('added')
    emit('close')
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : t.value('home.addFailed')
  } finally {
    adding.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--color-bg-primary, #fff);
  border-radius: var(--radius-lg, 8px);
  width: 90%;
  max-width: 480px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border, #d0d7de);
}

.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary, #1f2328);
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm, 4px);
  color: var(--color-text-secondary, #656d76);
  background: none;
  border: none;
  cursor: pointer;
}

.modal-close:hover {
  background: var(--color-bg-secondary, #f6f8fa);
}

.modal-body {
  padding: 20px;
}

.input-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary, #1f2328);
  margin-bottom: 6px;
}

.error-text {
  margin: 8px 0 0;
  font-size: 13px;
  color: #cf222e;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--color-border, #d0d7de);
}

.btn {
  padding: 6px 16px;
  border-radius: var(--radius-md, 6px);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn-primary {
  background: #2da44e;
  color: white;
  border-color: rgba(27, 31, 35, 0.15);
}

.btn-primary:hover:not(:disabled) {
  background: #2c974b;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-bg-secondary, #f6f8fa);
  color: var(--color-text-primary, #1f2328);
  border-color: var(--color-border, #d0d7de);
}

.btn-secondary:hover {
  background: var(--color-bg-tertiary, #f0f2f5);
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
