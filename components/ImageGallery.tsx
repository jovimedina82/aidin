'use client'
import Image from 'next/image'
import React, { useState } from 'react'

type Item = { url: string, thumb?: string, alt?: string }
type Props = { images: Item[] }

export default function ImageGallery({ images }: Props) {
  const [open, setOpen] = useState<number | null>(null)
  if (!images?.length) return null

  return (
    <div className="mt-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((it, i) => (
          <button
            key={i}
            onClick={() => setOpen(i)}
            className="group relative aspect-video overflow-hidden rounded-xl border border-neutral-200 bg-white"
          >
            <Image
              src={it.thumb ?? it.url}
              alt={it.alt ?? 'attachment'}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover transition-transform group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {open !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(null)}
        >
          <div className="relative w-full max-w-4xl aspect-video">
            <Image
              src={images[open].url}
              alt={images[open].alt ?? 'attachment'}
              fill
              sizes="90vw"
              className="object-contain rounded-xl"
            />
            <button
              type="button"
              className="absolute -top-3 -right-3 bg-white rounded-full px-3 py-1 shadow"
              onClick={() => setOpen(null)}
            >Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
