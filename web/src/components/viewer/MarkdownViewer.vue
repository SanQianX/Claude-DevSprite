<template>
  <div class="markdown-viewer" v-html="renderedContent" ref="viewerRef" @click="handleClick"></div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick, watch } from 'vue'
import { Marked, Renderer } from 'marked'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import DOMPurify from 'dompurify'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('css', css)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('sql', sql)

const props = defineProps<{
  content: string
}>()

const emit = defineEmits<{
  linkClick: [href: string, event: MouseEvent]
}>()

const viewerRef = ref<HTMLElement | null>(null)

// Custom renderer to add IDs to headings
const renderer = new Renderer()

renderer.heading = function (text: string, depth: string | number) {
  const level = typeof depth === 'string' ? parseInt(depth, 10) : depth
  const slug = text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const id = `heading-${slug}-${level}`
  return `<h${level} id="${id}">${text}</h${level}>\n`
}

// Create a marked instance for this component (better performance and isolation)
const markedInstance = new Marked({
  renderer,
  gfm: true,
  breaks: true,
  async: false,
  highlight: (code, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return hljs.highlightAuto(code).value
  }
})

const renderedContent = computed(() => {
  if (!props.content) return ''
  const html = markedInstance.parse(props.content) as string
  // Sanitize HTML to prevent XSS attacks from malicious markdown content
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'span', 'strong', 'em', 'del', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'br', 'sup', 'sub', 'dd', 'dt', 'dl'],
    ALLOWED_ATTR: ['id', 'href', 'title', 'src', 'alt', 'class', 'target', 'rel'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
  })
})

// Watch for content changes to emit TOC data
watch(renderedContent, () => {
  nextTick(() => {
    if (viewerRef.value) {
      emitTocFromRendered()
    }
  })
})

function emitTocFromRendered() {
  // This is handled by the parent via the knowledge store
  // The headings now have IDs matching the slug pattern
}

function handleClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  const anchor = target.closest('a') as HTMLAnchorElement | null
  if (!anchor) return

  const href = anchor.getAttribute('href')
  if (!href) return

  // Hash links (internal page anchors)
  if (href.startsWith('#')) {
    event.preventDefault()
    const id = href.slice(1)
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    return
  }

  // Internal project links
  if (href.startsWith('/project/') || href.startsWith('project-overview/') || href.startsWith('../')) {
    event.preventDefault()
    emit('linkClick', href, event)
    return
  }

  // Relative markdown links (e.g., [text](other-doc.md))
  if (href.endsWith('.md') || href.includes('.md#') || href.includes('.md?')) {
    event.preventDefault()
    emit('linkClick', href, event)
    return
  }

  // External links - open in new tab
  if (href.startsWith('http://') || href.startsWith('https://')) {
    event.preventDefault()
    window.open(href, '_blank', 'noopener,noreferrer')
    return
  }
}

// Expose the viewer element for parent access
defineExpose({ viewerRef })
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
  scroll-margin-top: 70px;
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
