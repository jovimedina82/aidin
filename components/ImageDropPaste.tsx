'use client'
import React, { useCallback, useRef, useState } from 'react'

type Props = {
  onUploadedMarkdown?: (md: string) => void
  targetTextAreaSelector?: string // if provided, will insert at caret
  className?: string
}

export default function ImageDropPaste({ onUploadedMarkdown, targetTextAreaSelector, className }: Props) {
  const [isOver, setIsOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const uploadFile = async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/uploads', { method: 'POST', body: fd })
    if (!res.ok) throw new Error('Upload failed')
    const { url } = await res.json()
    const md = `![image](${url})`
    if (targetTextAreaSelector) {
      const el = document.querySelector<HTMLTextAreaElement>(targetTextAreaSelector)
      if (el) {
        const start = el.selectionStart ?? el.value.length
        const end = el.selectionEnd ?? el.value.length
        const before = el.value.slice(0, start)
        const after = el.value.slice(end)
        el.value = `${before}${md}\n${after}`
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.focus()
        el.selectionStart = el.selectionEnd = start + md.length + 1
      }
    }
    onUploadedMarkdown?.(md)
  }

  const handleFiles = async (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue
      await uploadFile(f)
    }
  }

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsOver(false)
    if (e.dataTransfer.files?.length) await handleFiles(e.dataTransfer.files)
  }, [])

  const onPaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const it of Array.from(items)) {
      if (it.type.startsWith('image/')) {
        const file = it.getAsFile()
        if (file) await uploadFile(file)
      }
    }
  }, [])

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsOver(true) }}
      onDragLeave={() => setIsOver(false)}
      onDrop={onDrop}
      onPaste={onPaste}
      className={[
        'rounded-xl border border-dashed transition-all',
        isOver ? 'border-blue-400 bg-blue-50' : 'border-neutral-300 bg-neutral-50',
        'p-3 text-sm text-neutral-500',
        'flex items-center justify-between gap-3',
        className ?? ''
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-neutral-700">Images</span>
        <span className="hidden md:inline">Drag & drop or paste images here. They'll be inserted into the message.</span>
      </div>
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="px-3 py-1.5 rounded-lg bg-neutral-800 text-white hover:bg-black"
        >
          Upload…
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>
    </div>
  )
}
