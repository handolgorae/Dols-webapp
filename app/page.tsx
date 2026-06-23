import Link from 'next/link'
import { logout } from '@/app/actions/auth'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-300 via-blue-400 to-blue-600 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Bubbles */}
      <div className="absolute inset-0 pointer-events-none">
        {[
          { w: 18, h: 18, left: 10, top: 15, delay: 0, dur: 2.5 },
          { w: 12, h: 12, left: 25, top: 70, delay: 1, dur: 3 },
          { w: 24, h: 24, left: 40, top: 30, delay: 0.5, dur: 2 },
          { w: 10, h: 10, left: 55, top: 85, delay: 1.5, dur: 3.5 },
          { w: 20, h: 20, left: 70, top: 20, delay: 0.2, dur: 2.8 },
          { w: 14, h: 14, left: 80, top: 60, delay: 2, dur: 2.2 },
          { w: 16, h: 16, left: 90, top: 40, delay: 0.8, dur: 3.2 },
          { w: 22, h: 22, left: 15, top: 50, delay: 1.2, dur: 2.6 },
          { w: 8, h: 8, left: 60, top: 10, delay: 2.5, dur: 2 },
          { w: 26, h: 26, left: 35, top: 75, delay: 0.3, dur: 3.8 },
          { w: 12, h: 12, left: 5, top: 90, delay: 1.8, dur: 2.4 },
          { w: 18, h: 18, left: 75, top: 80, delay: 0.7, dur: 3.1 },
        ].map((b, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/20 animate-pulse"
            style={{
              width: `${b.w}px`,
              height: `${b.h}px`,
              left: `${b.left}%`,
              top: `${b.top}%`,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.dur}s`,
            }}
          />
        ))}
      </div>

      {/* Wave decoration top */}
      <div className="absolute top-0 left-0 right-0 h-16 opacity-30">
        <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="w-full h-full">
          <path
            fill="white"
            d="M0,30 C360,60 720,0 1080,30 C1260,45 1380,20 1440,30 L1440,0 L0,0 Z"
          />
        </svg>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center max-w-2xl">
        {/* Dolphin SVG */}
        <div className="w-64 h-64 drop-shadow-2xl animate-bounce" style={{ animationDuration: "3s" }}>
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            {/* Body */}
            <ellipse cx="100" cy="110" rx="70" ry="35" fill="#5BBCDD" />
            {/* Belly */}
            <ellipse cx="100" cy="118" rx="45" ry="20" fill="#AADEEE" />
            {/* Head */}
            <ellipse cx="155" cy="100" rx="35" ry="28" fill="#5BBCDD" />
            {/* Snout / beak */}
            <ellipse cx="188" cy="105" rx="16" ry="9" fill="#5BBCDD" />
            {/* Smile */}
            <path d="M178 110 Q188 116 198 110" stroke="#3A8FA8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            {/* Eye */}
            <circle cx="165" cy="95" r="5" fill="#1A3A4A" />
            <circle cx="167" cy="93" r="1.5" fill="white" />
            {/* Dorsal fin */}
            <path d="M100 80 Q115 45 130 75" fill="#4AA9CC" stroke="#3A8FA8" strokeWidth="1" />
            {/* Tail */}
            <path d="M30 110 Q10 90 5 75 Q20 85 30 80 Q20 95 30 110Z" fill="#4AA9CC" />
            <path d="M30 110 Q10 130 5 145 Q20 135 30 140 Q20 125 30 110Z" fill="#4AA9CC" />
            {/* Flipper */}
            <path d="M120 120 Q105 145 90 135 Q100 125 110 115Z" fill="#4AA9CC" />
            {/* Cheek blush */}
            <ellipse cx="158" cy="104" rx="8" ry="5" fill="#FF9BB5" opacity="0.5" />
            {/* Water splashes */}
            <path d="M60 145 Q65 135 70 145" stroke="#AEE4F0" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M80 150 Q87 138 94 150" stroke="#AEE4F0" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M40 152 Q46 143 52 152" stroke="#AEE4F0" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        </div>

        {/* Text */}
        <div className="flex flex-col gap-4">
          <h1 className="text-5xl font-bold text-white drop-shadow-lg tracking-tight">
            돌고래에 오신 걸
            <br />
            환영합니다! 🌊
          </h1>
          <p className="text-xl text-blue-100 font-medium drop-shadow">
            dolgorae.com — 곧 만나요
          </p>
        </div>

        {/* 바로가기 */}
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <Link
            href="/meetings/new"
            className="px-7 py-3 bg-white text-blue-600 font-bold rounded-full shadow-lg hover:bg-blue-50 transition-colors"
          >
            회의록 작성 ✍️
          </Link>
          <Link
            href="/meetings"
            className="px-7 py-3 bg-white/25 backdrop-blur-sm border border-white/40 text-white font-semibold rounded-full shadow-lg hover:bg-white/35 transition-colors"
          >
            회의록 목록 📋
          </Link>
        </div>

        {/* Logout */}
        <form action={logout} className="mt-6">
          <button
            type="submit"
            className="text-blue-100 text-sm underline underline-offset-2 hover:text-white transition-colors"
          >
            로그아웃
          </button>
        </form>
      </div>

      {/* Wave decoration bottom */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="w-full h-20">
          <path
            fill="rgba(255,255,255,0.15)"
            d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,20 1440,40 L1440,80 L0,80 Z"
          />
          <path
            fill="rgba(255,255,255,0.1)"
            d="M0,55 C480,20 960,70 1440,55 L1440,80 L0,80 Z"
          />
        </svg>
      </div>
    </main>
  );
}
