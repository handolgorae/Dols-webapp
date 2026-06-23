import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

// Google Cloud Speech-to-Text — 서버 경유 (선택).
// REST API 키(GOOGLE_STT_API_KEY) 방식으로 호출한다. 키가 없으면 "키 미설정"을 반환해
// 클라이언트에서 안내하도록 한다.
interface GoogleSttResult {
  alternatives?: Array<{ transcript?: string }>
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_STT_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google STT 키가 설정되지 않았습니다. (키 미설정)' },
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

  const audioContent = Buffer.from(await file.arrayBuffer()).toString('base64')

  let res: Response
  try {
    res = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            encoding: 'WEBM_OPUS',
            sampleRateHertz: 48000,
            languageCode: 'ko-KR',
            enableAutomaticPunctuation: true,
          },
          audio: { content: audioContent },
        }),
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : '네트워크 오류'
    return NextResponse.json({ error: `STT 요청 실패: ${message}` }, { status: 502 })
  }

  if (!res.ok) {
    const detail = await res.text()
    return NextResponse.json({ error: 'STT 요청 실패', detail }, { status: 502 })
  }

  const data = await res.json()
  const results = (data?.results ?? []) as GoogleSttResult[]
  const text = results
    .map((r) => r.alternatives?.[0]?.transcript ?? '')
    .join(' ')
    .trim()

  return NextResponse.json({ text, words: [] })
}
