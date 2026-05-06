'use client'

interface Props {
  text: string
  label?: string
}

export function CopyButton({ text, label = 'Copy' }: Props) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text)}
      className="text-[#333] text-xs hover:text-[#666]"
    >
      {label}
    </button>
  )
}
