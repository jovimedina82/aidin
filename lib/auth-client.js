// Client-side authentication utilities (no Prisma imports)

export function getAuthToken() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('authToken')
  }
  return null
}

export function setAuthToken(token) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('authToken', token)
  }
}

export function removeAuthToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('authToken')
  }
}