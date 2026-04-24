<template>
  <div class="loading-spinner" :class="`loading-spinner--${size}`">
    <div class="spinner"></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  size?: 'small' | 'medium' | 'large'
}>()
</script>

<style scoped>
.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-spinner--small .spinner {
  width: 20px;
  height: 20px;
  border-width: 2px;
}

.loading-spinner--medium .spinner {
  width: 32px;
  height: 32px;
  border-width: 3px;
}

.loading-spinner--large .spinner {
  width: 48px;
  height: 48px;
  border-width: 4px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
