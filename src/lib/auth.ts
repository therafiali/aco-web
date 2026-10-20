import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export const session = ref<Session | null>(null)
export const authReady = ref(false)
export const recoveryActive = ref(false)

export interface AuthNotice {
  title: string
  body: string
  tone: 'info' | 'error'
}

export const notice = ref<AuthNotice | null>(null)

function applySession(next: Session | null) {
  session.value = next
  authReady.value = true
}

supabase.auth.getSession().then(({ data }) => {
  applySession(data.session)
})

supabase.auth.onAuthStateChange((event: AuthChangeEvent, next) => {
  applySession(next)
  if (event === 'PASSWORD_RECOVERY') {
    recoveryActive.value = true
  }
})

export function getPasswordResetRedirect() {
  return `${window.location.origin}/reset-password`
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signUp(email: string, password: string, fullName: string) {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })
  if (error) throw error
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: getPasswordResetRedirect(),
  })
  if (error) throw error
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function errorText(err: unknown, fallback: string) {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return fallback
}
