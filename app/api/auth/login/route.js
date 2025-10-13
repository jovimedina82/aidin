import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { logEvent } from '@/lib/audit'
import { checkRateLimit } from '@/lib/security/rate-limit'

export async function POST(request) {
  let userEmail = null
  let userId = null

  try {
    const { email, password } = await request.json()
    userEmail = email

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // SECURITY: Rate limiting to prevent brute force attacks
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const identifier = `${clientIp}:${email}` // Rate limit per IP + email combination

    const rateLimit = await checkRateLimit(identifier, '/api/auth/login', {
      maxRequests: 5, // 5 attempts
      windowMs: 900000 // per 15 minutes
    })

    if (!rateLimit.allowed) {
      await logEvent({
        action: 'login.rate_limited',
        actorEmail: email,
        actorType: 'human',
        entityType: 'user',
        entityId: email,
        ip: clientIp,
        metadata: {
          reason: 'rate_limit_exceeded',
          retryAfter: rateLimit.retryAfter
        }
      })

      return NextResponse.json(
        {
          error: 'Too many login attempts. Please try again later.',
          retryAfter: rateLimit.retryAfter
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfter || 900) }
        }
      )
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    })

    if (!user) {
      // Log failed login attempt
      await logEvent({
        action: 'login.failed',
        actorEmail: email,
        actorType: 'human',
        entityType: 'user',
        entityId: email,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || null,
        metadata: {
          reason: 'user_not_found',
          timestamp: new Date().toISOString()
        }
      })

      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    userId = user.id

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      // Log failed login attempt
      await logEvent({
        action: 'login.failed',
        actorId: user.id,
        actorEmail: user.email,
        actorType: 'human',
        entityType: 'user',
        entityId: user.email,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || null,
        metadata: {
          reason: 'invalid_password',
          timestamp: new Date().toISOString()
        }
      })

      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    // Create JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles.map(ur => ur.role.name)
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    )

    // Log successful login
    await logEvent({
      action: 'login.success',
      actorId: user.id,
      actorEmail: user.email,
      actorType: 'human',
      entityType: 'user',
      entityId: user.email,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || null,
      metadata: {
        method: 'password',
        timestamp: new Date().toISOString()
      }
    })

    // Remove password from user object
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json({
      success: true,
      token,
      user: {
        ...userWithoutPassword,
        roles: user.roles.map(ur => ur.role.name)
      }
    })

  } catch (error) {
    console.error('Login error:', error)

    // Log login error
    if (userEmail) {
      try {
        await logEvent({
          action: 'login.error',
          actorId: userId,
          actorEmail: userEmail,
          actorType: 'human',
          entityType: 'user',
          entityId: userEmail,
          metadata: {
            error: error.message,
            timestamp: new Date().toISOString()
          }
        })
      } catch (logError) {
        console.error('Failed to log login error:', logError)
      }
    }

    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}