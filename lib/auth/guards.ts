import { getCurrentUser } from '../auth.js'
import { hasModuleAccess } from '../module-access'
import { isAdmin } from '../role-utils'
import { NextResponse } from 'next/server'

/**
 * Require module access with admin bypass
 * Admins (Admin/Manager roles) bypass module checks
 *
 * @param request - Next.js Request object
 * @param moduleKey - Module key to check (e.g., 'staff-directory')
 * @returns User object if authorized, throws Response if not
 */
export async function requireModule(request: Request, moduleKey: string) {
  const user = await getCurrentUser(request)

  if (!user) {
    throw NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Admin bypass: Admin and Manager roles can access all modules
  if (isAdmin(user)) {
    return user
  }

  // Check module access for non-admin users
  const hasAccess = await hasModuleAccess(user, moduleKey)

  if (!hasAccess) {
    throw NextResponse.json(
      { error: 'Forbidden: You do not have access to this module' },
      { status: 403 }
    )
  }

  return user
}
