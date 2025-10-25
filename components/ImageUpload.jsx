'use client'
import React, { useRef, useState } from 'react'
import { toast } from 'sonner'

export default function ImageUpload({ onUploadedMarkdown, targetTextAreaSelector, className }) {
  const [isOver, setIsOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef(null)

  const uploadFile = async (file) => {
    try {
      setUploading(true)
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/uploads', { method: 'POST', body: fd })

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(error.error || `Upload failed with status ${res.status}`)
      }

      const data = await res.json()
      if (!data.url) {
        throw new Error('Upload response missing URL')
      }

      const { url } = data
      const md = `![image](${url})`

      if (targetTextAreaSelector) {
        const el = document.querySelector(targetTextAreaSelector)
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

      if (onUploadedMarkdown) onUploadedMarkdown(md)
      toast.success('Image uploaded successfully')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload image')
      throw error
    } finally {
      setUploading(false)
    }
  }

  const handleFiles = async (files) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))

    if (imageFiles.length === 0) {
      toast.error('Please select image files only')
      return
    }

    for (const f of imageFiles) {
      try {
        await uploadFile(f)
      } catch (error) {
        break
      }
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsOver(false)
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files)
  }

  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const it of Array.from(items)) {
      if (it.type.startsWith('image/')) {
        const file = it.getAsFile()
        if (file) uploadFile(file)
      }
    }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsOver(true) }}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
      onPaste={handlePaste}
      className={[
        'rounded-xl border border-dashed transition-all',
        isOver ? 'border-blue-400 bg-blue-50' : 'border-neutral-300 bg-neutral-50',
        'p-3 text-sm text-neutral-500',
        'flex items-center justify-between gap-3',
        uploading ? 'opacity-75 pointer-events-none' : '',
        className ?? ''
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-neutral-700">Images</span>
        <span className="hidden md:inline">
          {uploading ? 'Uploading image...' : 'Drag & drop or paste images here. They\'ll be inserted into the message.'}
        </span>
      </div>
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="px-3 py-1.5 rounded-lg bg-neutral-800 text-white hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Uploading…' : 'Upload…'}
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
