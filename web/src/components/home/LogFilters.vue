<template>
  <div class="log-filters">
    <span class="filter-label">LEVEL:</span>
    <button
      v-for="lvl in levels"
      :key="lvl.key"
      class="filter-tab"
      :class="[
        `filter-level-${lvl.key.toLowerCase()}`,
        { active: modelLevel === lvl.key }
      ]"
      @click="$emit('update:modelLevel', lvl.key)"
    >{{ lvl.label }}</button>
  </div>
</template>

<script setup lang="ts">
const levels = [
  { key: 'ALL', label: 'All' },
  { key: 'INFO', label: 'Info' },
  { key: 'WARN', label: 'Warn' },
  { key: 'ERROR', label: 'Error' },
] as const

defineProps<{
  modelLevel: string
}>()

defineEmits<{
  'update:modelLevel': [value: string]
}>()
</script>

<style scoped>
.log-filters {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: var(--color-bg-secondary, #f6f8fa);
  border-bottom: 1px solid var(--color-border);
  font-size: 12px;
}

.filter-label {
  font-weight: 600;
  color: var(--color-text-secondary, #656d76);
  margin-right: 6px;
}

.filter-tab {
  padding: 3px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm, 4px);
  background: transparent;
  color: var(--color-text-secondary, #656d76);
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  font-weight: 500;
  transition: all 0.15s;
}

.filter-tab:hover {
  background-color: var(--color-bg-tertiary, #f0f2f5);
}

.filter-tab.active {
  color: #fff;
  border-color: transparent;
}

.filter-tab.active.filter-level-all { background: #333; }
.filter-tab.active.filter-level-info { background: #0969da; }
.filter-tab.active.filter-level-warn { background: #bf8700; }
.filter-tab.active.filter-level-error { background: #cf222e; }
</style>
