import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import type { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints'
import type { MeetingSummary, TranscriptSegment } from '@/lib/types'

export const runtime = 'nodejs'

interface NotionBody {
  title: string
  date: string
  location?: string
  attendees?: string[]
  keywords?: string[]
  notes?: string
  segments?: TranscriptSegment[]
  summary?: MeetingSummary | null
}

function textBlock(text: string): BlockObjectRequest {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  }
}

function heading2(text: string): BlockObjectRequest {
  return {
    object: 'block',
    type: 'heading_2',
    heading_2: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  }
}

function bullet(text: string): BlockObjectRequest {
  return {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  }
}

function divider(): BlockObjectRequest {
  return { object: 'block', type: 'divider', divider: {} }
}

function buildBlocks(body: NotionBody): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = []

  // 기본 정보
  const meta: string[] = []
  if (body.date) meta.push(`📅 날짜: ${body.date}`)
  if (body.location) meta.push(`📍 장소: ${body.location}`)
  if (body.attendees?.length) meta.push(`👥 참석자: ${body.attendees.join(', ')}`)
  if (body.keywords?.length) meta.push(`🔖 키워드: ${body.keywords.join(', ')}`)
  if (meta.length) {
    for (const line of meta) blocks.push(textBlock(line))
    blocks.push(divider())
  }

  // 메모
  if (body.notes?.trim()) {
    blocks.push(heading2('📝 메모'))
    for (const line of body.notes.trim().split('\n')) {
      blocks.push(textBlock(line || ' '))
    }
    blocks.push(divider())
  }

  // 요약
  if (body.summary) {
    const s = body.summary
    if (s.overview.length) {
      blocks.push(heading2('📋 요약'))
      for (const o of s.overview) blocks.push(bullet(o))
    }
    if (s.decisions.length) {
      blocks.push(heading2('✅ 핵심 결정사항'))
      for (const d of s.decisions) blocks.push(bullet(d))
    }
    if (s.actionItems.length) {
      blocks.push(heading2('🎯 액션플랜'))
      for (const a of s.actionItems) {
        const line = `${a.task}${a.owner ? `  (담당: ${a.owner}` : ''}${a.due ? ` · 기한: ${a.due})` : a.owner ? ')' : ''}`
        blocks.push(bullet(line))
      }
    }
    if (s.keywords.length) {
      blocks.push(textBlock(`#${s.keywords.join('  #')}`))
    }
    blocks.push(divider())
  }

  // 회의록 전문 — Notion 단일 요청 최대 블록 100개 제한 고려해 최대 80 세그먼트
  if (body.segments?.length) {
    blocks.push(heading2('🎙 회의록 전문'))
    const limited = body.segments.slice(0, 80)
    for (const seg of limited) {
      const prefix = seg.speaker ? `[${seg.speaker}] ` : ''
      blocks.push(textBlock(`${seg.ts}  ${prefix}${seg.text}`))
    }
    if (body.segments.length > 80) {
      blocks.push(textBlock(`… (총 ${body.segments.length}개 중 처음 80개만 표시)`))
    }
  }

  return blocks
}

export async function POST(request: NextRequest) {
  const token = process.env.NOTION_TOKEN
  const databaseId = process.env.NOTION_DATABASE_ID

  if (!token || !databaseId) {
    return NextResponse.json(
      { error: 'NOTION_TOKEN 또는 NOTION_DATABASE_ID 환경변수가 설정되지 않았습니다.' },
      { status: 503 }
    )
  }

  let body: NotionBody
  try {
    body = (await request.json()) as NotionBody
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const notion = new Client({ auth: token })

  try {
    const page = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        title: {
          title: [{ type: 'text', text: { content: body.title || '(제목 없음)' } }],
        },
      },
      children: buildBlocks(body),
    })

    return NextResponse.json({ url: (page as { url?: string }).url ?? '' })
  } catch (err) {
    const message = err instanceof Error ? err.message : '노션 저장 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
