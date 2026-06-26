export default function TestPage() {
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })

  const vars = [
    { name: 'AUTH_SECRET', set: !!process.env.AUTH_SECRET },
    { name: 'AUTH_PASSWORD', set: !!process.env.AUTH_PASSWORD },
    { name: 'XAI_API_KEY', set: !!process.env.XAI_API_KEY },
    { name: 'ANTHROPIC_API_KEY', set: !!process.env.ANTHROPIC_API_KEY },
    { name: 'GOOGLE_STT_API_KEY', set: !!process.env.GOOGLE_STT_API_KEY },
  ]

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-8 w-full max-w-md flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">🐬 시스템 상태</h1>
          <p className="text-sm text-slate-500 mt-1">{now} (서울 시간)</p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200">
            <span className="text-green-600 font-bold">✓</span>
            <span className="text-green-800 font-medium text-sm">로그인 성공 — 인증이 정상 작동 중입니다</span>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">환경변수 설정 현황</h2>
          <div className="flex flex-col gap-2">
            {vars.map((v) => (
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

        <p className="text-xs text-slate-400 text-center">
          이 페이지는 로그인된 사용자만 볼 수 있습니다
        </p>
      </div>
    </main>
  )
}
