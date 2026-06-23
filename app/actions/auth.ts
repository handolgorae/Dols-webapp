'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const COOKIE_NAME = 'dols_session'

async function sign(): Promise<string> {
  const secret = process.env.AUTH_SECRET ?? ''
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('authenticated'))
  return Buffer.from(sig).toString('hex')
}

export async function login(formData: FormData) {
  const password = formData.get('password') as string
  const expected = process.env.AUTH_PASSWORD ?? ''

  if (!expected || password !== expected) {
    redirect('/login?error=1')
  }

  const token = await sign()
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })

  redirect('/')
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
  redirect('/login')
}
