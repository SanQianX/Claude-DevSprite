<template>
  <div class="markdown-viewer" v-html="renderedContent"></div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'

const props = defineProps<{
  content: string
}>()

onMounted(() => {
  marked.setOptions({
    highlight: (code: string, lang: string) => {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value
      }
      return hljs.highlightAuto(code).value
    },
    breaks: true,
    gfm: true
  })
})

const renderedContent = computed(() => {
  if (!props.content) return ''
  return marked.parse(props.content) as string
})

watch(
  () => props.content,
  () => {
    if (props.content) {
      marked.setOptions({
        highlight: (code: string, lang: string) => {
          if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value
          }
          return hljs.highlightAuto(code).value
        },
        breaks: true,
        gfm: true
      })
    }
  }
)
</script>

<style>
.markdown-viewer {
  color: var(--color-text);
  font-size: 16px;
  line-height: 1.8;
}

.markdown-viewer h1,
.markdown-viewer h2,
.markdown-viewer h3,
.markdown-viewer h4,
.markdown-viewer h5,
.markdown-viewer h6 {
  font-weight: 600;
  margin-top: 24px;
  margin-bottom: 16px;
  line-height: 1.3;
}

.markdown-viewer h1 {
  font-size: 32px;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 8px;
}

.markdown-viewer h2 {
  font-size: 24px;
}

.markdown-viewer h3 {
  font-size: 20px;
}

.markdown-viewer h4 {
  font-size: 18px;
}

.markdown-viewer h5,
.markdown-viewer h6 {
  font-size: 16px;
}

.markdown-viewer p {
  margin: 0 0 16px;
}

.markdown-viewer a {
  color: var(--color-primary);
  text-decoration: none;
}

.markdown-viewer a:hover {
  text-decoration: underline;
}

.markdown-viewer ul,
.markdown-viewer ol {
  margin: 0 0 16px 24px;
}

.markdown-viewer li {
  margin: 4px 0;
}

.markdown-viewer ul li {
  list-style-type: disc;
}

.markdown-viewer ol li {
  list-style-type: decimal;
}

.markdown-viewer blockquote {
  margin: 0 0 16px;
  padding: 8px 16px;
  border-left: 4px solid var(--color-border);
  color: var(--color-text-secondary);
  background-color: var(--color-bg-secondary);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
}

.markdown-viewer code {
  font-family: var(--font-family-mono);
  font-size: 14px;
  background-color: var(--color-bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
}

.markdown-viewer pre {
  margin: 0 0 16px;
  padding: 16px;
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow-x: auto;
}

.markdown-viewer pre code {
  background-color: transparent;
  padding: 0;
  border-radius: 0;
  font-size: 13px;
  line-height: 1.6;
}

.markdown-viewer table {
  width: 100%;
  margin: 0 0 16px;
  border-collapse: collapse;
}

.markdown-viewer th,
.markdown-viewer td {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  text-align: left;
}

.markdown-viewer th {
  background-color: var(--color-bg-secondary);
  font-weight: 600;
}

.markdown-viewer img {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-md);
  margin: 8px 0;
}

.markdown-viewer hr {
  margin: 24px 0;
  border: none;
  border-top: 1px solid var(--color-border);
}
</style>
