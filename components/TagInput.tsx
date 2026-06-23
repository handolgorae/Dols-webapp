'use client'

import { useState } from 'react'

interface TagInputProps {
  label: string
  placeholder?: string
  tags: string[]
  onChange: (tags: string[]) => void
}

export default function TagInput({ label, placeholder, tags, onChange }: TagInputProps) {
  const [value, setValue] = useState('')

  function addTag() {
    const v = value.trim()
    if (v && !tags.includes(v)) {
      onChange([...tags, v])
    }
    setValue('')
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="flex flex-wrap gap-2 items-center rounded-lg border border-slate-300 px-2 py-2 bg-white focus-within:ring-2 focus-within:ring-blue-400">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-sm px-2 py-0.5 rounded-full"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-blue-400 hover:text-blue-700 font-bold leading-none"
              aria-label={`${tag} 삭제`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={value}
          placeholder={tags.length === 0 ? placeholder : ''}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              addTag()
            } else if (e.key === 'Backspace' && value === '' && tags.length > 0) {
              removeTag(tags[tags.length - 1])
            }
          }}
          onBlur={addTag}
          className="flex-1 min-w-[120px] outline-none text-sm py-0.5 text-slate-800"
        />
      </div>
    </div>
  )
}
