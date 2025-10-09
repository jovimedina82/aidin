'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { getAuthToken, setAuthToken, removeAuthToken } from '../lib/auth-client.js'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setTokenState] = useState(null)

  useEffect(() => {
    // Add a small delay to ensure client-side hydration completes
    const timer = setTimeout(() => {
      checkAuth()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  const checkAuth = async () => {
    try {
      // Try to authenticate with cookie-based auth with a timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000) // 2 second timeout

      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (response.ok) {
          const data = await response.json()
          setUser(data.user)
          setTokenState('cookie-based')
        } else {
          // Only clear user if we get a 401 (unauthorized)
          if (response.status === 401) {
            setUser(null)
            setTokenState(null)
          }
        }
      } catch (fetchError) {
        clearTimeout(timeoutId)
        // Silently handle auth check errors in production
        if (process.env.NODE_ENV === 'development') {
          if (fetchError.name === 'AbortError') {
            console.error('Auth check timed out')
          } else {
            console.error('Auth check error:', fetchError)
          }
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Auth check error:', error)
      }
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }

      setAuthToken(data.token)
      setUser(data.user)
      setTokenState(data.token)
      
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  const register = async (userData) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed')
      }

      setAuthToken(data.token)
      setUser(data.user)
      setTokenState(data.token)
      
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Logout API call failed:', error)
      }
    }
    
    removeAuthToken()
    setUser(null)
    setTokenState(null)
  }

  const makeAuthenticatedRequest = async (url, options = {}) => {
    const token = getAuthToken()

    // Build headers correctly - DON'T set Content-Type for FormData
    const headers = {
      ...options.headers  // Spread options.headers FIRST
    }

    // Only set Content-Type for JSON if body is not FormData
    // When body is FormData, browser will automatically set multipart/form-data with boundary
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }

    // ALWAYS add Authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers  // Headers go LAST to override everything
    })
    return response
  }

  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
      logout,
      loading,
      makeAuthenticatedRequest,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}