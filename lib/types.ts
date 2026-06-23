// 회의록 도메인 공용 타입

export type SttEngine = 'browser' | 'grok' | 'google' | 'local'

export interface TranscriptSegment {
  ts: string // 표시용 타임스탬프 (예: "14:03:21")
  speaker?: string // 화자(화자분리 지원 엔진에서만)
  text: string
}

export interface MeetingTranscript {
  segments: TranscriptSegment[]
  fullText: string
}

export interface ActionItem {
  task: string
  owner: string
  due: string
}

export interface MeetingSummary {
  overview: string[]
  decisions: string[]
  actionItems: ActionItem[]
  keywords: string[]
}

export interface Meeting {
  id: string
  title: string
  date: string
  location: string
  attendees: string[]
  engine: SttEngine
  keywords: string[]
  transcript: MeetingTranscript
  summary: MeetingSummary | null
  createdAt: string
  updatedAt: string
}
