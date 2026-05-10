<template>
  <div class="folder-browser">
    <!-- Drive selector -->
    <div class="drive-selector">
      <label class="drive-label">Drive:</label>
      <select
        v-model="selectedDrive"
        class="drive-select"
        @change="onDriveChange"
      >
        <option v-for="drive in drives" :key="drive.letter" :value="drive.letter">
          {{ drive.letter }} ({{ drive.label }})
        </option>
      </select>
    </div>

    <!-- Current path display -->
    <div class="path-display">
      <button
        class="nav-btn"
        :disabled="!parentPath"
        @click="navigateToParent"
        title="Go to parent directory"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M7.828 4H12.5a.5.5 0 01.5.5v7a.5.5 0 01-.5.5h-9a.5.5 0 01-.5-.5v-7a.5.5 0 01.5-.5h4.672L7.121 3.293a1 1 0 010-1.414 1 1 0 011.414 0l2.122 2.121a1 1 0 010 1.415L8.535 7.535a1 1 0 01-1.414-1.414L7.828 5.414V4z"/>
        </svg>
      </button>
      <div class="current-path">
        <span class="path-label">Location:</span>
        <span class="path-text" :title="currentPath">{{ displayPath }}</span>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="loading-state">
      <LoadingSpinner size="small" />
      <span>Loading...</span>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="error-state">
      <span class="error-icon">⚠️</span>
      <span>{{ error }}</span>
      <button class="retry-btn" @click="loadDirectory(currentPath)">Retry</button>
    </div>

    <!-- Directory list -->
    <div v-else class="directory-list">
      <div
        v-if="parentPath"
        class="directory-item parent-item"
        @click="navigateTo(parentPath)"
        @dblclick="navigateTo(parentPath)"
      >
        <span class="folder-icon">📁</span>
        <span class="folder-name">..</span>
      </div>

      <div
        v-for="entry in entries"
        :key="entry.path"
        class="directory-item"
        :class="{ selected: selectedPath === entry.path }"
        @click="selectEntry(entry)"
        @dblclick="navigateTo(entry.path)"
      >
        <span class="folder-icon">📁</span>
        <span class="folder-name">{{ entry.name }}</span>
      </div>

      <div v-if="entries.length === 0 && !parentPath" class="empty-state">
        No subdirectories found
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { projectsApi, type FilesystemEntry, type DriveInfo } from '@/api/projects'
import LoadingSpinner from './LoadingSpinner.vue'

const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [path: string]
  'select': [path: string]
}>()

const currentPath = ref('')
const parentPath = ref<string | null>(null)
const entries = ref<FilesystemEntry[]>([])
const selectedPath = ref<string>('')
const loading = ref(false)
const error = ref('')
const drives = ref<DriveInfo[]>([])
const selectedDrive = ref<string>('')
let loadGeneration = 0

const displayPath = computed(() => {
  if (!currentPath.value) return ''
  // Shorten long paths for display
  const maxLen = 60
  if (currentPath.value.length <= maxLen) return currentPath.value
  const parts = currentPath.value.split(/[\\/]/)
  if (parts.length <= 3) return currentPath.value
  return `${parts[0]}\\...\\${parts.slice(-2).join('\\')}`
})

async function loadDrives() {
  try {
    drives.value = await projectsApi.getDrives()
    // Set default drive based on current path or first available
    if (drives.value.length > 0) {
      if (currentPath.value) {
        const driveLetter = currentPath.value.substring(0, 2)
        const found = drives.value.find(d => d.letter === driveLetter)
        selectedDrive.value = found ? found.letter : drives.value[0].letter
      } else {
        selectedDrive.value = drives.value[0].letter
      }
    }
  } catch (e) {
    console.error('Failed to load drives', e)
    // Fallback: set default drives
    drives.value = [
      { letter: 'C:', label: 'System', free: 0, total: 0 }
    ]
    selectedDrive.value = 'C:'
  }
}

function onDriveChange() {
  if (selectedDrive.value) {
    navigateTo(selectedDrive.value + '\\')
  }
}

async function loadDirectory(dirPath?: string) {
  loading.value = true
  error.value = ''
  const generation = ++loadGeneration

  try {
    const response = await projectsApi.browseFilesystem(dirPath)
    // Discard stale response if a newer load was triggered
    if (generation !== loadGeneration) return

    currentPath.value = response.currentPath
    parentPath.value = response.parentPath
    entries.value = response.entries
    selectedPath.value = ''

    // Update selected drive based on current path
    if (response.currentPath) {
      const driveLetter = response.currentPath.substring(0, 2)
      if (drives.value.find(d => d.letter === driveLetter)) {
        selectedDrive.value = driveLetter
      }
    }

    emit('update:modelValue', response.currentPath)
  } catch (e) {
    if (generation !== loadGeneration) return
    error.value = e instanceof Error ? e.message : 'Failed to load directory'
  } finally {
    if (generation === loadGeneration) {
      loading.value = false
    }
  }
}

function navigateTo(dirPath: string) {
  loadDirectory(dirPath)
}

function navigateToParent() {
  if (parentPath.value) {
    navigateTo(parentPath.value)
  }
}

function selectEntry(entry: FilesystemEntry) {
  selectedPath.value = entry.path
  emit('select', entry.path)
  emit('update:modelValue', entry.path)
}

onMounted(async () => {
  await loadDrives()
  loadDirectory(props.modelValue)
})

watch(() => props.modelValue, (newPath) => {
  if (newPath && newPath !== currentPath.value) {
    loadDirectory(newPath)
  }
})
</script>

<style scoped>
.folder-browser {
  border: 1px solid var(--color-border, #d0d7de);
  border-radius: var(--radius-md, 6px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 320px;
}

.drive-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-bg-tertiary, #f0f2f5);
  border-bottom: 1px solid var(--color-border, #d0d7de);
}

.drive-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary, #656d76);
  flex-shrink: 0;
}

.drive-select {
  flex: 1;
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid var(--color-border, #d0d7de);
  border-radius: var(--radius-sm, 4px);
  background: var(--color-bg-primary, #fff);
  color: var(--color-text-primary, #1f2328);
  cursor: pointer;
}

.path-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-bg-secondary, #f6f8fa);
  border-bottom: 1px solid var(--color-border, #d0d7de);
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm, 4px);
  border: 1px solid var(--color-border, #d0d7de);
  background: var(--color-bg-primary, #fff);
  color: var(--color-text-secondary, #656d76);
  cursor: pointer;
  flex-shrink: 0;
}

.nav-btn:hover:not(:disabled) {
  background: var(--color-bg-tertiary, #f0f2f5);
  color: var(--color-text-primary, #1f2328);
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.current-path {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.path-label {
  font-size: 12px;
  color: var(--color-text-secondary, #656d76);
  flex-shrink: 0;
}

.path-text {
  font-size: 12px;
  font-family: monospace;
  color: var(--color-text-primary, #1f2328);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  font-size: 13px;
  color: var(--color-text-secondary, #656d76);
}

.error-state {
  flex-direction: column;
  gap: 12px;
}

.error-icon {
  font-size: 20px;
}

.retry-btn {
  padding: 4px 12px;
  font-size: 12px;
  border: 1px solid var(--color-border, #d0d7de);
  border-radius: var(--radius-sm, 4px);
  background: var(--color-bg-primary, #fff);
  color: var(--color-text-primary, #1f2328);
  cursor: pointer;
}

.retry-btn:hover {
  background: var(--color-bg-secondary, #f6f8fa);
}

.directory-list {
  overflow-y: auto;
  flex: 1;
}

.directory-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border, #d0d7de);
  transition: background-color 0.15s;
}

.directory-item:last-child {
  border-bottom: none;
}

.directory-item:hover {
  background: var(--color-bg-secondary, #f6f8fa);
}

.directory-item.selected {
  background: #ddf4ff;
  border-color: #0969da;
}

.parent-item {
  color: var(--color-text-secondary, #656d76);
}

.folder-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.folder-name {
  font-size: 13px;
  color: var(--color-text-primary, #1f2328);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.parent-item .folder-name {
  color: var(--color-text-secondary, #656d76);
}
</style>
