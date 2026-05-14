import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue')
  },
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomePage.vue')
  },
  {
    path: '/chat',
    name: 'chat',
    component: () => import('@/views/DevChatView.vue')
  },
  {
    path: '/search',
    name: 'search',
    component: () => import('@/views/SearchResults.vue')
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue')
  },
  {
    path: '/project/:projectName',
    component: () => import('@/views/ProjectLayout.vue'),
    children: [
      {
        path: '',
        name: 'project',
        component: () => import('@/views/ProjectView.vue')
      },
      {
        path: 'dev',
        name: 'project-dev',
        component: () => import('@/views/DevChatView.vue')
      },
      {
        path: 'doc/:path(.*)',
        name: 'document',
        component: () => import('@/views/DocumentView.vue'),
        props: true
      }
    ]
  },
  {
    path: '/project/:projectName/source',
    name: 'source',
    component: () => import('@/views/SourceView.vue')
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/HomePage.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Auth guard: redirect to /login if sync mode and not authenticated
router.beforeEach((to, _from, next) => {
  if (to.name === 'login') {
    next()
    return
  }

  // Check if sync mode is enabled by trying to read a config flag
  // In sync mode, unauthenticated users must login first
  const token = localStorage.getItem('auth_token')
  const syncEnabled = localStorage.getItem('sync_enabled') === 'true'

  if (syncEnabled && !token && to.name !== 'login') {
    next({ name: 'login' })
  } else {
    next()
  }
})

export default router
