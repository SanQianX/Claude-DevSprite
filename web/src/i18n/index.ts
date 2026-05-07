import en from './locales/en'
import zhCN from './locales/zh-CN'

export type LocaleKey = 'en' | 'zh-CN'
export type Messages = typeof en

const messages: Record<LocaleKey, Messages> = {
  en,
  'zh-CN': zhCN,
}

/**
 * Resolve a nested key like 'home.title' from the messages object
 */
function resolve(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key]
    } else {
      return path
    }
  }
  return typeof current === 'string' ? current : path
}

export function createI18n(locale: LocaleKey = 'en') {
  return {
    locale,
    messages,
    t(key: string, params?: Record<string, string | number>): string {
      let text = resolve(messages[locale] as unknown as Record<string, unknown>, key)
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        }
      }
      return text
    },
    setLocale(newLocale: LocaleKey) {
      locale = newLocale
    },
    availableLocales: Object.keys(messages) as LocaleKey[],
  }
}

export type I18nInstance = ReturnType<typeof createI18n>
