import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma.js'

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

    // Verify token
    const decoded = verifyToken(token)

    if (!decoded) {
      return null
    }

    // For dev-login tokens that don't have userId in DB
    if (decoded.email && !decoded.userId) {
      // Return user object from JWT payload (dev-login format)
      return {
        id: decoded.id || decoded.email,
        email: decoded.email,
        name: decoded.name || 'User',
        isActive: true,
        roles: (decoded.roles || []).map(roleName => ({
          role: { name: roleName }
        }))
      }
    }

    // For database users with userId
    const userId = decoded.userId || decoded.id
    if (!userId) {
      return null
    }

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

    if (!user) {
      return null
    }

    if (!user.isActive) {
      return null
    }

    return user
  } catch (error) {
    return null
  }
}