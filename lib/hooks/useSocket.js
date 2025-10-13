import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

export function useSocket() {
  const socketRef = useRef(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isEnabled, setIsEnabled] = useState(false)

  useEffect(() => {
    // Check if live updates are enabled via feature flag
    const enabled = process.env.NEXT_PUBLIC_ENABLE_LIVE_UPDATES === 'true'
    setIsEnabled(enabled)

    if (!enabled) {
      return
    }

    // Only connect if we don't have an active socket
    if (socketRef.current?.connected) {
      return
    }

    // Initialize Socket.IO connection with cache-busting query parameter
    const socket = io({
      path: '/api/socket',
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      withCredentials: true, // Send cookies for authentication
      query: {
        _t: Date.now() // Cache-busting timestamp
      }
    })

    socket.on('connect', () => {
      setIsConnected(true)
    })

    socket.on('disconnect', (reason) => {
      setIsConnected(false)
    })

    socket.on('connect_error', (error) => {
      // console.error('Socket.IO connection error:', error.message)
      setIsConnected(false)
    })

    socketRef.current = socket

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [])

  const on = (event, handler) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler)
    }
  }

  const off = (event, handler) => {
    if (socketRef.current) {
      socketRef.current.off(event, handler)
    }
  }

  return {
    socket: socketRef.current,
    isConnected,
    isEnabled,
    on,
    off
  }
}
