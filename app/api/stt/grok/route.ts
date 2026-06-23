import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

// Grok (xAI) STT — 서버 경유.
// 브라우저에서 MediaRecorder 로 녹음한 audio/webm 을 받아 xAI STT 로 전사한다.
//
// 우선은 "정지 시 전체 전사" 방식으로 안정적으로 구현한다.
// (준실시간이 필요하면 클라이언트에서 ~15초 단위 청크를 주기적으로 이 엔드포인트로
//  전송하고, 결과를 누적하는 방식으로 확장할 수 있다.)
export async function POST(request: NextRequest) {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'XAI_API_KEY가 설정되지 않았습니다.' },
      { status: 501 }
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json(
      { error: '오디오 업로드 형식이 올바르지 않습니다.' },
      { status: 400 }
    )
  }

  const file = form.get('file')
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: '오디오 파일이 없습니다.' }, { status: 400 })
  }

  const upstream = new FormData()
  upstream.append('model', 'grok-stt')
  upstream.append('file', file, 'audio.webm')
  upstream.append('language', 'ko')
  upstream.append('format', 'json')
  upstream.append('timestamps', 'true')
  upstream.append('diarize', 'true')

  let res: Response
  try {
    res = await fetch('https://api.x.ai/v1/stt', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '네트워크 오류'
    return NextResponse.json({ error: `STT 요청 실패: ${message}` }, { status: 502 })
  }

  if (!res.ok) {
    const detail = await res.text()
    return NextResponse.json({ error: 'STT 요청 실패', detail }, { status: 502 })
  }

  const data = await res.json()
  // 응답 예: { text, words: [{ text, start, end, speaker }] }
  return NextResponse.json({ text: data?.text ?? '', words: data?.words ?? [] })
}
