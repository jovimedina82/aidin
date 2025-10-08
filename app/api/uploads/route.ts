import { NextResponse } from 'next/server'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import crypto from 'node:crypto'
import sharp from 'sharp'
import { fileTypeFromBuffer } from 'file-type'

const MAX_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME = new Set(['image/png','image/jpeg','image/webp','image/gif'])

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Too large' }, { status: 413 })

    const buf = Buffer.from(await file.arrayBuffer())
    const ft = await fileTypeFromBuffer(buf)
    const mime = ft?.mime ?? file.type
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json({ error: 'Unsupported type' }, { status: 415 })
    }

    // Normalize to webp, strip EXIF
    const id = crypto.randomBytes(8).toString('hex')
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    await fs.mkdir(uploadDir, { recursive: true })
    const base = `img_${id}`
    const fullPath = path.join(uploadDir, `${base}.webp`)
    const thumbPath = path.join(uploadDir, `${base}_thumb.webp`)

    const image = sharp(buf, { failOn: 'none' }).rotate() // auto-orient
    const webp = image.webp({ quality: 86 })
    const metadata = await image.metadata()
    await webp.toFile(fullPath)

    // 480px wide thumbnail (contained)
    await image
      .resize({ width: 480, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(thumbPath)

    const url = `/uploads/${base}.webp`
    const thumb = `/uploads/${base}_thumb.webp`
    return NextResponse.json({
      url, thumb,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      mime: 'image/webp',
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
