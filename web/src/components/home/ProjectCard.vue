<template>
  <tr class="project-row">
    <td class="cell-project" @click="navigate">
      <div class="project-info">
        <div class="project-icon" :style="{ backgroundColor: project.color || '#3b82f6' }">
          {{ project.name.charAt(0).toUpperCase() }}
        </div>
        <span class="project-name">{{ project.name }}</span>
      </div>
    </td>
    <td class="cell-repo" @click="navigate">
      <span class="repo-badge" :class="repoType === 'Git' ? 'badge-git' : 'badge-local'">
        {{ repoType }}
      </span>
    </td>
    <td class="cell-docs" @click="navigate">{{ project.documentCount }}</td>
    <td class="cell-update" @click="navigate">
      <div class="update-info">
        <span class="update-time">{{ formatDate(project.lastUpdated || '') }}</span>
        <span class="update-path">{{ shortPath(project.path) }}</span>
      </div>
    </td>
    <td class="cell-status" @click="navigate">
      <div v-if="isAnalyzing" class="status-analyzing" :title="analysisStep">
        <span class="status-dot"></span>
        <span>{{ t('project.analyzing') }}</span>
      </div>
      <div v-else-if="analysisFailed" class="status-failed" title="Analysis failed">
        {{ t('project.failed') }}
      </div>
    </td>
    <td class="cell-actions">
      <div class="action-buttons">
        <button class="action-btn action-chat" @click.stop="openChat" :title="t('project.openChat')">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 1a1 1 0 00-1 1v9a1 1 0 001 1h2.5a.5.5 0 01.5.5v2.207l2.854-2.854A.5.5 0 018.207 12H12a1 1 0 001-1V2a1 1 0 00-1-1H2zm0-1h10a2 2 0 012 2v9a2 2 0 01-2 2H8.207l-3.147 3.146A.5.5 0 014 13.793V13H2a2 2 0 01-2-2V2a2 2 0 012-2z"/>
          </svg>
        </button>
        <button class="action-btn action-delete" @click.stop="handleDelete" :title="t('common.delete')">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6.854 1.146a.5.5 0 01.708 0L8.707 2.5H13.5a.5.5 0 010 1h-.5v9a2 2 0 01-2 2H5a2 2 0 01-2-2v-9h-.5a.5.5 0 010-1h4.793L6.854 1.146zM5.5 5.5a.5.5 0 00-1 0v6a.5.5 0 001 0v-6zm3 0a.5.5 0 00-1 0v6a.5.5 0 001 0v-6z"/>
          </svg>
        </button>
      </div>
    </td>
  </tr>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAnalysisStore } from '@/stores/analysis'
import { useProjectsStore } from '@/stores/projects'
import { useUIStore } from '@/stores/ui'
import type { Project } from '@/types'

const props = defineProps<{
  project: Project
}>()

const emit = defineEmits<{
  deleted: []
}>()

const router = useRouter()
const analysisStore = useAnalysisStore()
const projectsStore = useProjectsStore()
const { progress } = storeToRefs(analysisStore)
const { t } = storeToRefs(useUIStore())

const repoType = computed(() => {
  const desc = (props.project.description || '').toLowerCase()
  if (desc.includes('git')) return 'Git'
  return 'Local'
})

const isAnalyzing = computed(() =>
  progress.value.status === 'running' && progress.value.projectName === props.project.name
)

const analysisFailed = computed(() =>
  progress.value.status === 'failed' && progress.value.projectName === props.project.name
)

const analysisStep = computed(() => {
  const stepMap: Record<string, string> = {
    'starting': 'Starting...',
    'collecting_structure': 'Reading structure...',
    'collecting_source_files': 'Scanning files...',
    'collecting_knowledge': 'Loading knowledge...',
    'building_prompt': 'Building prompt...',
    'calling_ai': 'Calling AI...',
    'writing_documents': 'Writing docs...',
    'updating_database': 'Updating DB...',
  }
  return stepMap[progress.value.currentStep] || progress.value.currentStep
})

function navigate() {
  router.push(`/project/${props.project.name}`)
}

function openChat() {
  router.push({ path: '/chat', query: { project: props.project.name } })
}

async function handleDelete() {
  // Validate project name before attempting delete
  if (!props.project.name || props.project.name.trim() === '') {
    alert(t.value('home.deleteFailed'))
    return
  }

  const msg = t.value('home.deleteConfirm', { name: props.project.name })
  if (!confirm(msg)) return

  try {
    await projectsStore.removeProject(props.project.name)
    emit('deleted')
  } catch (e) {
    alert(t.value('home.deleteFailed'))
  }
}

function formatDate(dateString: string): string {
  if (!dateString) return 'Never'
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return `${Math.floor(diffDays / 30)} months ago`
}

function shortPath(path: string): string {
  if (!path) return ''
  const max = 50
  if (path.length <= max) return path
  return '...' + path.slice(path.length - max + 3)
}
</script>

<style scoped>
.project-row {
  transition: background-color 0.15s;
  border-bottom: 1px solid var(--color-border-light, #e8ecf1);
}

.project-row:hover {
  background-color: var(--color-bg-secondary, #f6f8fa);
}

.project-row td {
  padding: 12px;
  vertical-align: middle;
}

.cell-project,
.cell-repo,
.cell-docs,
.cell-update,
.cell-status {
  cursor: pointer;
}

.project-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.project-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  color: white;
  flex-shrink: 0;
}

.project-name {
  font-weight: 600;
  color: var(--color-text-primary, #1f2328);
}

.repo-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.badge-git {
  background: #dafbe1;
  color: #1a7f37;
}

.badge-local {
  background: var(--color-bg-tertiary, #f0f2f5);
  color: var(--color-text-secondary, #656d76);
}

.cell-docs {
  text-align: center;
  font-weight: 500;
}

.update-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.update-time {
  color: var(--color-text-primary, #1f2328);
}

.update-path {
  font-size: 12px;
  color: var(--color-text-secondary, #656d76);
  font-family: var(--font-family-mono, monospace);
}

.cell-status {
  text-align: center;
}

.status-analyzing {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 10px;
  background: rgba(59, 130, 246, 0.1);
  font-size: 12px;
  font-weight: 500;
  color: #0969da;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #0969da;
  animation: pulse-dot 1.5s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.status-failed {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 10px;
  background: #ffebe9;
  font-size: 12px;
  font-weight: 500;
  color: #cf222e;
}

.cell-actions {
  width: 80px;
}

.action-buttons {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.project-row:hover .action-buttons {
  opacity: 1;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-md, 6px);
  border: none;
  cursor: pointer;
  background: none;
  transition: all 0.15s;
}

.action-chat {
  color: var(--color-text-link, #0969da);
}

.action-chat:hover {
  background: rgba(9, 105, 218, 0.1);
}

.action-delete {
  color: var(--color-text-secondary, #656d76);
}

.action-delete:hover {
  background: #ffebe9;
  color: #cf222e;
}
</style>
