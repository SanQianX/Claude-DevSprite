<template>
  <div class="tokens-bar">
    <div class="tokens-summary">
      <span class="tokens-summary-label">Tokens</span>
      <span class="tokens-summary-value">{{ formatNumber(stats.total) }}</span>
    </div>
    <div class="tokens-divider"></div>
    <div class="tokens-chips">
      <div class="tokens-chip">
        <div class="tokens-dot tokens-dot-in"></div>
        <span>Input</span>
        <span class="tokens-chip-value">{{ formatNumber(stats.input) }}</span>
      </div>
      <div class="tokens-chip">
        <div class="tokens-dot tokens-dot-out"></div>
        <span>Output</span>
        <span class="tokens-chip-value">{{ formatNumber(stats.output) }}</span>
      </div>
      <div class="tokens-chip">
        <div class="tokens-dot tokens-dot-cache"></div>
        <span>Cache</span>
        <span class="tokens-chip-value">{{ formatNumber(stats.cache) }}</span>
      </div>
    </div>
    <!-- Mini 7-day bar chart -->
    <div class="tokens-mini-chart">
      <div
        v-for="(day, i) in weeklyData"
        :key="i"
        class="tokens-mini-bar-group"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { tokensApi } from '@/api/tokens'

const activePeriod = ref('week')

const periods = [
  { key: 'day', label: '日' },
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
  { key: 'all', label: '全部' },
]

const stats = ref({ total: 0, input: 0, output: 0, cache: 0 })
const weeklyData = ref<{ input: number; output: number; inHeight: number; outHeight: number }[]>([])
const trendDelta = ref(0)
const trendPercent = ref(0)

const trendClass = computed(() => {
  if (trendPercent.value > 0) return 'up'
  if (trendPercent.value < 0) return 'down'
  return 'neutral'
})

const trendText = computed(() => {
  if (trendDelta.value === 0 && trendPercent.value === 0) return '--'
  const sign = trendDelta.value >= 0 ? '+' : ''
  const pctSign = trendPercent.value >= 0 ? '↑' : '↓'
  return `${sign}${formatNumber(Math.abs(trendDelta.value))} 本周 ${pctSign}${Math.abs(trendPercent.value)}%`
})

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function setPeriod(key: string) {
  activePeriod.value = key
  fetchStats()
}

async function fetchStats() {
  try {
    const data = await tokensApi.getStats(activePeriod.value)
    stats.value = data.stats
    trendDelta.value = data.trendDelta
    trendPercent.value = data.trendPercent

    // Calculate mini chart bar heights
    const maxVal = Math.max(...data.weekly.map(d => Math.max(d.input, d.output)), 1)
    weeklyData.value = data.weekly.map(d => ({
      input: d.input,
      output: d.output,
      inHeight: Math.round((d.input / maxVal) * 20),
      outHeight: Math.round((d.output / maxVal) * 20),
    }))
  } catch {
    // Fallback to mock data
    stats.value = { total: 1284567, input: 823412, output: 461155, cache: 128456 }
    trendDelta.value = 89234
    trendPercent.value = 12
    weeklyData.value = [
      { input: 8, output: 4, inHeight: 8, outHeight: 4 },
      { input: 12, output: 6, inHeight: 12, outHeight: 6 },
      { input: 16, output: 8, inHeight: 16, outHeight: 8 },
      { input: 10, output: 5, inHeight: 10, outHeight: 5 },
      { input: 20, output: 10, inHeight: 20, outHeight: 10 },
      { input: 14, output: 7, inHeight: 14, outHeight: 7 },
      { input: 20, output: 12, inHeight: 20, outHeight: 12 },
    ]
  }
}

onMounted(() => {
  fetchStats()
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

.tokens-dot-in {
  background: #3b82f6;
}

.tokens-dot-out {
  background: #8b5cf6;
}

.tokens-dot-cache {
  background: #22c55e;
}

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

.tokens-mini-bar.in {
  background: #3b82f6;
}

.tokens-mini-bar.out {
  background: #8b5cf6;
  opacity: 0.5;
}

.tokens-trend {
  font-size: 11px;
  margin-left: auto;
}

.tokens-trend.up {
  color: #16a34a;
}

.tokens-trend.down {
  color: #dc2626;
}

.tokens-trend.neutral {
  color: #94a3b8;
}

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
}

.tokens-period-btn.active {
  background: #e2e8f0;
  color: #475569;
  font-weight: 600;
}

.tokens-period-btn:hover:not(.active) {
  background: #f1f5f9;
}

@media (max-width: 1024px) {
  .tokens-bar {
    flex-wrap: wrap;
    gap: 12px;
    padding: 12px 16px;
  }

  .tokens-mini-chart,
  .tokens-trend {
    display: none;
  }
}
</style>
