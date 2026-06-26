import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

interface SummarizeBody {
  title?: string
  date?: string
  attendees?: string[]
  keywords?: string[]
  transcript?: string
}

interface SummaryResult {
  overview: string[]
  decisions: string[]
  actionItems: { task: string; owner: string; due: string }[]
  keywords: string[]
}

const SYSTEM_PROMPT = `당신은 회의록 분석 전문가입니다. 주어진 회의 전사본을 분석해 한국어로 요약하세요. 사용자가 제공한 주요 키워드를 우선적으로 반영하고 가중치를 두세요. 반드시 아래 JSON 형식만 출력하고, 그 외의 텍스트나 마크다운(코드펜스 포함)은 절대 출력하지 마세요.
{
  "overview": ["요약 문장들"],
  "decisions": ["핵심 결정사항들"],
  "actionItems": [{"task": "할 일", "owner": "담당자", "due": "기한"}],
  "keywords": ["추출된 키워드들"]
}`

// LLM 응답을 안전하게 JSON 으로 파싱한다. 코드펜스 제거 후 첫 '{' ~ 마지막 '}' 추출.
function extractJson(text: string): SummaryResult {
  let t = text.trim()
  if (t.startsWith('```')) {
    t = t
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
  }
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end >= start) t = t.slice(start, end + 1)

  const parsed = JSON.parse(t) as Partial<SummaryResult>
  return {
    overview: parsed.overview ?? [],
    decisions: parsed.decisions ?? [],
    actionItems: parsed.actionItems ?? [],
    keywords: parsed.keywords ?? [],
  }
}

function buildUserContent(body: SummarizeBody): string {
  return [
    `미팅명: ${body.title ?? ''}`,
    `날짜: ${body.date ?? ''}`,
    `참석자: ${(body.attendees ?? []).join(', ')}`,
    `주요 키워드: ${(body.keywords ?? []).join(', ')}`,
    '',
    '회의록 전사본:',
    body.transcript ?? '',
  ].join('\n')
}

async function summarizeWithClaude(body: SummarizeBody): Promise<SummaryResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다.')

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-8',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserContent(body) }],
  })

  let text = ''
  for (const block of response.content) {
    if (block.type === 'text') text += block.text
  }
  return extractJson(text)
}

async function summarizeWithGrok(body: SummarizeBody): Promise<SummaryResult> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) throw new Error('XAI_API_KEY가 설정되지 않았습니다.')

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.GROK_MODEL || 'grok-4',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserContent(body) },
      ],
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Grok 요약 요청 실패: ${detail}`)
  }

  const data = await res.json()
  const content: string = data?.choices?.[0]?.message?.content ?? ''
  return extractJson(content)
}

export async function POST(request: NextRequest) {
  let body: SummarizeBody
  try {
    body = (await request.json()) as SummarizeBody
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  // ANTHROPIC_API_KEY 있으면 claude, 없으면 grok (SUMMARY_PROVIDER로 명시 재정의 가능)
  const defaultProvider = process.env.ANTHROPIC_API_KEY ? 'claude' : 'grok'
  const provider = (process.env.SUMMARY_PROVIDER || defaultProvider).toLowerCase()

  try {
    const summary =
      provider === 'claude'
        ? await summarizeWithClaude(body)
        : await summarizeWithGrok(body)
    return NextResponse.json({ summary })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : '요약 생성 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
