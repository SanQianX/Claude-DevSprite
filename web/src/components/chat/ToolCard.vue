<!--
  @brief Displays a tool call card with name, arguments, result and status
  @props toolCall - Tool call information object
  @emits none - read-only display component
-->
<template>
  <div class="tool-card" :class="[`status-${toolCall.status}`]">
    <div class="tool-header" @click="expanded = !expanded">
      <div class="tool-info">
        <span class="tool-icon">
          <span v-if="toolCall.status === 'executing'" class="spinner"></span>
          <span v-else-if="toolCall.status === 'completed'">&#x2705;</span>
          <span v-else-if="toolCall.status === 'failed'">&#x274C;</span>
          <span v-else>&#x1F527;</span>
        </span>
        <span class="tool-name">{{ toolCall.toolName }}</span>
        <span v-if="toolCall.team" class="tool-team">{{ teamLabel }}</span>
      </div>
      <div class="tool-toggle">
        <span class="toggle-icon" :class="{ rotated: expanded }">&#x25B6;</span>
      </div>
    </div>

    <div v-if="expanded" class="tool-body">
      <div v-if="toolCall.toolArgs && Object.keys(toolCall.toolArgs).length > 0" class="tool-section">
        <div class="section-label">Arguments</div>
        <pre class="tool-args">{{ formattedArgs }}</pre>
      </div>

      <div v-if="toolCall.toolResult" class="tool-section">
        <div class="section-label">Result</div>
        <pre class="tool-result">{{ toolCall.toolResult }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ToolCallInfo } from '../../types/session';

const props = defineProps<{
  toolCall: ToolCallInfo;
}>();

const expanded = ref(false);

const teamLabel = computed(() => {
  const labels: Record<string, string> = {
    lead: 'Lead',
    dev: 'Dev',
    test: 'Test',
  };
  return labels[props.toolCall.team] || props.toolCall.team;
});

const formattedArgs = computed(() => {
  if (!props.toolCall.toolArgs) return '';
  try {
    return JSON.stringify(props.toolCall.toolArgs, null, 2);
  } catch {
    return String(props.toolCall.toolArgs);
  }
});
</script>

<style scoped>
.tool-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin: 8px 0;
  overflow: hidden;
  font-size: 13px;
  transition: border-color 0.2s;
}

.tool-card.status-pending {
  border-color: #ffc107;
}

.tool-card.status-executing {
  border-color: #2196f3;
}

.tool-card.status-completed {
  border-color: #4caf50;
}

.tool-card.status-failed {
  border-color: #f44336;
}

.tool-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f8f9fa;
  cursor: pointer;
  user-select: none;
}

.tool-header:hover {
  background: #e9ecef;
}

.tool-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-icon {
  font-size: 14px;
  display: flex;
  align-items: center;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid #2196f3;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.tool-name {
  font-weight: 600;
  font-family: 'Consolas', 'Monaco', monospace;
  color: #333;
}

.tool-team {
  font-size: 11px;
  padding: 1px 6px;
  background: #e3f2fd;
  color: #1976d2;
  border-radius: 4px;
}

.tool-toggle {
  display: flex;
  align-items: center;
}

.toggle-icon {
  font-size: 10px;
  color: #666;
  transition: transform 0.2s;
}

.toggle-icon.rotated {
  transform: rotate(90deg);
}

.tool-body {
  border-top: 1px solid #e0e0e0;
  padding: 8px 12px;
}

.tool-section {
  margin-bottom: 8px;
}

.tool-section:last-child {
  margin-bottom: 0;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.tool-args,
.tool-result {
  margin: 0;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.4;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}

.tool-result {
  background: #f0fff0;
}
</style>
