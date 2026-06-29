'use client'

import { useEffect, useRef, useState } from 'react'
import {
  listArchiveFiles,
  uploadArchiveFile,
  deleteArchiveFile,
  type ArchiveFile,
} from '@/lib/supabase'

function formatSize(bytes: number): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// 표시용 파일명 — 업로드 시 붙인 타임스탬프 접두어 제거
function displayName(name: string): string {
  return name.replace(/^\d{10,}_/, '')
}

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['pdf'].includes(ext)) return '📄'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊'
  if (['doc', 'docx', 'hwp', 'hwpx'].includes(ext)) return '📝'
  if (['zip', 'rar', '7z'].includes(ext)) return '🗜️'
  if (['mp3', 'wav', 'm4a'].includes(ext)) return '🎵'
  if (['mp4', 'mov', 'avi'].includes(ext)) return '🎬'
  return '📎'
}

export default function FilesPage() {
  const [files, setFiles] = useState<ArchiveFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notConfigured, setNotConfigured] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function refresh() {
    setLoading(true)
    setError('')
    const result = await listArchiveFiles()
    if (result === null) {
      setNotConfigured(true)
      setFiles([])
    } else {
      setNotConfigured(false)
      setFiles(result)
    }
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setUploading(true)
    setError('')
    let failed = 0
    for (const file of Array.from(fileList)) {
      const res = await uploadArchiveFile(file)
      if (!res.ok) {
        failed++
        setError(res.error || '업로드에 실패했습니다.')
      }
    }
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    if (failed === 0) setError('')
    await refresh()
  }

  async function handleDelete(name: string) {
    if (!confirm(`"${displayName(name)}" 파일을 삭제할까요?`)) return
    const ok = await deleteArchiveFile(name)
    if (!ok) {
      setError('삭제에 실패했습니다.')
      return
    }
    await refresh()
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-slate-800">📁 자료실</h1>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading || notConfigured}
          className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {uploading && (
            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {uploading ? '업로드 중…' : '+ 파일 업로드'}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => void handleUpload(e.target.files)}
        />
      </div>

      {/* 드래그앤드롭 영역 */}
      {!notConfigured && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            void handleUpload(e.dataTransfer.files)
          }}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 rounded-xl py-10 text-center text-slate-400 hover:border-blue-400 hover:text-blue-500 cursor-pointer transition-colors"
        >
          <p className="text-3xl mb-2">⬆️</p>
          <p className="text-sm">여기로 파일을 끌어다 놓거나 클릭해서 업로드하세요</p>
          <p className="text-xs mt-1">PDF, 이미지, 엑셀, 한글 등 모든 파일 (여러 개 동시 가능)</p>
        </div>
      )}

      {notConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">Supabase가 아직 설정되지 않았습니다.</p>
          <p className="text-xs">
            Vercel 환경변수에 <code className="font-mono">VITE_SUPABASE_URL</code>,{' '}
            <code className="font-mono">VITE_SUPABASE_ANON_KEY</code>를 추가하고,
            Supabase에서 <code className="font-mono">archive</code> 스토리지 버킷을 생성한 뒤
            Redeploy 하세요.
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* 파일 목록 */}
      {loading ? (
        <p className="text-slate-400 text-sm text-center py-10">불러오는 중…</p>
      ) : files.length === 0 && !notConfigured ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">🗂️</p>
          <p>아직 업로드된 파일이 없습니다.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {files.map((f) => (
            <div
              key={f.name}
              className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3 hover:border-blue-300 transition-colors"
            >
              <span className="text-2xl shrink-0">{fileIcon(f.name)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {displayName(f.name)}
                </p>
                <p className="text-xs text-slate-400">
                  {formatSize(f.size)}
                  {f.createdAt &&
                    ` · ${new Date(f.createdAt).toLocaleString('ko-KR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}`}
                </p>
              </div>
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="px-3 py-1.5 rounded-full border border-slate-300 text-slate-600 text-xs hover:bg-slate-50 shrink-0"
              >
                다운로드
              </a>
              <button
                onClick={() => void handleDelete(f.name)}
                className="px-3 py-1.5 rounded-full border border-red-300 text-red-500 text-xs hover:bg-red-50 shrink-0"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
