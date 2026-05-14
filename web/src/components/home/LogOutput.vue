<template>
  <div class="log-output" ref="scrollEl">
    <div v-if="loading && lines.length === 0" class="log-empty">Loading logs...</div>
    <div v-else-if="error" class="log-error">{{ error }}</div>
    <div v-else-if="lines.length === 0" class="log-empty">No log entries</div>
    <template v-else>
      <div
        v-for="(line, i) in lines"
        :key="i"
        class="log-line"
        :class="`level-${line.level.toLowerCase()}`"
      >{{ line.raw }}</div>
    </template>
    <div v-if="loading && lines.length > 0" class="log-loading-spinner">Refreshing...</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

interface ParsedLogLine {
  timestamp: string
  level: string
  prefix: string
  message: string
  raw: string
}

const props = defineProps<{
  lines: ParsedLogLine[]
  loading: boolean
  error: string | null
}>()

const scrollEl = ref<HTMLElement | null>(null)
let userScrolledUp = false

function isAtBottom(): boolean {
  const el = scrollEl.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < 30
}

function onScroll() {
  userScrolledUp = !isAtBottom()
}

watch(() => props.lines.length, async () => {
  await nextTick()
  if (!userScrolledUp && scrollEl.value) {
    scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  }
})

watch(scrollEl, (el, oldEl) => {
  if (oldEl) oldEl.removeEventListener('scroll', onScroll)
  if (el) el.addEventListener('scroll', onScroll)
})
</script>

<style scoped>
.log-output {
  flex: 1;
  overflow-y: auto;
  background: #1e1e1e;
  font-family: var(--font-family-mono, ui-monospace, monospace);
  font-size: 12px;
  line-height: 1.6;
  padding: 12px 16px;
  white-space: pre-wrap;
  word-break: break-all;
}

.log-line {
  color: #d4d4d4;
}

.log-line.level-info { color: #58a6ff; }
.log-line.level-warn { color: #d29922; }
.log-line.level-error { color: #f85149; }
.log-line.level-debug { color: #8b949e; }

.log-empty,
.log-loading-spinner {
  color: #6e7681;
  padding: 20px;
  text-align: center;
}

.log-error {
  color: #f14c4c;
  padding: 20px;
  text-align: center;
}
</style>
