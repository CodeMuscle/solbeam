'use client'

import { useState } from 'react'

interface Props {
  keywords: string[]
  onChange: (keywords: string[]) => void
}

export function KeywordEditor({ keywords, onChange }: Props) {
  const [input, setInput] = useState('')

  function addKeyword() {
    const kw = input.trim().toUpperCase()
    if (!kw || keywords.includes(kw)) return
    onChange([...keywords, kw])
    setInput('')
  }

  function removeKeyword(kw: string) {
    onChange(keywords.filter((k) => k !== kw))
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {keywords.map((kw) => (
          <span
            key={kw}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-[#111] border border-[#1e1e1e] rounded text-[#888]"
          >
            {kw}
            <button
              onClick={() => removeKeyword(kw)}
              className="text-[#444] hover:text-red-400 ml-1"
            >
              ✕
            </button>
          </span>
        ))}
        {keywords.length === 0 && (
          <span className="text-[#333] text-xs">No keywords yet</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
          placeholder="Add keyword (e.g. AI)"
          className="flex-1 bg-[#111] border border-[#1e1e1e] text-[#ccc] text-xs rounded px-3 py-1.5 outline-none focus:border-[#2a2a2a] placeholder-[#333]"
        />
        <button
          onClick={addKeyword}
          className="text-xs px-3 py-1.5 rounded border border-[#2a2a2a] text-[#666] hover:text-[#aaa] transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  )
}
