import { computed } from 'vue'
import { useRoute } from 'vue-router'

export interface BreadcrumbItem {
  label: string
  to?: string
}

export function useBreadcrumb() {
  const route = useRoute()

  const breadcrumbItems = computed(() => {
    const items: BreadcrumbItem[] = []

    // Add home
    items.push({ label: 'Home', to: '/' })

    // Add project if exists
    const projectName = route.params.projectName as string
    if (projectName) {
      items.push({ label: projectName, to: `/project/${projectName}` })
    }

    // Add path segments if exists
    const path = (route.params.path as string) || ''
    if (path) {
      const parts = path.split('/').filter(Boolean)
      const basePath = `/project/${projectName}/doc`

      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1
        const to = isLast ? undefined : `${basePath}/${parts.slice(0, index + 1).join('/')}`
        items.push({ label: part, to })
      })
    }

    return items
  })

  return {
    breadcrumbItems
  }
}
