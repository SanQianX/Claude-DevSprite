<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-container">
          <div class="modal-header">
            <h3>Token 消耗详情</h3>
            <button class="modal-close" @click="$emit('close')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div class="modal-tabs">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              class="modal-tab"
              :class="{ active: activeTab === tab.key }"
              @click="activeTab = tab.key"
            >
              {{ tab.label }}
            </button>
          </div>

          <div class="modal-body">
            <div v-if="loading" class="modal-loading">
              <div class="spinner"></div>
              <span>加载中...</span>
            </div>

            <div v-else-if="currentData.length === 0" class="modal-empty">
              暂无数据
            </div>

            <div v-else class="modal-content">
              <!-- Summary -->
              <div class="detail-summary">
                <div class="summary-item">
                  <span class="summary-label">总 Token</span>
                  <span class="summary-value">{{ formatNumber(totalStats.total) }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">输入</span>
                  <span class="summary-value input">{{ formatNumber(totalStats.input) }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">输出</span>
                  <span class="summary-value output">{{ formatNumber(totalStats.output) }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">缓存</span>
                  <span class="summary-value cache">{{ formatNumber(totalStats.cache) }}</span>
                </div>
                <div v-if="totalStats.cost > 0" class="summary-item">
                  <span class="summary-label">费用</span>
                  <span class="summary-value cost">${{ totalStats.cost.toFixed(2) }}</span>
                </div>
              </div>

              <!-- Daily Table -->
              <div class="detail-table-wrapper">
                <table class="detail-table">
                  <thead>
                    <tr>
                      <th class="col-date">日期</th>
                      <th class="col-input">输入</th>
                      <th class="col-output">输出</th>
                      <th class="col-cache">缓存</th>
                      <th class="col-total">总计</th>
                      <th class="col-cost">费用</th>
                      <th class="col-models">模型</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in currentData" :key="item.date" class="detail-row">
                      <td class="col-date">{{ formatDate(item.date) }}</td>
                      <td class="col-input">{{ formatNumber(item.input) }}</td>
                      <td class="col-output">{{ formatNumber(item.output) }}</td>
                      <td class="col-cache">{{ formatNumber(item.cache) }}</td>
                      <td class="col-total">{{ formatNumber(item.total) }}</td>
                      <td class="col-cost">{{ item.cost > 0 ? '$' + item.cost.toFixed(3) : '-' }}</td>
                      <td class="col-models">
                        <div class="model-tags">
                          <span
                            v-for="model in item.models"
                            :key="model"
                            class="model-tag"
                            :title="model"
                          >
                            {{ shortModelName(model) }}
                          </span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <span class="footer-info">数据来自 ccusage · 缓存 5 分钟</span>
            <button class="footer-refresh" @click="refreshData">
              <svg class="refresh-icon" :class="{ spinning: isRefreshing }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
              刷新
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { tokensApi, type DailyTokens } from '@/api/tokens'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const tabs = [
  { key: 'day', label: '日' },
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
  { key: 'all', label: '全部' },
]

const activeTab = ref('week')
const loading = ref(false)
const isRefreshing = ref(false)
const allData = ref<Record<string, DailyTokens[]>>({
  day: [],
  week: [],
  month: [],
  all: []
})

const currentData = computed(() => allData.value[activeTab.value] || [])

const totalStats = computed(() => {
  const items = currentData.value
  return {
    total: items.reduce((sum, d) => sum + d.total, 0),
    input: items.reduce((sum, d) => sum + d.input, 0),
    output: items.reduce((sum, d) => sum + d.output, 0),
    cache: items.reduce((sum, d) => sum + d.cache, 0),
    cost: items.reduce((sum, d) => sum + d.cost, 0)
  }
})

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function formatDate(dateStr: string): string {
  // Handle week format (2026-01-18)
  if (dateStr.length === 10 && dateStr[4] === '-') {
    return dateStr
  }
  // Handle month format (2026-01)
  if (dateStr.length === 7) {
    return dateStr
  }
  return dateStr
}

function shortModelName(model: string): string {
  // Shorten model names for display
  const shortMap: Record<string, string> = {
    'claude-sonnet-4-20250514': 'Sonnet 4',
    'claude-opus-4-20250514': 'Opus 4',
    'claude-haiku-4-5-20251001': 'Haiku 4.5',
    'mimo-v2.5': 'Mimo 2.5',
    'mimo-v2.5-pro': 'Mimo 2.5 Pro',
    'glm-5.1': 'GLM 5.1',
    'glm-4.7': 'GLM 4.7',
  }
  return shortMap[model] || model.split('-').slice(0, 2).join('-')
}

async function fetchData(period: string, force = false) {
  try {
    const data = force
      ? await tokensApi.refresh()
      : await tokensApi.getStats(period)
    const result = force ? data.data : data
    allData.value[period] = result.daily || []
  } catch (error) {
    console.error(`Failed to fetch ${period} data:`, error)
    allData.value[period] = []
  }
}

async function loadAllData(force = false) {
  loading.value = true
  try {
    await Promise.all([
      fetchData('day', force),
      fetchData('week', force),
      fetchData('month', force),
      fetchData('all', force)
    ])
  } finally {
    loading.value = false
  }
}

async function refreshData() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    await loadAllData(true)
  } finally {
    isRefreshing.value = false
  }
}

// Load data when modal opens
watch(() => props.visible, (newVal) => {
  if (newVal) {
    loadAllData()
  }
})

onMounted(() => {
  if (props.visible) {
    loadAllData()
  }
})
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
  padding: 20px;
}

.modal-container {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 900px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-close:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.modal-close svg {
  width: 18px;
  height: 18px;
}

.modal-tabs {
  display: flex;
  gap: 4px;
  padding: 12px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.modal-tab {
  padding: 6px 16px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-tab:hover {
  background: #f1f5f9;
}

.modal-tab.active {
  background: #3b82f6;
  color: #fff;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.modal-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: #64748b;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.modal-empty {
  text-align: center;
  padding: 40px;
  color: #94a3b8;
}

.detail-summary {
  display: flex;
  gap: 24px;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 8px;
  margin-bottom: 16px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-label {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.summary-value {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.summary-value.input { color: #3b82f6; }
.summary-value.output { color: #8b5cf6; }
.summary-value.cache { color: #22c55e; }
.summary-value.cost { color: #16a34a; }

.detail-table-wrapper {
  overflow-x: auto;
}

.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.detail-table th {
  text-align: left;
  padding: 10px 12px;
  font-weight: 600;
  color: #64748b;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;
}

.detail-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
}

.detail-row:hover {
  background: #f8fafc;
}

.col-date {
  font-weight: 500;
  white-space: nowrap;
}

.col-input { color: #3b82f6; }
.col-output { color: #8b5cf6; }
.col-cache { color: #22c55e; }
.col-total { font-weight: 600; }
.col-cost { color: #16a34a; }

.col-models {
  max-width: 200px;
}

.model-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.model-tag {
  display: inline-block;
  padding: 2px 8px;
  background: #e2e8f0;
  border-radius: 4px;
  font-size: 11px;
  color: #475569;
  white-space: nowrap;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

.footer-info {
  font-size: 11px;
  color: #94a3b8;
}

.footer-refresh {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.footer-refresh:hover {
  background: #f1f5f9;
  color: #475569;
}

.refresh-icon {
  width: 14px;
  height: 14px;
}

.refresh-icon.spinning {
  animation: spin 1s linear infinite;
}

/* Transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.2s ease;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95);
}
</style>
