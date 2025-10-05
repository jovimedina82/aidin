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
      // Token from Bearer header
    } else {
      // If no Authorization header, try to get from cookies
      token = request.cookies.get('authToken')?.value
      // Token from cookies
    }

    if (!token) {
      // No token found
      return null
    }

    // Verify token
    const decoded = verifyToken(token)

    if (!decoded?.userId) {
      // Invalid token
      return null
    }

    // Token valid

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    })

    if (!user) {
      // User not found
      return null
    }

    if (!user.isActive) {
      // User inactive
      return null
    }

    // User authenticated
    return user
  } catch (error) {
    // Error in auth
    return null
  }
}