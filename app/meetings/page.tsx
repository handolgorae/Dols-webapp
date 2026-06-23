'use client'

import Link from 'next/link'
import { useMeetings } from '@/lib/hooks'

export default function MeetingsListPage() {
  const meetings = useMeetings()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">회의록 목록</h1>
        <Link
          href="/meetings/new"
          className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          + 새 회의록
        </Link>
      </div>

      {meetings.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-5xl mb-4">🐬</p>
          <p>아직 저장된 회의록이 없습니다.</p>
          <Link href="/meetings/new" className="text-blue-600 underline mt-2 inline-block">
            첫 회의록 작성하기
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {meetings.map((m) => (
            <Link
              key={m.id}
              href={`/meetings/${m.id}`}
              className="block bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-slate-800 text-lg line-clamp-1">
                  {m.title || '(제목 없음)'}
                </h2>
                <span className="text-xs text-slate-400 shrink-0 mt-1">{m.date}</span>
              </div>
              {m.location && (
                <p className="text-sm text-slate-500 mt-1">📍 {m.location}</p>
              )}
              <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                <span>👥 참석자 {m.attendees.length}명</span>
                {m.summary && <span className="text-blue-600">✓ 요약 완료</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
