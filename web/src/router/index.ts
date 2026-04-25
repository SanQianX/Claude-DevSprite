import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomePage.vue')
  },
  {
    path: '/search',
    name: 'search',
    component: () => import('@/views/SearchResults.vue')
  },
  {
    path: '/logs',
    name: 'logs',
    component: () => import('@/views/LogsView.vue')
  },
  {
    path: '/project/:projectName',
    component: () => import('@/views/ProjectLayout.vue'),
    children: [
      {
        path: '',
        name: 'project-overview',
        component: () => import('@/views/ProjectOverview.vue')
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

export default router
