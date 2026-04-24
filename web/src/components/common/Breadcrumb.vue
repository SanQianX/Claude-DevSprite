<template>
  <nav class="breadcrumb">
    <ol class="breadcrumb-list">
      <li v-for="(item, index) in items" :key="index" class="breadcrumb-item">
        <router-link
          v-if="item.to"
          :to="item.to"
          class="breadcrumb-link"
        >
          {{ item.label }}
        </router-link>
        <span v-else class="breadcrumb-text">{{ item.label }}</span>

        <span
          v-if="index < items.length - 1"
          class="breadcrumb-separator"
        >/</span>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
interface BreadcrumbItem {
  label: string
  to?: string
}

defineProps<{
  items: BreadcrumbItem[]
}>()
</script>

<style scoped>
.breadcrumb {
  margin-bottom: 16px;
}

.breadcrumb-list {
  display: flex;
  align-items: center;
  list-style: none;
  margin: 0;
  padding: 0;
  flex-wrap: wrap;
  gap: 4px;
}

.breadcrumb-item {
  display: flex;
  align-items: center;
}

.breadcrumb-link {
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: 14px;
  transition: color var(--transition-fast);
}

.breadcrumb-link:hover {
  color: var(--color-primary);
}

.breadcrumb-text {
  color: var(--color-text);
  font-size: 14px;
  font-weight: 500;
}

.breadcrumb-separator {
  margin: 0 8px;
  color: var(--color-text-muted);
  font-size: 12px;
}
</style>
