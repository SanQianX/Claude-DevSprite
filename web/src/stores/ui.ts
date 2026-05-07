import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createI18n, type LocaleKey, type I18nInstance } from '@/i18n'

export const useUIStore = defineStore('ui', () => {
  const sidebarOpen = ref(true)
  const tocPanelOpen = ref(true)
  const theme = ref<'light' | 'dark'>('light')
  const locale = ref<LocaleKey>('zh-CN')
  const i18n = ref<I18nInstance>(createI18n(locale.value))

  const t = computed(() => i18n.value.t.bind(i18n.value))

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

  function setLocale(newLocale: LocaleKey) {
    locale.value = newLocale
    i18n.value = createI18n(newLocale)
  }

  function toggleLocale() {
    setLocale(locale.value === 'en' ? 'zh-CN' : 'en')
  }

  return {
    sidebarOpen,
    tocPanelOpen,
    theme,
    locale,
    t,
    toggleSidebar,
    setSidebarOpen,
    toggleTocPanel,
    setTocPanelOpen,
    setTheme,
    setLocale,
    toggleLocale
  }
})
