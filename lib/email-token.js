import crypto from 'crypto'

const SECRET = process.env.EMAIL_ACTION_SECRET || 'your-secret-key-change-in-production'

/**
 * Generate a secure token for email actions
 * @param {string} ticketId - The ticket ID
 * @param {string} action - The action (e.g., 'mark-solved')
 * @param {number} expiresInDays - How many days the token is valid (default: 30)
 * @returns {string} - The secure token
 */
export function generateEmailActionToken(ticketId, action = 'mark-solved', expiresInDays = 30) {
  const expiresAt = Date.now() + (expiresInDays * 24 * 60 * 60 * 1000)
  const payload = `${ticketId}:${action}:${expiresAt}`

  // Create HMAC signature
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(payload)
    .digest('hex')

  // Encode payload and signature
  const token = Buffer.from(`${payload}:${signature}`).toString('base64url')

  return token
}

/**
 * Verify and decode an email action token
 * @param {string} token - The token to verify
 * @returns {object|null} - {ticketId, action} if valid, null if invalid
 */
export function verifyEmailActionToken(token) {
  try {
    // Decode token
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    const parts = decoded.split(':')

    if (parts.length !== 4) {
      return null
    }

    const [ticketId, action, expiresAt, signature] = parts

    // Check expiration
    if (Date.now() > parseInt(expiresAt)) {
      return null
    }

    // Verify signature
    const payload = `${ticketId}:${action}:${expiresAt}`
    const expectedSignature = crypto
      .createHmac('sha256', SECRET)
      .update(payload)
      .digest('hex')

    if (signature !== expectedSignature) {
      return null
    }

    return { ticketId, action }
  } catch (error) {
    console.error('Failed to verify email action token:', error)
    return null
  }
}
