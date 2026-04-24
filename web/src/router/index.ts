import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomePage.vue')
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
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
