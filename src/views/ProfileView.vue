<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { sendPasswordReset, session, signOut } from '@/lib/auth'
import { profile, updateProfileRecord } from '@/lib/finance'
import { CURRENCIES } from '@/lib/types'

const router = useRouter()
const name = ref('')
const currency = ref('USD')
const saving = ref(false)
const resetting = ref(false)

watch(
  profile,
  (value) => {
    name.value = value.name
    currency.value = value.currency || 'USD'
  },
  { immediate: true },
)

async function save() {
  if (!name.value.trim()) {
    toast.error('Name required. Please enter your name.')
    return
  }
  saving.value = true
  try {
    await updateProfileRecord({
      name: name.value,
      currency: currency.value,
      email: profile.value.email,
    })
    toast.success('Profile updated.')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not save your profile.')
  } finally {
    saving.value = false
  }
}

async function reset() {
  const email = session.value?.user.email
  if (!email) return
  resetting.value = true
  try {
    await sendPasswordReset(email)
    toast.success('We sent a link to reset your password.')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not send the reset email.')
  } finally {
    resetting.value = false
  }
}

async function logout() {
  if (!window.confirm('Sign out of this account?')) return
  await signOut()
  await router.push('/login')
}
</script>

<template>
  <div class="mx-auto max-w-xl space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Profile</h1>
      <p class="text-sm text-muted-foreground">This profile is stored in Supabase and shared with the phone app.</p>
    </div>
    <Card>
      <CardHeader>
        <CardTitle>{{ profile.email || 'Account' }}</CardTitle>
        <CardDescription>Name and currency are used across your transactions.</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="grid gap-4" @submit.prevent="save">
          <div class="grid gap-2">
            <Label for="name">Name</Label>
            <Input id="name" v-model="name" autocomplete="name" />
          </div>
          <div class="grid gap-2">
            <Label>Currency</Label>
            <Select v-model="currency">
              <SelectTrigger class="w-full"><SelectValue placeholder="Currency" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="item in CURRENCIES" :key="item.code" :value="item.code">
                  {{ item.code }} · {{ item.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" :disabled="saving">{{ saving ? 'Saving...' : 'Save' }}</Button>
        </form>
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Password reset uses the same email link as the phone app.</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-wrap gap-2">
        <Button variant="outline" :disabled="resetting" @click="reset">Send reset link</Button>
        <Button variant="destructive" @click="logout">Sign out</Button>
      </CardContent>
    </Card>
  </div>
</template>
