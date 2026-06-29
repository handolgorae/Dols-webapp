'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TagInput from '@/components/TagInput'
import { saveMeeting, newId } from '@/lib/store'
import { uploadMeeting } from '@/lib/supabase'
import type {
  SttEngine,
  TranscriptSegment,
  MeetingSummary,
  Meeting,
} from '@/lib/types'

type RecordingState = 'idle' | 'recording' | 'paused'

interface SttWord {
  text: string
  start?: number
  end?: number
  speaker?: string
}

const ENGINE_OPTIONS: { value: SttEngine; label: string; disabled?: boolean }[] = [
  { value: 'browser', label: '브라우저 (실시간·무료, Chrome/Edge)' },
  { value: 'grok', label: 'Grok STT (서버 경유·고정확도·화자분리)' },
  { value: 'google', label: 'Google Cloud STT (서버 경유)' },
  { value: 'local', label: '로컬 서버 (준비중)', disabled: true },
]

function nowTs(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function wordsToSegments(text: string, words: SttWord[]): TranscriptSegment[] {
  if (!words || words.length === 0) {
    return text ? [{ ts: nowTs(), text }] : []
  }
  const segments: TranscriptSegment[] = []
  let current: TranscriptSegment | null = null
  for (const w of words) {
    const speaker = w.speaker ? `화자 ${w.speaker}` : undefined
    if (!current || current.speaker !== speaker) {
      current = { ts: nowTs(), speaker, text: w.text }
      segments.push(current)
    } else {
      current.text += (w.text.startsWith(' ') ? '' : ' ') + w.text
    }
  }
  return segments
}

function extractSummaryJson(text: string): MeetingSummary | null {
  try {
    let t = text.trim()
    if (t.startsWith('```')) {
      t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
    }
    const start = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (start >= 0 && end >= start) t = t.slice(start, end + 1)
    const parsed = JSON.parse(t) as Partial<MeetingSummary>
    return {
      overview: parsed.overview ?? [],
      decisions: parsed.decisions ?? [],
      actionItems: parsed.actionItems ?? [],
      keywords: parsed.keywords ?? [],
    }
  } catch {
    return null
  }
}

export default function NewMeetingPage() {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [location, setLocation] = useState('')
  const [attendees, setAttendees] = useState<string[]>([])
  const [engine, setEngine] = useState<SttEngine>('browser')
  const [keywords, setKeywords] = useState<string[]>([])
  const [notes, setNotes] = useState('')

  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [interim, setInterim] = useState('')
  const [sttProcessing, setSttProcessing] = useState(false)
  const [error, setError] = useState('')

  const [summary, setSummary] = useState<MeetingSummary | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const [lastSummaryAt, setLastSummaryAt] = useState<Date | null>(null)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const shouldRestartRef = useRef(false)
  // 디바운스: 한국어 음절 조립 및 재시작 중복 방지
  const pendingSegRef = useRef<{ text: string; timer: ReturnType<typeof setTimeout> } | null>(null)
  const lastCommittedRef = useRef<{ text: string; time: number } | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const mediaStreamRef = useRef<MediaStream | null>(null)

  // refs for auto-summarize (avoid stale closures in interval)
  const summarizingRef = useRef(false)
  const segmentsRef = useRef<TranscriptSegment[]>([])
  const notesRef = useRef('')
  const titleRef = useRef('')
  const dateRef = useRef(date)
  const attendeesRef = useRef<string[]>([])
  const keywordsRef = useRef<string[]>([])
  const lastAutoSegCountRef = useRef(0)
  const lastSummaryTimeRef = useRef<number | null>(null)
  const handleSummarizeRef = useRef<() => Promise<void>>(async () => {})

  // Keep refs in sync on every render
  segmentsRef.current = segments
  notesRef.current = notes
  titleRef.current = title
  dateRef.current = date
  attendeesRef.current = attendees
  keywordsRef.current = keywords

  const browserSupported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  // ─── 브라우저 STT ───

  // 700ms 디바운스로 한국어 음절 조립 중복 및 재시작 직후 중복을 모두 처리한다.
  // - "한" → "한도" 처럼 짧은 시간 내 prefix 확장 → 긴 쪽만 저장
  // - 재시작 후 동일 텍스트 재인식 → 6초 내 exact 중복 차단
  function commitPending(text: string) {
    pendingSegRef.current = null
    const now = Date.now()
    const last = lastCommittedRef.current
    if (last && now - last.time < 6000 && last.text.toLowerCase() === text.toLowerCase()) return
    lastCommittedRef.current = { text, time: now }
    setSegments((prev) => [...prev, { ts: nowTs(), text }])
  }

  function queueSegment(rawText: string) {
    const text = rawText.trim()
    if (text.length < 2) return

    if (pendingSegRef.current) {
      clearTimeout(pendingSegRef.current.timer)
      const prev = pendingSegRef.current.text.toLowerCase()
      const next = text.toLowerCase()
      if (next === prev || next.startsWith(prev)) {
        // 동일하거나 이전 텍스트를 포함하는 확장 → 더 긴 텍스트로 교체
        pendingSegRef.current = { text, timer: setTimeout(() => commitPending(text), 700) }
        return
      }
      if (prev.startsWith(next)) {
        // 이전 텍스트가 더 길다 → 이전 것 유지
        pendingSegRef.current = {
          ...pendingSegRef.current,
          timer: setTimeout(() => commitPending(pendingSegRef.current!.text), 700),
        }
        return
      }
      // 완전히 다른 단어 → 이전 것 즉시 커밋
      commitPending(pendingSegRef.current.text)
    }

    pendingSegRef.current = { text, timer: setTimeout(() => commitPending(text), 700) }
  }

  function startBrowserRecognition() {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Ctor) {
      setError('이 브라우저는 음성인식을 지원하지 않습니다. Chrome 또는 Edge를 사용하세요.')
      return
    }
    const recognition = new Ctor()
    recognition.lang = 'ko-KR'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          queueSegment(result[0].transcript)
        } else {
          interimText += result[0].transcript
        }
      }
      setInterim(interimText)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`음성인식 오류: ${event.error}`)
      }
    }

    recognition.onend = () => {
      if (shouldRestartRef.current && recognitionRef.current === recognition) {
        try { recognition.start() } catch { /* already started */ }
      }
    }

    recognitionRef.current = recognition
    shouldRestartRef.current = true
    recognition.start()
  }

  function stopBrowserRecognition() {
    shouldRestartRef.current = false
    recognitionRef.current?.stop()
    recognitionRef.current = null
    // 남은 대기 세그먼트 즉시 커밋
    if (pendingSegRef.current) {
      clearTimeout(pendingSegRef.current.timer)
      commitPending(pendingSegRef.current.text)
    }
  }

  // ─── 서버 경유 STT ───
  async function startMediaRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      audioChunksRef.current = []
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      recorder.onstop = () => { void uploadRecording() }
      mediaRecorderRef.current = recorder
      recorder.start()
    } catch {
      setError('마이크 접근에 실패했습니다. 권한을 확인하세요.')
      setRecordingState('idle')
    }
  }

  async function uploadRecording() {
    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    mediaStreamRef.current = null
    if (blob.size === 0) return

    setSttProcessing(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', blob, 'audio.webm')
      const endpoint = engine === 'google' ? '/api/stt/google' : '/api/stt/grok'
      const res = await fetch(endpoint, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || '전사에 실패했습니다.')
        return
      }
      const newSegments = wordsToSegments(data.text ?? '', data.words ?? [])
      setSegments((prev) => [...prev, ...newSegments])
    } catch {
      setError('전사 요청 중 네트워크 오류가 발생했습니다.')
    } finally {
      setSttProcessing(false)
    }
  }

  // ─── 녹음 컨트롤 ───
  function handleStart() {
    setError('')
    if (engine === 'browser') startBrowserRecognition()
    else void startMediaRecording()
    setRecordingState('recording')
  }

  function handlePause() {
    if (engine === 'browser') stopBrowserRecognition()
    else mediaRecorderRef.current?.pause()
    setRecordingState('paused')
  }

  function handleResume() {
    if (engine === 'browser') startBrowserRecognition()
    else mediaRecorderRef.current?.resume()
    setRecordingState('recording')
  }

  function handleStop() {
    if (engine === 'browser') {
      stopBrowserRecognition()
      setInterim('')
    } else {
      mediaRecorderRef.current?.stop()
      mediaRecorderRef.current = null
    }
    setRecordingState('idle')
  }

  // ─── 스트리밍 요약 ───
  const fullText = segments.map((s) => s.text).join(' ')

  async function handleSummarize() {
    if (segmentsRef.current.length === 0) {
      setError('요약할 회의록 내용이 없습니다.')
      return
    }
    if (summarizingRef.current) return

    summarizingRef.current = true
    setSummarizing(true)
    setError('')

    try {
      const res = await fetch('/api/summarize/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titleRef.current,
          date: dateRef.current,
          attendees: attendeesRef.current,
          keywords: keywordsRef.current,
          notes: notesRef.current,
          transcript: segmentsRef.current.map((s) => s.text).join(' '),
        }),
      })

      if (!res.ok || !res.body) {
        setError('요약 요청에 실패했습니다.')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue
          try {
            const parsed = JSON.parse(raw) as { d?: string; done?: boolean; full?: string; error?: string }
            if (parsed.error) {
              setError(parsed.error)
              return
            }
            if (parsed.done && parsed.full) {
              const result = extractSummaryJson(parsed.full)
              if (result) {
                setSummary(result)
                setLastSummaryAt(new Date())
              } else {
                setError('요약 결과를 파싱할 수 없습니다.')
              }
            }
          } catch { /* ignore incomplete JSON chunks */ }
        }
      }
    } catch {
      setError('요약 요청 중 네트워크 오류가 발생했습니다.')
    } finally {
      summarizingRef.current = false
      setSummarizing(false)
    }
  }

  // Keep ref updated so auto-summarize interval always calls fresh version
  handleSummarizeRef.current = handleSummarize

  // ─── 자동 요약 (녹음 중 30초마다 확인, 10개 이상 새 세그먼트 or 90초 경과 시 트리거) ───
  useEffect(() => {
    if (recordingState !== 'recording') return

    const timer = setInterval(() => {
      const count = segmentsRef.current.length
      if (count < 3 || summarizingRef.current) return

      const newSegs = count - lastAutoSegCountRef.current
      if (newSegs < 1) return

      const elapsed = lastSummaryTimeRef.current
        ? Date.now() - lastSummaryTimeRef.current
        : Infinity

      if (newSegs >= 10 || elapsed >= 90_000) {
        lastAutoSegCountRef.current = count
        lastSummaryTimeRef.current = Date.now()
        void handleSummarizeRef.current()
      }
    }, 30_000)

    return () => clearInterval(timer)
  }, [recordingState])

  // ─── 저장 ───
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const now = new Date().toISOString()
    const meeting: Meeting = {
      id: newId(),
      title,
      date,
      location,
      attendees,
      engine,
      keywords,
      notes,
      transcript: { segments, fullText },
      summary,
      createdAt: now,
      updatedAt: now,
    }
    saveMeeting(meeting)
    // Supabase 에도 업로드 (설정된 경우에만, 실패해도 로컬 저장은 유지)
    await uploadMeeting(meeting)
    router.push('/meetings')
  }

  const isRecording = recordingState === 'recording'

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-800">회의록 작성</h1>

      {/* 입력 항목 */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">미팅명</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 주간 약국 운영 회의"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">날짜</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">장소</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="예: 본점 상담실"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">음성인식 엔진</label>
          <select
            value={engine}
            onChange={(e) => setEngine(e.target.value as SttEngine)}
            disabled={recordingState !== 'idle'}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-slate-100"
          >
            {ENGINE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <TagInput
          label="참석자"
          placeholder="이름 입력 후 Enter"
          tags={attendees}
          onChange={setAttendees}
        />
        <TagInput
          label="주요 키워드 (요약 시 강조)"
          placeholder="키워드 입력 후 Enter"
          tags={keywords}
          onChange={setKeywords}
        />
      </section>

      {engine === 'browser' && !browserSupported && (
        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠️ 현재 브라우저는 실시간 음성인식을 지원하지 않습니다. Chrome 또는 Edge에서
          이용하거나 Grok STT 엔진을 선택하세요. (HTTPS 환경 필요 — Vercel은 자동 적용)
        </p>
      )}

      {/* 녹음 컨트롤 */}
      <section className="flex items-center gap-3 flex-wrap">
        {recordingState === 'idle' && (
          <button
            onClick={handleStart}
            className="px-5 py-2.5 rounded-full bg-red-500 text-white font-semibold hover:bg-red-600 flex items-center gap-2"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-white" /> 녹음 시작
          </button>
        )}
        {isRecording && (
          <>
            <button
              onClick={handlePause}
              className="px-5 py-2.5 rounded-full bg-amber-500 text-white font-semibold hover:bg-amber-600"
            >
              ⏸ 일시정지
            </button>
            <button
              onClick={handleStop}
              className="px-5 py-2.5 rounded-full bg-slate-700 text-white font-semibold hover:bg-slate-800"
            >
              ⏹ 정지
            </button>
            <span className="flex items-center gap-2 text-red-500 text-sm font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              녹음 중…
            </span>
          </>
        )}
        {recordingState === 'paused' && (
          <>
            <button
              onClick={handleResume}
              className="px-5 py-2.5 rounded-full bg-green-600 text-white font-semibold hover:bg-green-700"
            >
              ▶ 다시 시작
            </button>
            <button
              onClick={handleStop}
              className="px-5 py-2.5 rounded-full bg-slate-700 text-white font-semibold hover:bg-slate-800"
            >
              ⏹ 정지
            </button>
            <span className="text-amber-600 text-sm font-medium">일시정지됨</span>
          </>
        )}
        {sttProcessing && (
          <span className="text-blue-600 text-sm">서버 전사 중…</span>
        )}
      </section>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* 실시간 회의록 / 요약·액션플랜 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 실시간 회의록 */}
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-3">실시간 회의록</h2>
          <div className="flex flex-col gap-2 min-h-[200px] max-h-[55vh] overflow-y-auto">
            {segments.length === 0 && !interim && (
              <p className="text-slate-400 text-sm">
                녹음을 시작하면 말하는 내용이 여기에 기록됩니다.
              </p>
            )}
            {segments.map((seg, i) => (
              <div key={i} className="text-sm">
                <span className="text-slate-400 mr-2 tabular-nums">{seg.ts}</span>
                {seg.speaker && (
                  <span className="text-blue-600 font-medium mr-1">{seg.speaker}:</span>
                )}
                <span className="text-slate-700">{seg.text}</span>
              </div>
            ))}
            {interim && (
              <div className="text-sm text-slate-400 italic">{interim}</div>
            )}
          </div>
        </section>

        {/* 요약 / 액션플랜 */}
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-slate-800">요약 / 액션플랜</h2>
              {isRecording && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  자동 업데이트 켜짐
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {lastSummaryAt && (
                <span className="text-xs text-slate-400">
                  {lastSummaryAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 업데이트
                </span>
              )}
              <button
                onClick={() => void handleSummarize()}
                disabled={summarizing}
                className="px-4 py-1.5 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {summarizing && (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {summarizing ? 'Claude 요약 중…' : '요약 생성'}
              </button>
            </div>
          </div>

          {!summary ? (
            <p className="text-slate-400 text-sm min-h-[160px]">
              회의록을 작성한 뒤 &quot;요약 생성&quot;을 누르거나, 녹음 중 자동으로 업데이트됩니다
              (10개 세그먼트 또는 90초마다).
            </p>
          ) : (
            <div className="flex flex-col gap-4 text-sm">
              <div>
                <h3 className="font-semibold text-slate-700 mb-1">📋 요약</h3>
                <ul className="list-disc list-inside text-slate-600 space-y-1">
                  {summary.overview.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-slate-700 mb-1">✅ 핵심 결정사항</h3>
                <ul className="list-disc list-inside text-slate-600 space-y-1">
                  {summary.decisions.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-slate-700 mb-1">🎯 액션플랜</h3>
                <div className="flex flex-col gap-2">
                  {summary.actionItems.map((a, i) => (
                    <div
                      key={i}
                      className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2"
                    >
                      <p className="text-slate-700">{a.task}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        담당: {a.owner || '-'} · 기한: {a.due || '-'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              {summary.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {summary.keywords.map((k) => (
                    <span
                      key={k}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full"
                    >
                      #{k}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* 메모 */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-semibold text-slate-800">📝 메모</h2>
          <span className="text-xs text-slate-400">요약 생성 시 자동 반영됩니다</span>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="회의 중 자유롭게 메모하세요.&#10;예) 김팀장 — 다음주 금요일까지 보고서 제출 요청&#10;예) 예산 추가 검토 필요 (3Q 초과 가능성)"
          rows={5}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none placeholder-slate-400"
        />
      </section>

      {/* 저장 */}
      <div className="flex justify-end pb-4">
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="px-6 py-2.5 rounded-full bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving && (
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  )
}
