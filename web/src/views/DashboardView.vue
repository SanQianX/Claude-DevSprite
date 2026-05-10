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
            <div class="stats-sub">{{ completedCount }} / {{ tasks.length }} 完成</div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: completionPercent + '%' }"></div>
          </div>
          <div class="stats-detail">
            <div>进行中: {{ inProgressCount }} 个任务</div>
            <div>待开发: {{ backlogCount }} 个任务</div>
          </div>
        </div>
      </div>

      <!-- Review Queue -->
      <div class="section review-section">
        <div class="section-header">
          <div class="section-title">AI 审查队列</div>
        </div>
        <div class="review-filters">
          <select class="filter-select">
            <option>全部</option>
            <option>待审批</option>
            <option>已批准</option>
            <option>已忽略</option>
          </select>
          <select class="filter-select">
            <option>严重性</option>
            <option>HIGH</option>
            <option>MED</option>
            <option>LOW</option>
          </select>
          <div class="review-counts">
            待审批: <span>{{ reviewStats.pending }}</span> |
            已批准: <span>{{ reviewStats.approved }}</span> |
            已忽略: <span>{{ reviewStats.ignored }}</span>
          </div>
        </div>
        <div v-if="reviews.length === 0" class="empty-reviews">
          暂无审查项
        </div>
        <div v-for="review in reviews" :key="review.id" class="review-item">
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
            <div class="review-time">{{ review.time }}</div>
            <div class="review-actions">
              <button class="btn btn-approve" @click="approveReview(review.id)">批准修复</button>
              <button class="btn btn-ignore" @click="ignoreReview(review.id)">忽略</button>
              <button class="btn btn-locate">定位</button>
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
import { ref, computed, reactive, onMounted } from 'vue'
import { useDashboardStore } from '@/stores/dashboard'
import type { Task, Review } from '@/api/dashboard'

const props = defineProps<{
  projectName: string
}>()

const dashboardStore = useDashboardStore()

const showAddTask = ref(false)
const newTaskTitle = ref('')

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
    get tasks() { return tasks.value.filter(t => t.status === 'progress') },
  },
  {
    label: '已完成',
    expanded: true,
    get tasks() { return tasks.value.filter(t => t.status === 'done') },
  },
  {
    label: '待开发',
    expanded: true,
    get tasks() { return tasks.value.filter(t => t.status === 'backlog') },
  },
])

const completedCount = computed(() => tasks.value.filter(t => t.status === 'done').length)
const inProgressCount = computed(() => tasks.value.filter(t => t.status === 'progress').length)
const backlogCount = computed(() => tasks.value.filter(t => t.status === 'backlog').length)
const completionPercent = computed(() =>
  tasks.value.length > 0 ? Math.round((completedCount.value / tasks.value.length) * 100) : 0
)

const reviews = computed(() => dashboardStore.reviews)

const reviewStats = computed(() => ({
  pending: reviews.value.filter(r => r.status === 'pending').length,
  approved: reviews.value.filter(r => r.status === 'approved').length,
  ignored: reviews.value.filter(r => r.status === 'ignored').length,
}))

function approveReview(id: number) {
  dashboardStore.approveReview(props.projectName, id)
}

function ignoreReview(id: number) {
  dashboardStore.ignoreReview(props.projectName, id)
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
  if (status === 'done') return 'green'
  if (status === 'progress') return 'blue'
  return 'gray'
}

function getTaskMeta(task: Task): string {
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

  // Fetch tasks and reviews from API
  await dashboardStore.fetchAll(props.projectName)
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
}

.severity-high { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
.severity-med { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
.severity-low { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }

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
