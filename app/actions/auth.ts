'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const PASSWORD = process.env.AUTH_PASSWORD!
const SECRET = process.env.AUTH_SECRET!
const COOKIE_NAME = 'dols_session'

async function sign(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return Buffer.from(sig).toString('hex')
}

export async function makeSessionToken(): Promise<string> {
  return sign('authenticated')
}

export async function verifySessionToken(token: string): Promise<boolean> {
  const expected = await sign('authenticated')
  return token === expected
}

export async function login(formData: FormData) {
  const password = formData.get('password') as string

  if (password !== PASSWORD) {
    redirect('/login?error=1')
  }

  const token = await makeSessionToken()
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30, // 30일
    path: '/',
  })

  redirect('/')
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
  redirect('/login')
}
