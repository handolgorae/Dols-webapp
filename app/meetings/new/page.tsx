'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import TagInput from '@/components/TagInput'
import { saveMeeting, newId } from '@/lib/store'
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

// STT 응답의 words(화자정보)를 화자 단위 세그먼트로 변환
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

export default function NewMeetingPage() {
  const router = useRouter()

  // 입력 항목
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [location, setLocation] = useState('')
  const [attendees, setAttendees] = useState<string[]>([])
  const [engine, setEngine] = useState<SttEngine>('browser')
  const [keywords, setKeywords] = useState<string[]>([])

  // 녹음/전사 상태
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [interim, setInterim] = useState('')
  const [sttProcessing, setSttProcessing] = useState(false)
  const [error, setError] = useState('')

  // 요약 상태
  const [summary, setSummary] = useState<MeetingSummary | null>(null)
  const [summarizing, setSummarizing] = useState(false)

  // refs
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const shouldRestartRef = useRef(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const mediaStreamRef = useRef<MediaStream | null>(null)

  const browserSupported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  // ───────────────────────── 브라우저 엔진 (Web Speech API) ─────────────────────────
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

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = ''
      const finals: TranscriptSegment[] = []
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript
        if (result.isFinal) {
          finals.push({ ts: nowTs(), text: transcript.trim() })
        } else {
          interimText += transcript
        }
      }
      if (finals.length > 0) {
        setSegments((prev) => [...prev, ...finals])
      }
      setInterim(interimText)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // no-speech / aborted 등은 자동 재시작으로 처리되므로 무시
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`음성인식 오류: ${event.error}`)
      }
    }

    recognition.onend = () => {
      // 침묵으로 자동 종료되어도 녹음 중이면 다시 시작
      if (shouldRestartRef.current) {
        try {
          recognition.start()
        } catch {
          /* 이미 시작된 경우 무시 */
        }
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
  }

  // ───────────────────────── 서버 경유 엔진 (Grok / Google) ─────────────────────────
  async function startMediaRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      audioChunksRef.current = []
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        void uploadRecording()
      }
      mediaRecorderRef.current = recorder
      recorder.start()
    } catch {
      setError('마이크 접근에 실패했습니다. 권한을 확인하세요.')
      setRecordingState('idle')
    }
  }

  async function uploadRecording() {
    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
    // 트랙 정리
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

  // ───────────────────────── 녹음 컨트롤 ─────────────────────────
  function handleStart() {
    setError('')
    if (engine === 'browser') {
      startBrowserRecognition()
    } else if (engine === 'grok' || engine === 'google') {
      void startMediaRecording()
    }
    setRecordingState('recording')
  }

  function handlePause() {
    if (engine === 'browser') {
      stopBrowserRecognition()
    } else {
      mediaRecorderRef.current?.pause()
    }
    setRecordingState('paused')
  }

  function handleResume() {
    if (engine === 'browser') {
      startBrowserRecognition()
    } else {
      mediaRecorderRef.current?.resume()
    }
    setRecordingState('recording')
  }

  function handleStop() {
    if (engine === 'browser') {
      stopBrowserRecognition()
      setInterim('')
    } else {
      // onstop 핸들러에서 서버 업로드/전사가 진행됨
      mediaRecorderRef.current?.stop()
      mediaRecorderRef.current = null
    }
    setRecordingState('idle')
  }

  // ───────────────────────── 요약 생성 ─────────────────────────
  const fullText = segments.map((s) => s.text).join(' ')

  async function handleSummarize() {
    if (segments.length === 0) {
      setError('요약할 회의록 내용이 없습니다.')
      return
    }
    setSummarizing(true)
    setError('')
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, date, attendees, keywords, transcript: fullText }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || '요약 생성에 실패했습니다.')
        return
      }
      setSummary(data.summary as MeetingSummary)
    } catch {
      setError('요약 요청 중 네트워크 오류가 발생했습니다.')
    } finally {
      setSummarizing(false)
    }
  }

  // ───────────────────────── 저장 ─────────────────────────
  function handleSave() {
    const now = new Date().toISOString()
    const meeting: Meeting = {
      id: newId(),
      title,
      date,
      location,
      attendees,
      engine,
      keywords,
      transcript: { segments, fullText },
      summary,
      createdAt: now,
      updatedAt: now,
    }
    saveMeeting(meeting)
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

      {/* 2분할: 실시간 회의록 / 요약·액션플랜 */}
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800">요약 / 액션플랜</h2>
            <button
              onClick={handleSummarize}
              disabled={summarizing}
              className="px-4 py-1.5 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {summarizing ? '생성 중…' : '요약 생성'}
            </button>
          </div>

          {!summary ? (
            <p className="text-slate-400 text-sm min-h-[160px]">
              회의록을 작성한 뒤 “요약 생성”을 누르면 요약·핵심 결정사항·액션플랜이
              표시됩니다.
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

      {/* 저장 */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="px-6 py-2.5 rounded-full bg-green-600 text-white font-semibold hover:bg-green-700"
        >
          저장
        </button>
      </div>
    </div>
  )
}
