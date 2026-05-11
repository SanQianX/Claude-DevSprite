<template>
  <div class="tokens-bar">
    <div class="tokens-summary">
      <span class="tokens-summary-label">Tokens</span>
      <span class="tokens-summary-value">{{ formatNumber(currentStats.total) }}</span>
      <span v-if="currentStats.cost > 0" class="tokens-cost">${{ currentStats.cost.toFixed(2) }}</span>
    </div>
    <div class="tokens-divider"></div>
    <div class="tokens-chips">
      <div class="tokens-chip">
        <div class="tokens-dot tokens-dot-in"></div>
        <span>Input</span>
        <span class="tokens-chip-value">{{ formatNumber(currentStats.input) }}</span>
      </div>
      <div class="tokens-chip">
        <div class="tokens-dot tokens-dot-out"></div>
        <span>Output</span>
        <span class="tokens-chip-value">{{ formatNumber(currentStats.output) }}</span>
      </div>
      <div class="tokens-chip">
        <div class="tokens-dot tokens-dot-cache"></div>
        <span>Cache</span>
        <span class="tokens-chip-value">{{ formatNumber(currentStats.cache) }}</span>
      </div>
    </div>
    <!-- Mini bar chart -->
    <div class="tokens-mini-chart">
      <div
        v-for="(day, i) in chartData"
        :key="i"
        class="tokens-mini-bar-group"
        :title="`${day.date}: ${formatNumber(day.total)} tokens`"
      >
        <div class="tokens-mini-bar in" :style="{ height: day.inHeight + 'px' }"></div>
        <div class="tokens-mini-bar out" :style="{ height: day.outHeight + 'px' }"></div>
      </div>
    </div>
    <div class="tokens-trend" :class="trendClass">
      {{ trendText }}
    </div>
    <div class="tokens-period">
      <button
        v-for="period in periods"
        :key="period.key"
        class="tokens-period-btn"
        :class="{ active: activePeriod === period.key }"
        @click="setPeriod(period.key)"
      >
        {{ period.label }}
      </button>
    </div>
    <button
      class="tokens-detail-btn"
      title="查看详细消耗"
      @click="showDetail = true"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
      </svg>
    </button>
    <button
      class="tokens-refresh-btn"
      :class="{ refreshing: isRefreshing }"
      title="刷新数据"
      @click="refreshData"
    >
      <svg class="refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 4v6h-6M1 20v-6h6"/>
        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
      </svg>
    </button>
    <span v-if="lastUpdated" class="tokens-updated" :title="lastUpdatedFull">
      {{ lastUpdatedRelative }}
    </span>
  </div>

  <TokenDetailModal :visible="showDetail" @close="showDetail = false" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { tokensApi, type DailyTokens, type TokenStats } from '@/api/tokens'
import TokenDetailModal from './TokenDetailModal.vue'

const activePeriod = ref('week')
const isRefreshing = ref(false)
const lastUpdated = ref<string | null>(null)
const showDetail = ref(false)

// Pre-loaded data for all periods (instant switching)
const allPeriodData = ref<Record<string, {
  stats: TokenStats
  daily: DailyTokens[]
  trendDelta: number
  trendPercent: number
}>>({})

const periods = [
  { key: 'day', label: '日' },
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
  { key: 'all', label: '全部' },
]

// Current period data (instant from cache)
const currentData = computed(() => allPeriodData.value[activePeriod.value])
const currentStats = computed(() => currentData.value?.stats || { total: 0, input: 0, output: 0, cache: 0, cost: 0 })

const chartData = computed(() => {
  const items = currentData.value?.daily || []
  const maxVal = Math.max(...items.map(d => d.total || Math.max(d.input, d.output)), 1)
  return items.slice(-14).map(d => ({
    date: d.date,
    total: d.total || d.input + d.output,
    inHeight: Math.round((d.input / maxVal) * 20),
    outHeight: Math.round((d.output / maxVal) * 20),
  }))
})

const trendDelta = computed(() => currentData.value?.trendDelta || 0)
const trendPercent = computed(() => currentData.value?.trendPercent || 0)

const trendClass = computed(() => {
  if (trendPercent.value > 0) return 'up'
  if (trendPercent.value < 0) return 'down'
  return 'neutral'
})

const trendText = computed(() => {
  if (trendDelta.value === 0 && trendPercent.value === 0) return '--'
  const sign = trendDelta.value >= 0 ? '+' : ''
  const pctSign = trendPercent.value >= 0 ? '↑' : '↓'
  return `${sign}${formatNumber(Math.abs(trendDelta.value))} ${pctSign}${Math.abs(trendPercent.value)}%`
})

const lastUpdatedFull = computed(() => {
  if (!lastUpdated.value) return ''
  return new Date(lastUpdated.value).toLocaleString()
})

const lastUpdatedRelative = computed(() => {
  if (!lastUpdated.value) return ''
  const diff = Date.now() - new Date(lastUpdated.value).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  return `${Math.floor(hours / 24)}天前`
})

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

function setPeriod(key: string) {
  activePeriod.value = key
  // No need to fetch - data is already loaded!
}

// Fetch data for a specific period
async function fetchPeriod(period: string): Promise<boolean> {
  try {
    const data = await tokensApi.getStats(period)
    allPeriodData.value[period] = {
      stats: data.stats,
      daily: data.daily,
      trendDelta: data.trendDelta,
      trendPercent: data.trendPercent
    }
    lastUpdated.value = data.lastUpdated
    return true
  } catch (error) {
    console.error(`Failed to fetch ${period} data:`, error)
    return false
  }
}

// Pre-load ALL periods in parallel on mount
async function preloadAllPeriods() {
  const periods = ['day', 'week', 'month', 'all']
  await Promise.all(periods.map(p => fetchPeriod(p)))
}

async function refreshData() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    // Force refresh all periods
    await tokensApi.refresh()
    await preloadAllPeriods()
  } finally {
    isRefreshing.value = false
  }
}

onMounted(() => {
  preloadAllPeriods()
})
</script>

<style scoped>
.tokens-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 14px 24px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.tokens-summary {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.tokens-summary-label {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
}

.tokens-summary-value {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
}

.tokens-cost {
  font-size: 13px;
  color: #16a34a;
  font-weight: 500;
}

.tokens-divider {
  width: 1px;
  height: 28px;
  background: #e2e8f0;
}

.tokens-chips {
  display: flex;
  gap: 12px;
  align-items: center;
}

.tokens-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  color: #64748b;
}

.tokens-chip-value {
  font-weight: 600;
  color: #334155;
}

.tokens-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.tokens-dot-in { background: #3b82f6; }
.tokens-dot-out { background: #8b5cf6; }
.tokens-dot-cache { background: #22c55e; }

.tokens-mini-chart {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 20px;
  margin-left: 4px;
}

.tokens-mini-bar-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.tokens-mini-bar {
  width: 4px;
  border-radius: 1px 1px 0 0;
}

.tokens-mini-bar.in { background: #3b82f6; }
.tokens-mini-bar.out { background: #8b5cf6; opacity: 0.5; }

.tokens-trend {
  font-size: 11px;
  margin-left: auto;
}

.tokens-trend.up { color: #16a34a; }
.tokens-trend.down { color: #dc2626; }
.tokens-trend.neutral { color: #94a3b8; }

.tokens-period {
  display: flex;
  gap: 2px;
  margin-left: 8px;
}

.tokens-period-btn {
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 11px;
  color: #94a3b8;
  cursor: pointer;
  background: transparent;
  border: none;
  transition: all 0.15s;
}

.tokens-period-btn.active {
  background: #e2e8f0;
  color: #475569;
  font-weight: 600;
}

.tokens-period-btn:hover:not(.active) {
  background: #f1f5f9;
}

.tokens-detail-btn,
.tokens-refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
}

.tokens-detail-btn:hover,
.tokens-refresh-btn:hover {
  background: #e2e8f0;
  color: #475569;
}

.tokens-detail-btn svg,
.tokens-refresh-btn svg {
  width: 14px;
  height: 14px;
}

.tokens-refresh-btn.refreshing .refresh-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.tokens-updated {
  font-size: 10px;
  color: #94a3b8;
  white-space: nowrap;
}

@media (max-width: 1024px) {
  .tokens-bar {
    flex-wrap: wrap;
    gap: 12px;
    padding: 12px 16px;
  }

  .tokens-mini-chart,
  .tokens-trend,
  .tokens-updated {
    display: none;
  }
}
</style>
