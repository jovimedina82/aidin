'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ClearAuthPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Clearing authentication...')

  useEffect(() => {
    // Clear the auth cookie by calling logout
    fetch('/api/auth/logout', { method: 'POST' })
      .then(() => {
        // Also clear from client side just in case
        document.cookie = 'aidin_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
        setStatus('Authentication cleared! Redirecting to login...')
        setTimeout(() => {
          router.push('/login')
        }, 1500)
      })
      .catch(() => {
        setStatus('Error clearing auth. Please clear cookies manually.')
      })
  }, [router])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f3f4f6'
    }}>
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '0.5rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        <h1 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>Clearing Authentication</h1>
        <p>{status}</p>
      </div>
    </div>
  )
}
