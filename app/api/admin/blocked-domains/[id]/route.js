import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * DELETE /api/admin/blocked-domains/{id}
 * Remove a blocked email domain (unblock it)
 */
export async function DELETE(request, { params }) {
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
      return NextResponse.json({ error: 'Only admins can unblock domains' }, { status: 403 })
    }

    const domainId = params.id

    // Get the domain before deleting
    const domain = await prisma.blockedEmailDomain.findUnique({
      where: { id: domainId }
    })

    if (!domain) {
      return NextResponse.json({ error: 'Blocked domain not found' }, { status: 404 })
    }

    // Delete the blocked domain
    await prisma.blockedEmailDomain.delete({
      where: { id: domainId }
    })

    console.log(`✅ Domain unblocked: ${domain.domain} by ${user.email}`)

    return NextResponse.json({
      success: true,
      message: `Domain ${domain.domain} has been unblocked`,
      domain: domain.domain
    })

  } catch (error) {
    console.error('Error unblocking domain:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to unblock domain' },
      { status: 500 }
    )
  }
}
