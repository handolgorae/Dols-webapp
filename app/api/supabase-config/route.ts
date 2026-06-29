import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 클라이언트에 Supabase 접속 정보를 전달한다.
// anon 키는 공개용(RLS 로 보호)이며, 이 엔드포인트는 로그인된 사용자만 접근 가능.
export async function GET() {
  const url = process.env.VITE_SUPABASE_URL ?? ''
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? ''
  return NextResponse.json({
    url,
    anonKey,
    configured: !!(url && anonKey),
  })
}
