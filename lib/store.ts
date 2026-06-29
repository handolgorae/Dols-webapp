// 회의록 저장소 추상화 계층.
//
// 현재는 브라우저 localStorage 를 사용합니다. 모든 읽기/쓰기를 이 파일 한 곳에
// 모아두었으므로, 추후 여러 기기에서 공유하려면 이 함수들의 내부 구현만
// Vercel KV 또는 Postgres 호출로 교체하면 됩니다. (호출부는 변경 불필요)

import type { Meeting } from './types'

const KEY = 'dolgorae:meetings'

function readAll(): Meeting[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Meeting[]) : []
  } catch {
    return []
  }
}

function writeAll(list: Meeting[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(KEY, JSON.stringify(list))
}

export function listMeetings(): Meeting[] {
  // 최신순 정렬
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getMeeting(id: string): Meeting | undefined {
  return readAll().find((m) => m.id === id)
}

export function saveMeeting(meeting: Meeting): void {
  const all = readAll()
  const idx = all.findIndex((m) => m.id === meeting.id)
  if (idx >= 0) all[idx] = meeting
  else all.push(meeting)
  writeAll(all)
}

export function deleteMeeting(id: string): void {
  writeAll(readAll().filter((m) => m.id !== id))
}

// 외부(Supabase 등)에서 받은 회의록 목록을 localStorage 에 병합한다.
// 같은 id 는 updatedAt 이 더 최신인 쪽을 유지한다. 병합된 총 개수를 반환.
export function mergeMeetings(incoming: Meeting[]): number {
  const byId = new Map<string, Meeting>()
  for (const m of readAll()) byId.set(m.id, m)
  for (const m of incoming) {
    const existing = byId.get(m.id)
    if (!existing || (m.updatedAt ?? '') >= (existing.updatedAt ?? '')) {
      byId.set(m.id, m)
    }
  }
  const merged = Array.from(byId.values())
  writeAll(merged)
  return merged.length
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `m_${Date.now()}_${Math.random().toString(36).slice(2)}`
}
