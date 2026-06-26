'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { deleteMeeting } from '@/lib/store'
import { useMeeting } from '@/lib/hooks'

type NotionStatus = 'idle' | 'loading' | 'done' | 'error'

export default function MeetingDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const meeting = useMeeting(params.id)

  const [notionStatus, setNotionStatus] = useState<NotionStatus>('idle')
  const [notionUrl, setNotionUrl] = useState('')
  const [notionError, setNotionError] = useState('')

  if (meeting === null) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p>회의록을 찾을 수 없습니다.</p>
        <Link href="/meetings" className="text-blue-600 underline mt-2 inline-block">
          목록으로
        </Link>
      </div>
    )
  }

  function handleDelete() {
    if (!meeting) return
    if (confirm('이 회의록을 삭제할까요?')) {
      deleteMeeting(meeting.id)
      router.push('/meetings')
    }
  }

  async function handleSaveToNotion() {
    if (!meeting) return
    setNotionStatus('loading')
    setNotionError('')
    try {
      const res = await fetch('/api/notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: meeting.title,
          date: meeting.date,
          location: meeting.location,
          attendees: meeting.attendees,
          keywords: meeting.keywords,
          notes: meeting.notes,
          segments: meeting.transcript.segments,
          summary: meeting.summary,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setNotionError(data?.error || '노션 저장에 실패했습니다.')
        setNotionStatus('error')
        return
      }
      setNotionUrl(data.url ?? '')
      setNotionStatus('done')
    } catch {
      setNotionError('네트워크 오류가 발생했습니다.')
      setNotionStatus('error')
    }
  }

  const s = meeting.summary

  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div>
        <Link href="/meetings" className="text-sm text-blue-600 hover:underline">
          ← 목록으로
        </Link>
        <div className="flex items-start justify-between gap-3 mt-2 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {meeting.title || '(제목 없음)'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {meeting.date}
              {meeting.location ? ` · ${meeting.location}` : ''}
            </p>
            {meeting.attendees.length > 0 && (
              <p className="text-sm text-slate-500 mt-0.5">
                참석자: {meeting.attendees.join(', ')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* 노션 저장 버튼 */}
            <button
              onClick={() => void handleSaveToNotion()}
              disabled={notionStatus === 'loading' || notionStatus === 'done'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-300 text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {notionStatus === 'loading' && (
                <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              )}
              {notionStatus === 'done' ? '✓ 노션 저장됨' : '노션에 저장'}
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 rounded-full border border-red-300 text-red-500 text-sm hover:bg-red-50"
            >
              삭제
            </button>
          </div>
        </div>

        {/* 노션 저장 결과 */}
        {notionStatus === 'done' && notionUrl && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <span>노션에 저장됐습니다.</span>
            <a
              href={notionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              노션에서 열기 →
            </a>
          </div>
        )}
        {notionStatus === 'error' && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {notionError}
          </p>
        )}
      </div>

      {/* 메모 */}
      {meeting.notes?.trim() && (
        <section className="bg-amber-50 rounded-xl border border-amber-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-2">📝 메모</h2>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{meeting.notes}</p>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 회의록 전문 */}
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-3">회의록 전문</h2>
          {meeting.transcript.segments.length === 0 ? (
            <p className="text-slate-400 text-sm">기록된 내용이 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
              {meeting.transcript.segments.map((seg, i) => (
                <div key={i} className="text-sm">
                  <span className="text-slate-400 mr-2 tabular-nums">{seg.ts}</span>
                  {seg.speaker && (
                    <span className="text-blue-600 font-medium mr-1">
                      {seg.speaker}:
                    </span>
                  )}
                  <span className="text-slate-700">{seg.text}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 요약 / 액션플랜 */}
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-3">요약 / 액션플랜</h2>
          {!s ? (
            <p className="text-slate-400 text-sm">생성된 요약이 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-4 text-sm">
              <div>
                <h3 className="font-semibold text-slate-700 mb-1">📋 요약</h3>
                <ul className="list-disc list-inside text-slate-600 space-y-1">
                  {s.overview.map((o, i) => <li key={i}>{o}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-slate-700 mb-1">✅ 핵심 결정사항</h3>
                <ul className="list-disc list-inside text-slate-600 space-y-1">
                  {s.decisions.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-slate-700 mb-1">🎯 액션플랜</h3>
                <div className="flex flex-col gap-2">
                  {s.actionItems.map((a, i) => (
                    <div key={i} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                      <p className="text-slate-700">{a.task}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        담당: {a.owner || '-'} · 기한: {a.due || '-'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              {s.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {s.keywords.map((k) => (
                    <span key={k} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      #{k}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
