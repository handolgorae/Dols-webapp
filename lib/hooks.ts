'use client'

// localStorage 기반 회의록 저장소를 React 와 동기화하는 훅.
// useSyncExternalStore 를 사용해 effect 내 setState 없이 외부 저장소를 구독한다.

import { useSyncExternalStore } from 'react'
import { listMeetings, getMeeting } from './store'
import type { Meeting } from './types'

const KEY = 'dolgorae:meetings'
const EMPTY: Meeting[] = []

function subscribe(callback: () => void): () => void {
  // 같은 탭 내 변경은 마운트 시 스냅샷 재계산으로 반영되고,
  // 다른 탭의 변경은 storage 이벤트로 반영된다.
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

function rawValue(): string | null {
  return typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null
}

// 목록 스냅샷 (raw 가 동일하면 동일 참조 반환 → 무한 렌더 방지)
let listCacheRaw: string | null = null
let listCache: Meeting[] = EMPTY

function listSnapshot(): Meeting[] {
  const raw = rawValue()
  if (raw !== listCacheRaw) {
    listCacheRaw = raw
    listCache = listMeetings()
  }
  return listCache
}

export function useMeetings(): Meeting[] {
  return useSyncExternalStore(subscribe, listSnapshot, () => EMPTY)
}

// 단건 스냅샷
let oneCacheRaw: string | null = null
let oneCacheId: string | null = null
let oneCache: Meeting | null = null

function oneSnapshot(id: string): Meeting | null {
  const raw = rawValue()
  if (raw !== oneCacheRaw || id !== oneCacheId) {
    oneCacheRaw = raw
    oneCacheId = id
    oneCache = getMeeting(id) ?? null
  }
  return oneCache
}

export function useMeeting(id: string): Meeting | null {
  return useSyncExternalStore(
    subscribe,
    () => oneSnapshot(id),
    () => null
  )
}
