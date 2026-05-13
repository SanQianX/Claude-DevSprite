<template>
  <div class="dashboard-view">
    <div class="dashboard-content">
      <!-- Project Info Bar -->
      <div class="project-info">
        <div class="project-badge" :style="{ background: projectColor }">
          {{ projectName.charAt(0).toUpperCase() }}
        </div>
        <div class="project-meta">
          <h2>{{ projectName }}</h2>
          <p>{{ projectPath }}</p>
        </div>
        <div class="project-stats">
          <div class="stat-item">
            <div class="stat-value">{{ stats.docCount }}</div>
            <div class="stat-label">文档</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ stats.sourceFiles }}</div>
            <div class="stat-label">源文件</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ stats.analyses }}</div>
            <div class="stat-label">分析次数</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ stats.lastAnalysis }}</div>
            <div class="stat-label">上次分析</div>
          </div>
          <button class="analyze-btn" :disabled="analyzing" @click="startAnalysis">
            {{ analyzing ? '分析中...' : '开始分析' }}
          </button>
        </div>
      </div>

      <!-- Two Column: Tasks + Stats -->
      <div class="two-col">
        <!-- Task List -->
        <div class="section">
          <div class="section-header">
            <div class="section-title">项目计划</div>
          </div>
          <div class="section-body">
            <div v-if="tasks.length === 0" class="empty-tasks">
              暂无任务
            </div>
            <template v-else>
              <div v-for="group in taskGroups" :key="group.label" class="task-group">
                <div class="task-group-header" @click="group.expanded = !group.expanded">
                  <span class="arrow">{{ group.expanded ? '▾' : '▸' }}</span>
                  {{ group.label }} ({{ group.tasks.length }})
                </div>
                <template v-if="group.expanded">
                  <div v-for="task in group.tasks" :key="task.id" class="task-item">
                    <div class="task-dot" :class="'dot-' + getStatusColor(task.status)"></div>
                    <div class="task-info">
                      <div class="task-title">{{ task.title }}</div>
                      <div class="task-meta">{{ getTaskMeta(task) }}</div>
                    </div>
                  </div>
                </template>
              </div>
            </template>
            <button class="add-btn" @click="showAddTask = true">+ 添加任务</button>
          </div>
        </div>

        <!-- Stats Card -->
        <div class="stats-card">
          <div class="section-title" style="margin-bottom:16px">进度统计</div>
          <div class="stats-center">
            <div class="stats-percent">{{ completionPercent }}%</div>
            <div class="stats-sub">{{ completedCount }} / {{ completedCount + inProgressCount + backlogCount }} 完成</div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: completionPercent + '%' }"></div>
          </div>
          <div class="stats-detail">
            <div>进行中: {{ inProgressCount }} 项</div>
            <div>待开发: {{ backlogCount }} 项</div>
          </div>
        </div>
      </div>

      <!-- Review Queue -->
      <div class="section review-section">
        <div class="section-header">
          <div class="section-title">AI 审查队列</div>
          <div class="scan-controls">
            <label class="scan-toggle">
              <input type="checkbox" v-model="autoScanEnabled" @change="toggleAutoScan" />
              <span class="scan-toggle-label">定时扫描</span>
            </label>
            <select
              v-if="autoScanEnabled"
              class="scan-interval-select"
              v-model="scanIntervalMinutes"
              @change="updateScanInterval"
            >
              <option :value="5">5 分钟</option>
              <option :value="10">10 分钟</option>
              <option :value="15">15 分钟</option>
              <option :value="30">30 分钟</option>
              <option :value="60">1 小时</option>
            </select>
            <label class="scan-toggle">
              <input type="checkbox" v-model="autoFixAfterScan" />
              <span class="scan-toggle-label">自动修复</span>
            </label>
            <button class="scan-btn" :disabled="scanning" @click="startScan">
              {{ scanning ? scanStatusText : '开始扫描' }}
            </button>
          </div>
        </div>
        <div class="review-filters">
          <select class="filter-select" v-model="statusFilter">
            <option value="all">全部</option>
            <option value="pending">待审批</option>
            <option value="approved">已批准</option>
            <option value="fixed">已修复</option>
            <option value="confirmed">已确认</option>
            <option value="ignored">已忽略</option>
          </select>
          <select class="filter-select" v-model="severityFilter">
            <option value="all">严重性</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          <button
            v-if="statusFilter !== 'all' || severityFilter !== 'all'"
            class="filter-reset-btn"
            @click="resetFilters"
          >
            重置筛选
          </button>
          <div class="review-counts">
            待审批: <span>{{ reviewStats.pending }}</span> |
            已批准: <span>{{ reviewStats.approved }}</span> |
            已修复: <span>{{ reviewStats.fixed }}</span> |
            已确认: <span>{{ reviewStats.confirmed }}</span> |
            已忽略: <span>{{ reviewStats.ignored }}</span>
          </div>
        </div>
        <div v-if="reviews.length === 0" class="empty-reviews">
          暂无审查项
        </div>
        <div v-else-if="filteredReviews.length === 0" class="empty-reviews">
          无匹配的审查项
        </div>
        <div
          v-for="review in filteredReviews"
          :key="review.id"
          class="review-item"
          :class="{ 'review-item-expanded': selectedReviewId === review.id }"
          @click="toggleReviewDetail(review.id)"
        >
          <div class="review-top">
            <span class="severity-badge" :class="'severity-' + review.severity.toLowerCase()">
              {{ review.severity }}
            </span>
            <div>
              <div class="review-title">{{ review.title }}</div>
              <div class="review-location">{{ review.location }}</div>
            </div>
          </div>
          <div class="review-suggestion">{{ review.suggestion }}</div>
          <div class="review-footer">
            <div class="review-time">{{ formatTime(review.created_at) }}</div>
            <div class="review-actions">
              <button class="btn btn-approve" @click.stop="fixReview(review.id)">
                {{ getFixButtonText(review) }}
              </button>
              <button class="btn btn-ignore" @click.stop="ignoreReview(review.id)">忽略</button>
              <button class="btn btn-discuss" @click.stop="discussReview(review)">讨论</button>
              <button
                class="btn btn-locate"
                :disabled="!review.location"
                :class="{ 'btn-disabled': !review.location }"
                @click.stop="review.location && locateReview(review)"
              >定位</button>
            </div>
          </div>
          <!-- Expanded Detail -->
          <div v-if="selectedReviewId === review.id" class="review-detail-expanded" @click.stop>
            <div class="detail-section" v-if="review.suggestion">
              <div class="detail-label">AI 建议详情</div>
              <div class="code-block">{{ review.suggestion }}</div>
            </div>
            <div class="detail-section">
              <div class="detail-label">位置</div>
              <div class="code-block">{{ review.location || '未指定' }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Task Dialog -->
    <div v-if="showAddTask" class="dialog-overlay" @click.self="showAddTask = false">
      <div class="dialog">
        <h3>添加任务</h3>
        <input v-model="newTaskTitle" class="dialog-input" placeholder="任务标题" />
        <div class="dialog-actions">
          <button class="btn btn-ignore" @click="showAddTask = false">取消</button>
          <button class="btn btn-approve" @click="addTask">添加</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDashboardStore } from '@/stores/dashboard'
import { analysisApi } from '@/api/analysis'
import type { Task, Review } from '@/api/dashboard'

const props = defineProps<{
  projectName: string
}>()

const router = useRouter()
const dashboardStore = useDashboardStore()

const showAddTask = ref(false)
const newTaskTitle = ref('')
const statusFilter = ref('all')
const severityFilter = ref('all')
const selectedReviewId = ref<number | null>(null)
const scanning = ref(false)
const scanPhase = ref<'scan' | 'fix'>('scan')
const scanFixProgress = ref({ fixed: 0, confirmed: 0, failed: 0, total: 0 })
const autoFixAfterScan = ref(localStorage.getItem(`autofix-${props.projectName}`) === 'true')
const analyzing = ref(false)

// Persist autoFix checkbox state
watch(autoFixAfterScan, (val) => {
  localStorage.setItem(`autofix-${props.projectName}`, String(val))
})
const autoScanEnabled = ref(true)
const scanIntervalMinutes = ref(10)

const projectColor = ref('#f97316')
const projectPath = ref('')

const stats = reactive({
  docCount: 0,
  sourceFiles: 0,
  analyses: 0,
  lastAnalysis: '--',
})

// Adapt API tasks to display format
const tasks = computed(() => dashboardStore.tasks)

const taskGroups = reactive([
  {
    label: '进行中',
    expanded: true,
    get tasks() {
      // Tasks in progress + pending/approved reviews (awaiting action)
      const taskInProgress = tasks.value.filter(t => t.status === 'progress')
      const reviewsInProgress = reviews.value.filter(r => r.status === 'pending' || r.status === 'approved')
      return [...taskInProgress, ...reviewsInProgress]
    },
  },
  {
    label: '已完成',
    expanded: true,
    get tasks() {
      // Completed tasks + fixed/confirmed reviews
      const taskDone = tasks.value.filter(t => t.status === 'done')
      const reviewsDone = reviews.value.filter(r => r.status === 'fixed' || r.status === 'confirmed')
      return [...taskDone, ...reviewsDone]
    },
  },
  {
    label: '待开发',
    expanded: true,
    get tasks() {
      // Backlog tasks + ignored reviews (deferred)
      const taskBacklog = tasks.value.filter(t => t.status === 'backlog')
      const reviewsIgnored = reviews.value.filter(r => r.status === 'ignored')
      return [...taskBacklog, ...reviewsIgnored]
    },
  },
])

const completedCount = computed(() =>
  tasks.value.filter(t => t.status === 'done').length +
  reviews.value.filter(r => r.status === 'fixed' || r.status === 'confirmed').length
)
const inProgressCount = computed(() =>
  tasks.value.filter(t => t.status === 'progress').length +
  reviews.value.filter(r => r.status === 'pending' || r.status === 'approved').length
)
const backlogCount = computed(() =>
  tasks.value.filter(t => t.status === 'backlog').length +
  reviews.value.filter(r => r.status === 'ignored').length
)
const completionPercent = computed(() => {
  const total = tasks.value.length + reviews.value.filter(r => r.status !== 'ignored').length
  return total > 0 ? Math.round((completedCount.value / total) * 100) : 0
})

const reviews = computed(() => dashboardStore.reviews)

const filteredReviews = computed(() => {
  return reviews.value.filter(r => {
    const statusMatch = statusFilter.value === 'all' || r.status === statusFilter.value
    // 严重性筛选：大小写不敏感比较
    const severityMatch = severityFilter.value === 'all' ||
      r.severity?.toUpperCase() === severityFilter.value.toUpperCase()
    return statusMatch && severityMatch
  })
})

const reviewStats = computed(() => ({
  pending: reviews.value.filter(r => r.status === 'pending').length,
  approved: reviews.value.filter(r => r.status === 'approved').length,
  fixed: reviews.value.filter(r => r.status === 'fixed').length,
  confirmed: reviews.value.filter(r => r.status === 'confirmed').length,
  ignored: reviews.value.filter(r => r.status === 'ignored').length,
}))

const scanStatusText = computed(() => {
  if (scanPhase.value === 'scan') return '扫描中...'
  const p = scanFixProgress.value
  return `修复中 ${p.fixed + p.confirmed + p.failed}/${p.total}...`
})

async function fixReview(id: number) {
  try {
    await dashboardStore.fixReview(props.projectName, id)
  } catch (e) {
    console.error('Fix failed:', e)
  }
}

async function startScan() {
  scanning.value = true
  scanPhase.value = 'scan'
  try {
    // Record existing pending review IDs before scan
    const oldPendingIds = new Set(
      dashboardStore.reviews
        .filter(r => r.status === 'pending')
        .map(r => r.id)
    )

    const scanResult = await dashboardStore.triggerScan(props.projectName)

    // Auto-fix if enabled and there are findings
    if (autoFixAfterScan.value && scanResult.findingsCount > 0) {
      // Find new review IDs (not in old set)
      const newReviewIds = dashboardStore.reviews
        .filter(r => r.status === 'pending' && !oldPendingIds.has(r.id))
        .map(r => r.id)

      scanPhase.value = 'fix'
      scanFixProgress.value = { fixed: 0, confirmed: 0, failed: 0, total: newReviewIds.length }
      const fixResult = await dashboardStore.batchFixReviews(props.projectName, newReviewIds)
      scanFixProgress.value = { fixed: fixResult.fixed, confirmed: fixResult.confirmed, failed: fixResult.failed, total: fixResult.fixed + fixResult.confirmed + fixResult.failed }
    }
  } catch (e) {
    console.error('Scan failed:', e)
  } finally {
    scanning.value = false
  }
}

async function toggleAutoScan() {
  try {
    await dashboardStore.updateScannerConfig({ enabled: autoScanEnabled.value })
  } catch (e) {
    console.error('Failed to update scanner config:', e)
  }
}

async function updateScanInterval() {
  try {
    await dashboardStore.updateScannerConfig({ intervalMs: scanIntervalMinutes.value * 60 * 1000 })
  } catch (e) {
    console.error('Failed to update scan interval:', e)
  }
}

async function startAnalysis() {
  analyzing.value = true
  try {
    await analysisApi.triggerFullAnalysis(props.projectName)
  } catch (e) {
    console.error('Analysis failed:', e)
  } finally {
    analyzing.value = false
  }
}

function ignoreReview(id: number) {
  dashboardStore.ignoreReview(props.projectName, id)
}

function locateReview(review: Review) {
  // Parse location like "src/utils/helper.ts:42" or "docs/guide.md"
  const location = review.location
  const colonIndex = location.indexOf(':')
  const filePath = colonIndex > -1 ? location.substring(0, colonIndex) : location
  const lineNum = colonIndex > -1 ? parseInt(location.substring(colonIndex + 1)) : undefined

  // Navigate to workspace with code panel showing the file
  router.push({
    path: `/project/${props.projectName}`,
    query: {
      tab: 'workspace',
      code: filePath,
      line: lineNum?.toString() || '',
      panels: 'code,chat',
    }
  })
}

function discussReview(review: Review) {
  router.push({
    path: `/project/${props.projectName}`,
    query: {
      tab: 'workspace',
      discuss: review.id.toString(),
      panels: 'chat',
    }
  })
}

function toggleReviewDetail(reviewId: number) {
  selectedReviewId.value = selectedReviewId.value === reviewId ? null : reviewId
}

function resetFilters() {
  statusFilter.value = 'all'
  severityFilter.value = 'all'
}

function getFixButtonText(review: Review): string {
  if (review.source === 'design-check') {
    if (!review.location) {
      return review.category === 'unrecorded' ? '更新文档' : '确认问题'
    }
  }
  return '批准修复'
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

async function addTask() {
  if (!newTaskTitle.value.trim()) return
  await dashboardStore.addTask(props.projectName, {
    title: newTaskTitle.value,
    status: 'backlog',
    priority: 'medium',
  })
  newTaskTitle.value = ''
  showAddTask.value = false
}

function getStatusColor(status: string): string {
  if (status === 'done' || status === 'fixed' || status === 'confirmed') return 'green'
  if (status === 'progress' || status === 'pending' || status === 'approved') return 'blue'
  return 'gray'
}

function getTaskMeta(task: any): string {
  // Handle review items (have severity/category)
  if (task.severity || task.category) {
    const parts: string[] = []
    if (task.severity) parts.push(task.severity)
    if (task.category) parts.push(task.category)
    if (task.source) parts.push(task.source)
    return parts.join(' | ') || '审查项'
  }
  // Handle task items
  if (task.status === 'done' && task.completed_at) {
    return `完成于: ${new Date(task.completed_at).toLocaleDateString()}`
  }
  const parts: string[] = []
  if (task.priority) parts.push(`优先级: ${task.priority}`)
  if (task.estimated) parts.push(`预计: ${task.estimated}`)
  return parts.join(' | ') || '待开发'
}

onMounted(async () => {
  // Fetch project details
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(props.projectName)}`)
    const data = await res.json()
    if (data.success !== false) {
      projectPath.value = data.path || ''
      stats.docCount = data.documentCount || 0
    }
  } catch { /* ignore */ }

  // Fetch tasks, reviews, and scanner config from API
  await dashboardStore.fetchAll(props.projectName)
  await dashboardStore.fetchScannerConfig()
  autoScanEnabled.value = dashboardStore.scannerConfig.enabled
  scanIntervalMinutes.value = Math.round(dashboardStore.scannerConfig.intervalMs / 60000)

  // Restore scanning state from backend
  if (dashboardStore.scannerConfig.isScanning) {
    scanning.value = true
  }
})
</script>

<style scoped>
.dashboard-view {
  flex: 1;
  overflow-y: auto;
}

.dashboard-content {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.project-info {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  margin-bottom: 24px;
}

.project-badge {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 28px;
  font-weight: 700;
  flex-shrink: 0;
}

.project-meta h2 {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.project-meta p {
  font-size: 13px;
  color: #64748b;
  margin: 4px 0 0;
  font-family: monospace;
}

.project-stats {
  margin-left: auto;
  display: flex;
  gap: 24px;
}

.stat-item { text-align: center; }
.stat-value { font-size: 24px; font-weight: 700; color: #1e293b; }
.stat-label { font-size: 12px; color: #94a3b8; }

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

.section {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}

.section-body { padding: 16px 20px; }

.stats-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 20px;
}

.stats-center {
  text-align: center;
  padding: 20px 0;
}

.stats-percent {
  font-size: 48px;
  font-weight: 800;
  color: #1e293b;
}

.stats-sub {
  font-size: 14px;
  color: #64748b;
  margin-top: 4px;
}

.progress-bar {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  margin: 12px 0;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #22c55e);
  border-radius: 4px;
  transition: width 0.3s;
}

.stats-detail {
  font-size: 13px;
  color: #64748b;
  line-height: 1.8;
}

.task-group { margin-bottom: 16px; }

.task-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
}

.task-group-header .arrow { font-size: 10px; color: #94a3b8; }

.task-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  margin: 4px 0;
  border-radius: 8px;
  background: #f8fafc;
}

.task-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 4px;
  flex-shrink: 0;
}

.dot-blue { background: #3b82f6; }
.dot-green { background: #22c55e; }
.dot-gray { background: #94a3b8; }

.task-info { flex: 1; }
.task-title { font-size: 14px; font-weight: 500; color: #1e293b; }
.task-meta { font-size: 12px; color: #94a3b8; margin-top: 2px; }

.empty-tasks, .empty-reviews {
  padding: 24px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
}

.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #eff6ff;
  color: #3b82f6;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  margin-top: 8px;
}

.add-btn:hover { background: #dbeafe; }

.review-section { margin-bottom: 0; }

.scan-btn {
  padding: 5px 14px;
  background: #eff6ff;
  color: #3b82f6;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.scan-btn:hover { background: #dbeafe; }
.scan-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.scan-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.scan-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 12px;
  color: #475569;
}

.scan-toggle input[type="checkbox"] {
  width: 14px;
  height: 14px;
  accent-color: #3b82f6;
  cursor: pointer;
}

.scan-toggle-label {
  user-select: none;
}

.scan-interval-select {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 12px;
  color: #475569;
  background: #fff;
  cursor: pointer;
}

.analyze-btn {
  padding: 6px 16px;
  background: #7c3aed;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  margin-left: auto;
}

.analyze-btn:hover { background: #6d28d9; }
.analyze-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.review-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.filter-select {
  padding: 4px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 12px;
  color: #475569;
  background: #fff;
}

.filter-reset-btn {
  padding: 4px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 12px;
  color: #dc2626;
  background: #fef2f2;
  cursor: pointer;
}

.filter-reset-btn:hover {
  background: #fee2e2;
}

.review-counts {
  margin-left: auto;
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #64748b;
}

.review-counts span { font-weight: 600; }

.review-item {
  padding: 16px 20px;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background 150ms;
}

.review-item:hover {
  background: #f8fafc;
}

.review-item-expanded {
  background: #f8fafc;
}

.review-item:last-child { border-bottom: none; }

.review-top {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.severity-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  text-transform: capitalize;
}

.severity-critical { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
.severity-warning { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
.severity-info { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }

.review-title { font-size: 14px; font-weight: 600; color: #1e293b; }
.review-location { font-size: 12px; color: #3b82f6; font-family: monospace; margin-top: 4px; }

.review-suggestion {
  font-size: 12px;
  color: #475569;
  padding: 8px 12px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  margin: 8px 0 8px 52px;
}

.review-suggestion::before {
  content: "AI 建议: ";
  font-weight: 600;
  color: #16a34a;
}

.review-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 52px;
  margin-top: 8px;
}

.review-time { font-size: 11px; color: #94a3b8; }
.review-actions { display: flex; gap: 8px; }

.review-detail-expanded {
  margin-top: 12px;
  padding: 12px;
  margin-left: 52px;
  background: #f1f5f9;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.detail-section {
  margin-bottom: 10px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.code-block {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 12px;
  color: #1e293b;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 8px 12px;
  white-space: pre-wrap;
  line-height: 1.5;
}

.btn {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid;
}

.btn-approve { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
.btn-approve:hover { background: #dcfce7; }
.btn-ignore { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
.btn-ignore:hover { background: #fee2e2; }
.btn-locate { background: #f5f3ff; color: #7c3aed; border-color: #ddd6fe; }
.btn-locate:hover { background: #ede9fe; }
.btn-discuss { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
.btn-discuss:hover { background: #dbeafe; }
.btn-disabled { opacity: 0.4; cursor: not-allowed; }
.btn-disabled:hover { background: inherit; }

/* Dialog */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  min-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

.dialog h3 {
  margin: 0 0 16px;
  font-size: 18px;
  color: #1e293b;
}

.dialog-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 16px;
  box-sizing: border-box;
}

.dialog-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 768px) {
  .two-col { grid-template-columns: 1fr; }
  .project-info { flex-wrap: wrap; }
  .project-stats { margin-left: 0; width: 100%; justify-content: space-around; margin-top: 12px; }
}
</style>