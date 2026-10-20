import { watch } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { authReady, session } from '@/lib/auth'
import AppShell from '@/layouts/AppShell.vue'
import ChartsView from '@/views/ChartsView.vue'
import GoalsView from '@/views/GoalsView.vue'
import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import ProfileView from '@/views/ProfileView.vue'
import ReportsView from '@/views/ReportsView.vue'
import ResetPasswordView from '@/views/ResetPasswordView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/reset-password', name: 'reset-password', component: ResetPasswordView },
    {
      path: '/',
      component: AppShell,
      children: [
        { path: '', name: 'home', component: HomeView },
        { path: 'goals', name: 'goals', component: GoalsView },
        { path: 'charts', name: 'charts', component: ChartsView },
        { path: 'reports', name: 'reports', component: ReportsView },
        { path: 'profile', name: 'profile', component: ProfileView },
      ],
    },
  ],
})

const publicRoutes = new Set(['login', 'reset-password'])

router.beforeEach(async (to) => {
  if (!authReady.value) {
    await new Promise<void>((resolve) => {
      const stop = watch(
        authReady,
        (ready) => {
          if (!ready) return
          stop()
          resolve()
        },
        { immediate: true },
      )
    })
  }

  const name = String(to.name ?? '')
  if (!session.value && !publicRoutes.has(name)) return { name: 'login' }
  if (session.value && name === 'login') return { name: 'home' }
})

export default router
