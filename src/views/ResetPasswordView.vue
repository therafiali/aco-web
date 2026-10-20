<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authReady, errorText, notice, recoveryActive, session, updatePassword } from '@/lib/auth'

const router = useRouter()
const password = ref('')
const confirm = ref('')
const saving = ref(false)
const linkError = ref<string | null>(null)
const localNotice = ref<{ title: string; body: string; tone: 'info' | 'error' } | null>(null)

const canUpdate = computed(() => authReady.value && (!!session.value || recoveryActive.value))

onMounted(() => {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
  const query = window.location.search.startsWith('?') ? window.location.search.slice(1) : ''
  const hashParams = new URLSearchParams(hash)
  const params =
    hashParams.get('error_description') || hashParams.get('access_token') || hashParams.get('code')
      ? hashParams
      : new URLSearchParams(query)
  const description = params.get('error_description')
  linkError.value = description ? description.replace(/\+/g, ' ') : null
})

async function handleUpdate() {
  if (password.value.length < 6) {
    localNotice.value = { title: 'Password too short', body: 'Use at least 6 characters.', tone: 'error' }
    return
  }
  if (password.value !== confirm.value) {
    localNotice.value = {
      title: 'Passwords do not match',
      body: 'Type the same password in both fields.',
      tone: 'error',
    }
    return
  }
  saving.value = true
  localNotice.value = null
  try {
    await updatePassword(password.value)
    recoveryActive.value = false
    notice.value = {
      title: 'Password updated',
      body: 'You are signed in with your new password.',
      tone: 'info',
    }
    await router.replace('/')
  } catch (error) {
    localNotice.value = {
      title: 'Could not update password',
      body: errorText(error, 'Try requesting a new reset email.'),
      tone: 'error',
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-background px-4 py-10">
    <Card class="w-full max-w-md">
      <CardHeader>
        <p class="text-sm font-semibold tracking-[0.18em] text-primary">ACO</p>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>Enter a new password for your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <p v-if="!authReady" class="text-sm text-muted-foreground">Checking your reset link...</p>
        <div v-else-if="!canUpdate" class="grid gap-4">
          <p class="text-sm text-muted-foreground">
            {{ linkError || 'This reset link is missing or expired. Request a new one from the sign-in screen.' }}
          </p>
          <Button type="button" @click="router.replace('/login')">Back to sign in</Button>
        </div>
        <form v-else class="grid gap-4" @submit.prevent="handleUpdate">
          <p
            v-if="localNotice"
            class="rounded-lg px-3 py-2 text-sm"
            :class="localNotice.tone === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-accent'"
          >
            <strong class="block">{{ localNotice.title }}</strong>
            {{ localNotice.body }}
          </p>
          <div class="grid gap-2">
            <Label for="password">New password</Label>
            <Input id="password" v-model="password" type="password" autocomplete="new-password" :disabled="saving" />
          </div>
          <div class="grid gap-2">
            <Label for="confirm">Confirm password</Label>
            <Input id="confirm" v-model="confirm" type="password" autocomplete="new-password" :disabled="saving" />
          </div>
          <Button type="submit" :disabled="saving">{{ saving ? 'Saving...' : 'Update password' }}</Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
