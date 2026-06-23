import { login } from '@/app/actions/auth'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const hasError = params.error === '1'

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-300 via-blue-400 to-blue-600 flex items-center justify-center px-4">
      <div className="bg-white/20 backdrop-blur-md rounded-3xl p-10 w-full max-w-sm shadow-2xl border border-white/30">
        {/* Dolphin icon */}
        <div className="flex justify-center mb-6">
          <svg viewBox="0 0 80 80" className="w-20 h-20" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="40" cy="44" rx="28" ry="14" fill="#5BBCDD" />
            <ellipse cx="40" cy="47" rx="18" ry="8" fill="#AADEEE" />
            <ellipse cx="62" cy="40" rx="14" ry="11" fill="#5BBCDD" />
            <ellipse cx="75" cy="42" rx="6" ry="4" fill="#5BBCDD" />
            <path d="M71 44 Q75 47 79 44" stroke="#3A8FA8" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <circle cx="66" cy="37" r="2" fill="#1A3A4A" />
            <circle cx="67" cy="36" r="0.6" fill="white" />
            <path d="M40 32 Q46 18 52 30" fill="#4AA9CC" />
            <path d="M12 44 Q4 36 2 30 Q8 34 12 32 Q8 38 12 44Z" fill="#4AA9CC" />
            <path d="M12 44 Q4 52 2 58 Q8 54 12 56 Q8 50 12 44Z" fill="#4AA9CC" />
            <ellipse cx="63" cy="41" rx="3" ry="2" fill="#FF9BB5" opacity="0.5" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-1 drop-shadow">
          돌고래
        </h1>
        <p className="text-blue-100 text-center text-sm mb-8">비밀번호를 입력해주세요</p>

        <form action={login} className="flex flex-col gap-4">
          <input
            type="password"
            name="password"
            placeholder="비밀번호"
            autoFocus
            required
            className="w-full px-4 py-3 rounded-xl bg-white/30 border border-white/40 text-white placeholder-blue-100 focus:outline-none focus:ring-2 focus:ring-white/60 text-base"
          />

          {hasError && (
            <p className="text-red-200 text-sm text-center">
              비밀번호가 올바르지 않습니다
            </p>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-white text-blue-500 font-bold text-base hover:bg-blue-50 transition-colors shadow"
          >
            입장하기
          </button>
        </form>
      </div>
    </main>
  )
}
