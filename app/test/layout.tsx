import Nav from '@/components/Nav'

export default function TestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Nav />
      {children}
    </div>
  )
}
