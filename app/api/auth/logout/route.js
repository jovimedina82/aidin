import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const response = NextResponse.json({ success: true })
    
    // Clear the auth cookie
    response.cookies.set('authToken', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 0, // Immediately expire
      path: '/'
    })

    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}