<template>
  <div class="source-viewer">
    <div class="source-header">
      <div class="source-path">{{ data.path }}</div>
      <div class="source-language">{{ data.language }}</div>
    </div>

    <div class="source-content">
      <pre><code v-html="highlightedCode"></code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import hljs from 'highlight.js'
import type { SourceCodeData } from '@/types'

const props = defineProps<{
  data: SourceCodeData
}>()

const highlightedCode = computed(() => {
  try {
    const language = hljs.getLanguage(props.data.language)
      ? props.data.language
      : 'plaintext'
    return hljs.highlight(props.data.content, { language }).value
  } catch {
    return hljs.highlightAuto(props.data.content).value
  }
})
</script>

<style scoped>
.source-viewer {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.source-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
}

.source-path {
  font-family: var(--font-family-mono);
  font-size: 13px;
  color: var(--color-text-secondary);
}

.source-language {
  font-size: 12px;
  color: var(--color-primary);
  background-color: rgba(59, 130, 246, 0.1);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-weight: 500;
  text-transform: uppercase;
}

.source-content {
  max-height: 500px;
  overflow: auto;
  background-color: var(--color-bg);
}

.source-content pre {
  margin: 0;
  padding: 16px;
  font-size: 13px;
  line-height: 1.6;
  font-family: var(--font-family-mono);
}

.source-content code {
  font-family: inherit;
  background: transparent;
  padding: 0;
}
</style>
