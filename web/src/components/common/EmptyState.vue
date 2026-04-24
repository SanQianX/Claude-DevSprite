<template>
  <div class="empty-state" :class="`empty-state--${size}`">
    <div class="empty-state-icon">📭</div>
    <h3 class="empty-state-title">{{ title }}</h3>
    <p v-if="description" class="empty-state-description">{{ description }}</p>

    <slot v-if="$slots.default" />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  size?: 'small' | 'medium' | 'large'
}>()
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px;
}

.empty-state--small {
  padding: 16px;
}

.empty-state--large {
  padding: 64px;
}

.empty-state-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state--small .empty-state-icon {
  font-size: 32px;
}

.empty-state--large .empty-state-icon {
  font-size: 64px;
}

.empty-state-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--color-text);
}

.empty-state-description {
  font-size: 14px;
  margin: 0;
  color: var(--color-text-secondary);
  max-width: 400px;
}
</style>
