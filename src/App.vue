<script setup lang="ts">
import { watch } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { Toaster } from '@/components/ui/sonner'
import { recoveryActive } from '@/lib/auth'

const router = useRouter()

watch(
  recoveryActive,
  (active) => {
    if (active && router.currentRoute.value.path !== '/reset-password') {
      void router.push('/reset-password')
    }
  },
  { immediate: true },
)
</script>

<template>
  <RouterView />
  <Toaster />
</template>
