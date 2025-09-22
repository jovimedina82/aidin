import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(request, { params }) {
  try {
    const { filename } = params

    // Security: Only allow image files with specific extensions
    if (!filename || !filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return new NextResponse('Invalid file type', { status: 400 })
    }

    // Security: Prevent path traversal attacks
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return new NextResponse('Invalid filename', { status: 400 })
    }

    const filePath = join(process.cwd(), 'public', 'avatars', filename)

    try {
      const fileBuffer = await readFile(filePath)

      // Determine content type based on file extension
      const ext = filename.split('.').pop().toLowerCase()
      const contentType = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp'
      }[ext] || 'image/jpeg'

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400', // Cache for 1 day
          'Content-Length': fileBuffer.length.toString()
        }
      })
    } catch (fileError) {
      // File not found
      return new NextResponse('Avatar not found', { status: 404 })
    }
  } catch (error) {
    console.error('Error serving avatar:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}