import { Role, atLeast } from './roles';

export type ModuleKey = string;

export type AuthContext = {
  userId: string;
  email: string;
  role: Role;
  modules: ModuleKey[];
};

/**
 * Require user to have at least the specified role level
 * Admin always bypasses role checks
 * @throws Error with status 403 if insufficient permissions
 */
export function requireRole(ctx: AuthContext, required: Role): void {
  // Admin bypass - admin has access to everything
  if (ctx.role === 'admin') return;
  
  if (!atLeast(ctx.role, required)) {
    const error: any = new Error('FORBIDDEN: Insufficient role level');
    error.status = 403;
    error.code = 'INSUFFICIENT_ROLE';
    throw error;
  }
}

/**
 * Require user to have access to a specific module
 * Admin always bypasses module checks
 * @throws Error with status 403 if module not assigned
 */
export function requireModule(ctx: AuthContext, moduleKey: ModuleKey): void {
  // Admin bypass - admin has access to all modules
  if (ctx.role === 'admin') return;
  
  if (!ctx.modules.includes(moduleKey)) {
    const error: any = new Error(`FORBIDDEN: Module ${moduleKey} not assigned`);
    error.status = 403;
    error.code = 'MODULE_NOT_ASSIGNED';
    throw error;
  }
}

/**
 * Check if user has a specific module (non-throwing)
 */
export function hasModule(ctx: AuthContext, moduleKey: ModuleKey): boolean {
  if (ctx.role === 'admin') return true;
  return ctx.modules.includes(moduleKey);
}

/**
 * Check if user has at least a specific role (non-throwing)
 */
export function hasRole(ctx: AuthContext, required: Role): boolean {
  if (ctx.role === 'admin') return true;
  return atLeast(ctx.role, required);
}
