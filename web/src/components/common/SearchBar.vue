<template>
  <div class="search-bar">
    <div class="search-input-wrapper">
      <svg class="search-icon" width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
        <path d="M10.25 3.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        <path d="M13.5 13.5l-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>

      <input
        v-model="modelValue"
        type="text"
        class="search-input"
        :placeholder="placeholder"
        @keydown.enter="handleSearch"
      />

      <button
        v-if="modelValue"
        class="clear-button"
        @click="clear"
        aria-label="Clear search"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <path d="M7 5.293L11.293 1 12.707 2.414 8.414 6.707l4.293 4.293-1.414 1.414L7 8.414l-4.293 4.293-1.414-1.414L5.586 6.707 1.293 2.414 2.707 1 7 5.293z" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'search': [value: string]
}>()

const modelValue = ref('')

watch(modelValue, (value) => {
  emit('update:modelValue', value)
})

function handleSearch() {
  emit('search', modelValue.value)
}

function clear() {
  modelValue.value = ''
  emit('search', '')
}
</script>

<style scoped>
.search-bar {
  width: 100%;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  width: 100%;
  height: 40px;
  padding: 0 12px;
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.search-input-wrapper:focus-within {
  background-color: var(--color-bg);
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 0 8px;
  font-size: 14px;
  color: var(--color-text);
  outline: none;
}

.search-input::placeholder {
  color: var(--color-text-muted);
}

.clear-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.clear-button:hover {
  color: var(--color-text);
  background-color: var(--color-bg-tertiary);
}
</style>
