<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorText, notice, sendPasswordReset, signIn, signUp } from '@/lib/auth'

const router = useRouter()
type AuthMode = 'login' | 'signup' | 'forgot'
const mode = ref<AuthMode>('login')
const email = ref('')
const password = ref('')
const name = ref('')
const busy = ref(false)
const message = ref<{ title: string; body: string; tone: 'info' | 'error' } | null>(null)

async function submit() {
  message.value = null
  if (mode.value === 'forgot') {
    if (!email.value.trim()) {
      message.value = { title: 'Email required', body: 'Enter the email you use to sign in.', tone: 'error' }
      return
    }
    busy.value = true
    try {
      await sendPasswordReset(email.value)
      message.value = { title: 'Check your email', body: 'We sent a link to reset your password.', tone: 'info' }
      mode.value = 'login'
      password.value = ''
    } catch (error) {
      message.value = { title: 'Reset failed', body: errorText(error, 'Could not send the reset email.'), tone: 'error' }
    } finally {
      busy.value = false
    }
    return
  }

  if (!email.value.trim() || !password.value.trim()) {
    message.value = { title: 'Error', body: 'Email and password are required.', tone: 'error' }
    return
  }

  busy.value = true
  try {
    if (mode.value === 'login') {
      await signIn(email.value, password.value)
      notice.value = null
      await router.replace('/')
      return
    }
    await signUp(email.value, password.value, name.value.trim())
    message.value = { title: 'Check email', body: 'A confirmation link was sent to your email.', tone: 'info' }
    mode.value = 'login'
    password.value = ''
  } catch (error) {
    message.value = { title: 'Auth Error', body: errorText(error, 'Something went wrong.'), tone: 'error' }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-background px-4 py-10">
    <Card class="w-full max-w-md">
      <CardHeader>
        <p class="text-sm font-semibold tracking-[0.18em] text-primary">ACO</p>
        <CardTitle>{{ mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Reset password' }}</CardTitle>
        <CardDescription>
          {{
            mode === 'forgot'
              ? 'Enter your account email and we will send a link to choose a new password.'
              : 'Use the same email and password as the phone app.'
          }}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form class="grid gap-4" @submit.prevent="submit">
          <p
            v-if="message"
            class="rounded-lg px-3 py-2 text-sm"
            :class="message.tone === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-accent text-accent-foreground'"
          >
            <strong class="block">{{ message.title }}</strong>
            {{ message.body }}
          </p>
          <div v-if="mode === 'signup'" class="grid gap-2">
            <Label for="name">Name</Label>
            <Input id="name" v-model="name" autocomplete="name" placeholder="Your name" :disabled="busy" />
          </div>
          <div class="grid gap-2">
            <Label for="email">Email</Label>
            <Input id="email" v-model="email" type="email" autocomplete="email" placeholder="Email" :disabled="busy" />
          </div>
          <div v-if="mode !== 'forgot'" class="grid gap-2">
            <Label for="password">Password</Label>
            <Input
              id="password"
              v-model="password"
              type="password"
              :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'"
              placeholder="Password"
              :disabled="busy"
            />
          </div>
          <Button v-if="mode === 'login'" variant="link" class="h-auto justify-start px-0" type="button" @click="mode = 'forgot'">
            Forgot password?
          </Button>
          <Button type="submit" :disabled="busy">
            {{ busy ? 'Working...' : mode === 'login' ? 'Login' : mode === 'signup' ? 'Sign up' : 'Send reset link' }}
          </Button>
          <Button
            variant="ghost"
            type="button"
            :disabled="busy"
            @click="mode = mode === 'login' ? 'signup' : 'login'"
          >
            {{ mode === 'login' ? 'Need an account? Sign up' : mode === 'signup' ? 'Already have an account? Login' : 'Back to login' }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
