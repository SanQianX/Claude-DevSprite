<template>
  <aside class="app-toc-panel">
    <div class="toc-header">
      <h2 class="toc-title">Contents</h2>
      <button class="close-button" @click="toggleTocPanel" aria-label="Close TOC">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
        </svg>
      </button>
    </div>

    <nav class="toc-nav">
      <a
        v-for="item in toc"
        :key="item.id"
        :href="`#${item.id}`"
        class="toc-link"
        :class="`toc-link--level-${item.level}`"
        @click.prevent="scrollToHeading(item.id)"
      >
        {{ item.text }}
      </a>

      <div v-if="toc.length === 0" class="toc-empty">
        <p class="toc-empty-text">No headings found</p>
      </div>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { useKnowledgeStore } from '@/stores/knowledge'
import { useUIStore } from '@/stores/ui'
import type { TocItem } from '@/types'

const knowledgeStore = useKnowledgeStore()
const uiStore = useUIStore()
const { toc } = knowledgeStore

function toggleTocPanel() {
  uiStore.toggleTocPanel()
}

function scrollToHeading(id: string) {
  const element = document.getElementById(id)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<style scoped>
.app-toc-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--color-bg);
}

.toc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.toc-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: var(--color-text);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.close-button:hover {
  background-color: var(--color-bg-secondary);
  color: var(--color-text);
}

.toc-nav {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.toc-link {
  display: block;
  padding: 4px 0;
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: 14px;
  line-height: 1.4;
  transition: color var(--transition-fast);
  border-left: 2px solid transparent;
  padding-left: 0;
}

.toc-link:hover {
  color: var(--color-primary);
}

.toc-link--level-1 {
  font-weight: 600;
  margin-top: 8px;
}

.toc-link--level-2 {
  padding-left: 12px;
}

.toc-link--level-3 {
  padding-left: 24px;
}

.toc-link--level-4 {
  padding-left: 36px;
}

.toc-link--level-5 {
  padding-left: 48px;
}

.toc-link--level-6 {
  padding-left: 60px;
}

.toc-empty {
  padding: 32px 16px;
  text-align: center;
}

.toc-empty-text {
  color: var(--color-text-muted);
  font-size: 14px;
  margin: 0;
}
</style>
