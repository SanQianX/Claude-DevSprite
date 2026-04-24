import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUIStore = defineStore('ui', () => {
  const sidebarOpen = ref(true)
  const tocPanelOpen = ref(true)
  const theme = ref<'light' | 'dark'>('light')

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function setSidebarOpen(value: boolean) {
    sidebarOpen.value = value
  }

  function toggleTocPanel() {
    tocPanelOpen.value = !tocPanelOpen.value
  }

  function setTocPanelOpen(value: boolean) {
    tocPanelOpen.value = value
  }

  function setTheme(newTheme: 'light' | 'dark') {
    theme.value = newTheme
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  return {
    sidebarOpen,
    tocPanelOpen,
    theme,
    toggleSidebar,
    setSidebarOpen,
    toggleTocPanel,
    setTocPanelOpen,
    setTheme
  }
})
