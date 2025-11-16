import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { logEvent } from '@/lib/audit'
import logger from '@/lib/logger'

export async function POST(request) {
  let userEmail = null

  try {
    const { email, password, firstName, lastName } = await request.json()
    userEmail = email

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // SECURITY: Rate limiting to prevent brute force attacks and enumeration
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

    const rateLimit = await checkRateLimit(clientIp, '/api/auth/register', {
      maxRequests: 5, // 5 attempts per hour
      windowMs: 3600000 // 1 hour (stricter than login)
    })

    if (!rateLimit.allowed) {
      logger.warn('Registration rate limit exceeded', {
        ip: clientIp,
        email: email,
        retryAfter: rateLimit.retryAfter
      })

      await logEvent({
        action: 'register.rate_limited',
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
          error: 'Too many registration attempts. Please try again later.',
          retryAfter: rateLimit.retryAfter
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfter || 3600) }
        }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      // Log attempt but don't reveal exact reason (prevents enumeration)
      logger.info('Registration attempt for existing email', {
        ip: clientIp
      })

      return NextResponse.json(
        { error: 'Registration failed. Please check your information.' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Get default role (Requester)
    const requesterRole = await prisma.role.findFirst({
      where: { name: 'Requester' }
    }) || await prisma.role.create({
      data: {
        name: 'Requester',
        description: 'Default user role',
        permissions: { tickets: { create: true, viewOwn: true } }
      }
    })

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        roles: {
          create: {
            roleId: requesterRole.id
          }
        }
      },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    })

    // SECURITY: Fail hard if JWT_SECRET not set
    if (!process.env.JWT_SECRET) {
      logger.error('JWT_SECRET not configured')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Create JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles.map(ur => ur.role.name)
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Log successful registration
    await logEvent({
      action: 'register.success',
      actorId: user.id,
      actorEmail: user.email,
      actorType: 'human',
      entityType: 'user',
      entityId: user.id,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || null,
      metadata: {
        timestamp: new Date().toISOString()
      }
    })

    logger.info('User registered successfully', {
      userId: user.id,
      email: user.email
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
    logger.error('Registration error', error, { email: userEmail })

    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    )
  }
}