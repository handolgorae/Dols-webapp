import Nav from '@/components/Nav'

export default function FilesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Nav />
      <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
    </div>
  )
}
