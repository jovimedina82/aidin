import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from './prisma.js'
import { cache, CacheKeys, CacheTTL } from './cache.js'

// CRITICAL: JWT_SECRET must be set in environment variables
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable is required. Application cannot start without it.')
}

export async function hashPassword(password) {
  return await bcrypt.hash(password, 12)
}

export async function verifyPassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword)
}

export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error) {
    return null
  }
}

/**
 * Get user from cache or database
 * This dramatically reduces database load
 */
async function getUserById(userId) {
  return cache.getOrSet(
    CacheKeys.USER_BY_ID(userId),
    async () => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          roles: {
            include: {
              role: true
            }
          }
        }
      })
      return user
    },
    CacheTTL.USER
  )
}

export async function getCurrentUser(request) {
  try {
    // Try to get token from Authorization header first
    let token = null
    const authHeader = request.headers.get('authorization')

    // Get auth token from header or cookies
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    } else {
      // Try new cookie name first, then fall back to old cookie name
      token = request.cookies.get('aidin_token')?.value || request.cookies.get('authToken')?.value
    }

    if (!token) {
      return null
    }

    // Create a hash of the token for cache key (don't store raw tokens)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 16)

    // Check cache first (avoids JWT verification + DB lookup)
    const cachedUser = cache.get(CacheKeys.USER_BY_TOKEN(tokenHash))
    if (cachedUser) {
      return cachedUser
    }

    // Verify token
    const decoded = verifyToken(token)

    if (!decoded) {
      return null
    }

    // For dev-login tokens that don't have userId in DB
    if (decoded.email && !decoded.userId) {
      // Return user object from JWT payload (dev-login format)
      const devUser = {
        id: decoded.id || decoded.email,
        email: decoded.email,
        name: decoded.name || 'User',
        isActive: true,
        roles: (decoded.roles || []).map(roleName => ({
          role: { name: roleName }
        }))
      }

      // Cache the dev user
      cache.set(CacheKeys.USER_BY_TOKEN(tokenHash), devUser, CacheTTL.USER)
      return devUser
    }

    // For database users with userId
    const userId = decoded.userId || decoded.id
    if (!userId) {
      return null
    }

    // Get user from cache or database
    const user = await getUserById(userId)

    if (!user) {
      return null
    }

    if (!user.isActive) {
      return null
    }

    // Cache the user with the token hash
    cache.set(CacheKeys.USER_BY_TOKEN(tokenHash), user, CacheTTL.USER)

    return user
  } catch (error) {
    return null
  }
}

/**
 * Invalidate user cache (call this when user data changes)
 */
export function invalidateUserCache(userId) {
  cache.delete(CacheKeys.USER_BY_ID(userId))
  // Note: Token-based cache will naturally expire
}