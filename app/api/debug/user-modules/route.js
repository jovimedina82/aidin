import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getUserModules } from '@/lib/module-access'
import { prisma } from '@/lib/prisma'

// GET /api/debug/user-modules - Debug endpoint to check user module access
export async function GET(request) {
  try {
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get user with roles
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    })

    // Get role IDs
    const roleIds = fullUser.roles.map(ur => ur.roleId)

    // Get all modules
    const allModules = await prisma.module.findMany({
      where: { isActive: true },
      include: {
        userModuleAccess: {
          where: { userId: user.id }
        },
        roleModuleAccess: {
          where: {
            roleId: { in: roleIds }
          }
        }
      },
      orderBy: { key: 'asc' }
    })

    // Get accessible modules using the getUserModules function
    const accessibleModules = await getUserModules(fullUser)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      },
      roles: fullUser.roles.map(ur => ({
        id: ur.roleId,
        name: ur.role.name
      })),
      roleIds,
      allModules: allModules.map(m => ({
        id: m.id,
        key: m.key,
        name: m.name,
        isCore: m.isCore,
        isActive: m.isActive,
        userOverrides: m.userModuleAccess.map(uma => ({
          hasAccess: uma.hasAccess,
          grantedBy: uma.grantedBy
        })),
        roleAccess: m.roleModuleAccess.map(rma => ({
          roleId: rma.roleId,
          hasAccess: rma.hasAccess
        }))
      })),
      accessibleModuleKeys: accessibleModules.map(m => m.key),
      accessibleModulesCount: accessibleModules.length
    })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
