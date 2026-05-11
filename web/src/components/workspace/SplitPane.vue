<template>
  <div class="split-pane" ref="containerRef">
    <div class="split-pane-left" :style="{ width: leftWidth + 'px' }">
      <slot name="left" />
    </div>
    <div
      class="split-pane-divider"
      @mousedown="startResize"
    >
      <div class="divider-handle"></div>
    </div>
    <div class="split-pane-right">
      <slot name="right" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'

const props = defineProps<{
  initialLeft?: number
  minLeft?: number
  maxLeft?: number
}>()

const emit = defineEmits<{
  resize: [leftWidth: number]
}>()

const containerRef = ref<HTMLElement | null>(null)
const leftWidth = ref(props.initialLeft ?? 400)
const minLeft = props.minLeft ?? 250
const maxLeft = props.maxLeft ?? 1200

let startX = 0
let startWidth = 0

function startResize(e: MouseEvent) {
  e.preventDefault()
  startX = e.clientX
  startWidth = leftWidth.value
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

function onResize(e: MouseEvent) {
  const delta = e.clientX - startX
  const maxWidth = Math.min(maxLeft, window.innerWidth - 300)
  leftWidth.value = Math.min(maxWidth, Math.max(minLeft, startWidth + delta))
  emit('resize', leftWidth.value)
}

function stopResize() {
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}

onBeforeUnmount(() => {
  stopResize()
})
</script>

<style scoped>
.split-pane {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.split-pane-left {
  display: flex;
  flex-direction: column;
  min-width: 250px;
  overflow: hidden;
}

.split-pane-divider {
  width: 4px;
  background: #e2e8f0;
  cursor: col-resize;
  flex-shrink: 0;
  transition: background 150ms;
  display: flex;
  align-items: center;
  justify-content: center;
}

.split-pane-divider:hover {
  background: #3b82f6;
}

.divider-handle {
  width: 2px;
  height: 24px;
  background: #94a3b8;
  border-radius: 1px;
}

.split-pane-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 250px;
  overflow: hidden;
}
</style>
