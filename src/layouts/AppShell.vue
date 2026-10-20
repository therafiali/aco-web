<script setup lang="ts">
import { BarChart3, FileText, Home, LogOut, Target, UserRound } from '@lucide/vue'
import { computed, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { session, signOut } from '@/lib/auth'
import { financeError, profile, refreshFinance } from '@/lib/finance'

const route = useRoute()
const router = useRouter()

const links = [
  { name: 'Home', to: '/', icon: Home },
  { name: 'Goals', to: '/goals', icon: Target },
  { name: 'Charts', to: '/charts', icon: BarChart3 },
  { name: 'Reports', to: '/reports', icon: FileText },
  { name: 'Profile', to: '/profile', icon: UserRound },
]

const email = computed(() => profile.value.email || session.value?.user.email || '')

watch(
  session,
  (value) => {
    if (value) void refreshFinance()
  },
  { immediate: true },
)

watch(financeError, (message) => {
  if (message) toast.error(message)
})

function active(path: string) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

async function logout() {
  try {
    await signOut()
    await router.push('/login')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not sign out.')
  }
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <div class="mx-auto flex min-h-screen w-full max-w-7xl">
      <aside class="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar p-4 print:hidden md:flex">
        <div class="px-2 pb-6">
          <p class="text-lg font-semibold tracking-[0.18em] text-primary">ACO</p>
          <p class="text-xs text-muted-foreground">Money, goals, reminders</p>
        </div>
        <nav class="flex flex-1 flex-col gap-1">
          <RouterLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            :class="active(link.to) ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''"
          >
            <component :is="link.icon" class="size-4" />
            {{ link.name }}
          </RouterLink>
        </nav>
        <div class="mt-4 space-y-3 border-t pt-4">
          <p class="truncate px-2 text-xs text-muted-foreground">{{ email }}</p>
          <Button variant="outline" class="w-full justify-start" @click="logout">
            <LogOut class="size-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div class="flex min-w-0 flex-1 flex-col">
        <header class="sticky top-0 z-20 border-b bg-background/95 backdrop-blur print:hidden md:hidden">
          <div class="flex gap-1 overflow-x-auto px-3 py-2">
            <RouterLink
              v-for="link in links"
              :key="link.to"
              :to="link.to"
              class="rounded-full px-3 py-1.5 text-sm whitespace-nowrap"
              :class="active(link.to) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'"
            >
              {{ link.name }}
            </RouterLink>
          </div>
        </header>
        <main class="flex-1 px-4 py-6 md:px-8">
          <RouterView />
        </main>
      </div>
    </div>
  </div>
</template>
