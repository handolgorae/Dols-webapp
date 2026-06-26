export default function TestPage() {
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })

  const vars = [
    { name: 'AUTH_SECRET', set: !!process.env.AUTH_SECRET, required: true },
    { name: 'AUTH_PASSWORD', set: !!process.env.AUTH_PASSWORD, required: true },
    { name: 'ANTHROPIC_API_KEY', set: !!process.env.ANTHROPIC_API_KEY, required: false, note: '요약 기능 (Claude)' },
    { name: 'XAI_API_KEY', set: !!process.env.XAI_API_KEY, required: false, note: '요약 기능 (Grok 폴백)' },
    { name: 'NOTION_TOKEN', set: !!process.env.NOTION_TOKEN, required: false, note: '노션 저장' },
    { name: 'NOTION_DATABASE_ID', set: !!process.env.NOTION_DATABASE_ID, required: false, note: '노션 저장' },
    { name: 'GOOGLE_STT_API_KEY', set: !!process.env.GOOGLE_STT_API_KEY, required: false, note: 'Google STT' },
  ]

  const required = vars.filter((v) => v.required)
  const optional = vars.filter((v) => !v.required)

  return (
    <main className="flex items-center justify-center p-6 py-12">
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-8 w-full max-w-lg flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">🐬 시스템 상태</h1>
          <p className="text-sm text-slate-500 mt-1">{now} (서울 시간)</p>
        </div>

        {/* 인증 상태 */}
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200">
          <span className="text-green-600 font-bold">✓</span>
          <span className="text-green-800 font-medium text-sm">로그인 성공 — 인증이 정상 작동 중입니다</span>
        </div>

        {/* 필수 환경변수 */}
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">필수 환경변수</h2>
          <div className="flex flex-col gap-2">
            {required.map((v) => (
              <div
                key={v.name}
                className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm ${
                  v.set
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                <span className="font-mono">{v.name}</span>
                <span className="font-semibold">{v.set ? '✓ 설정됨' : '✗ 미설정'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 선택 환경변수 */}
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">선택 환경변수</h2>
          <div className="flex flex-col gap-2">
            {optional.map((v) => (
              <div
                key={v.name}
                className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm ${
                  v.set
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <div>
                  <span className="font-mono">{v.name}</span>
                  {v.note && (
                    <span className="ml-2 text-xs opacity-70">({v.note})</span>
                  )}
                </div>
                <span className="font-semibold shrink-0 ml-2">{v.set ? '✓ 설정됨' : '미설정'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 안내 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">환경변수가 미설정으로 나올 경우</p>
          <p>1. Vercel → Settings → Environment Variables에서 변수명을 정확히 확인하세요 (대소문자 구분)</p>
          <p>2. 변수 추가/수정 후 Vercel Deployments 탭에서 &quot;Redeploy&quot;를 눌러야 반영됩니다</p>
          <p>3. 이 페이지를 다시 로드하면 최신 상태가 표시됩니다</p>
        </div>

        <p className="text-xs text-slate-400 text-center">
          이 페이지는 로그인된 사용자만 볼 수 있습니다
        </p>
      </div>
    </main>
  )
}
