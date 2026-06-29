'use client'

// 클라이언트 측 Supabase 싱글톤.
// 서버의 /api/supabase-config 에서 접속 정보를 한 번 가져와 클라이언트를 생성한다.
// (VITE_ 환경변수는 서버에만 존재하므로 런타임에 받아온다.)

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Meeting } from './types'

export const ARCHIVE_BUCKET = 'archive'
export const MEETINGS_TABLE = 'meetings'

let clientPromise: Promise<SupabaseClient | null> | null = null

export function getSupabase(): Promise<SupabaseClient | null> {
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        const res = await fetch('/api/supabase-config')
        if (!res.ok) return null
        const cfg = (await res.json()) as { url?: string; anonKey?: string }
        if (!cfg.url || !cfg.anonKey) return null
        return createClient(cfg.url, cfg.anonKey)
      } catch {
        return null
      }
    })()
  }
  return clientPromise
}

// ─── 회의록 ───

export async function uploadMeeting(meeting: Meeting): Promise<{ ok: boolean; error?: string }> {
  const sb = await getSupabase()
  if (!sb) return { ok: false, error: 'Supabase가 설정되지 않았습니다.' }

  const { error } = await sb.from(MEETINGS_TABLE).upsert({
    id: meeting.id,
    title: meeting.title,
    date: meeting.date,
    data: meeting,
    updated_at: new Date().toISOString(),
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function downloadMeetings(): Promise<Meeting[] | null> {
  const sb = await getSupabase()
  if (!sb) return null

  const { data, error } = await sb
    .from(MEETINGS_TABLE)
    .select('data')
    .order('created_at', { ascending: false })

  if (error) return null
  return (data ?? []).map((row) => (row as { data: Meeting }).data)
}

// ─── 자료실(파일) ───

export interface ArchiveFile {
  name: string
  size: number
  createdAt: string
  url: string
}

export async function listArchiveFiles(): Promise<ArchiveFile[] | null> {
  const sb = await getSupabase()
  if (!sb) return null

  const { data, error } = await sb.storage.from(ARCHIVE_BUCKET).list('', {
    limit: 200,
    sortBy: { column: 'created_at', order: 'desc' },
  })

  if (error) return null

  return (data ?? [])
    .filter((f) => f.id !== null) // 폴더 제외
    .map((f) => {
      const { data: pub } = sb.storage.from(ARCHIVE_BUCKET).getPublicUrl(f.name)
      return {
        name: f.name,
        size: (f.metadata?.size as number) ?? 0,
        createdAt: f.created_at ?? '',
        url: pub.publicUrl,
      }
    })
}

export async function uploadArchiveFile(file: File): Promise<{ ok: boolean; error?: string }> {
  const sb = await getSupabase()
  if (!sb) return { ok: false, error: 'Supabase가 설정되지 않았습니다.' }

  // 한글/공백 파일명 안전 처리: 타임스탬프 접두어 + 원본 유지
  const safeName = `${Date.now()}_${file.name}`.replace(/\s+/g, '_')
  const { error } = await sb.storage.from(ARCHIVE_BUCKET).upload(safeName, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deleteArchiveFile(name: string): Promise<boolean> {
  const sb = await getSupabase()
  if (!sb) return false
  const { error } = await sb.storage.from(ARCHIVE_BUCKET).remove([name])
  return !error
}
