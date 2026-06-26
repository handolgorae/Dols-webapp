import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 90

interface StreamBody {
  title?: string
  date?: string
  attendees?: string[]
  keywords?: string[]
  transcript?: string
  notes?: string
}

const SYSTEM_PROMPT = `당신은 회의록 분석 전문가입니다. 주어진 회의 전사본을 분석해 한국어로 요약하세요. 사용자가 제공한 주요 키워드와 메모를 우선적으로 반영하고 가중치를 두세요. 반드시 아래 JSON 형식만 출력하고, 그 외의 텍스트나 마크다운(코드펜스 포함)은 절대 출력하지 마세요.
{
  "overview": ["요약 문장들"],
  "decisions": ["핵심 결정사항들"],
  "actionItems": [{"task": "할 일", "owner": "담당자", "due": "기한"}],
  "keywords": ["추출된 키워드들"]
}`

function buildContent(body: StreamBody): string {
  const lines = [
    `미팅명: ${body.title ?? ''}`,
    `날짜: ${body.date ?? ''}`,
    `참석자: ${(body.attendees ?? []).join(', ')}`,
    `주요 키워드: ${(body.keywords ?? []).join(', ')}`,
  ]
  if (body.notes?.trim()) {
    lines.push('', '참석자 메모 (요약 시 우선 반영):', body.notes.trim())
  }
  lines.push('', '회의록 전사본:', body.transcript ?? '')
  return lines.join('\n')
}

export async function POST(request: NextRequest) {
  let body: StreamBody
  try {
    body = (await request.json()) as StreamBody
  } catch {
    return new Response('잘못된 요청 형식입니다.', { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    const enc = new TextEncoder()
    const errStream = new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' })}\n\n`))
        ctrl.close()
      },
    })
    return new Response(errStream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    })
  }

  const client = new Anthropic({ apiKey })
  const enc = new TextEncoder()

  const stream = new ReadableStream({
    async start(ctrl) {
      try {
        const s = client.messages.stream({
          model: process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildContent(body) }],
        })

        for await (const ev of s) {
          if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
            ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ d: ev.delta.text })}\n\n`))
          }
        }

        const final = await s.finalMessage()
        let full = ''
        for (const blk of final.content) {
          if (blk.type === 'text') full += blk.text
        }
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ done: true, full })}\n\n`))
      } catch (err) {
        const msg = err instanceof Error ? err.message : '요약 생성 중 오류가 발생했습니다.'
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
      } finally {
        ctrl.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
