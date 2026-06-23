import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'dols_session'
const SECRET = process.env.AUTH_SECRET!

async function verifyToken(token: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('authenticated'))
  const expected = Buffer.from(sig).toString('hex')
  return token === expected
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // /login 은 인증 없이 접근 가능. 그 외 모든 경로(API 포함)는 세션 쿠키 필요.
  if (pathname.startsWith('/login')) {
    return NextResponse.next()
  }

  const token = request.cookies.get(COOKIE_NAME)?.value

  if (!token || !(await verifyToken(token))) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
