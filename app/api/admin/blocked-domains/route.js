import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * GET /api/admin/blocked-domains
 * List all blocked email domains
 */
export async function GET(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin/manager
    const userRoles = user.roles || []
    const roleNames = userRoles.map(r => r.role?.name || r.name || r)
    const isAdmin = roleNames.some(role => ['Admin', 'Manager'].includes(role))

    if (!isAdmin) {
      return NextResponse.json({ error: 'Only admins can view blocked domains' }, { status: 403 })
    }

    // Get all blocked domains with user info
    const blockedDomains = await prisma.blockedEmailDomain.findMany({
      orderBy: {
        blockedAt: 'desc'
      }
    })

    // Get user info for blockedBy
    const userIds = [...new Set(blockedDomains.map(d => d.blockedBy))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      }
    })

    const userMap = Object.fromEntries(users.map(u => [u.id, u]))

    // Enrich blocked domains with user info
    const enrichedDomains = blockedDomains.map(domain => ({
      ...domain,
      blockedByUser: userMap[domain.blockedBy] || null
    }))

    return NextResponse.json({
      domains: enrichedDomains,
      count: enrichedDomains.length
    })

  } catch (error) {
    console.error('Error fetching blocked domains:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch blocked domains' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/blocked-domains
 * Add a new blocked email domain
 */
export async function POST(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin/manager
    const userRoles = user.roles || []
    const roleNames = userRoles.map(r => r.role?.name || r.name || r)
    const isAdmin = roleNames.some(role => ['Admin', 'Manager'].includes(role))

    if (!isAdmin) {
      return NextResponse.json({ error: 'Only admins can block domains' }, { status: 403 })
    }

    const { domain, reason } = await request.json()

    if (!domain) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 })
    }

    // Normalize domain to lowercase
    const normalizedDomain = domain.toLowerCase().trim()

    // Check if domain already exists
    const existing = await prisma.blockedEmailDomain.findUnique({
      where: { domain: normalizedDomain }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Domain is already blocked' },
        { status: 409 }
      )
    }

    // Create blocked domain
    const blockedDomain = await prisma.blockedEmailDomain.create({
      data: {
        domain: normalizedDomain,
        reason: reason || 'Vendor/spam emails',
        blockedBy: user.id,
        blockedAt: new Date()
      }
    })

    console.log(`🚫 Domain blocked: ${normalizedDomain} by ${user.email}`)

    return NextResponse.json({
      success: true,
      domain: blockedDomain
    })

  } catch (error) {
    console.error('Error blocking domain:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to block domain' },
      { status: 500 }
    )
  }
}
