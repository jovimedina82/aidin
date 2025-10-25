import { z } from 'zod';
import { PrismaClient } from '@/lib/generated/prisma';
import { json, parseOrThrow, handleError } from '@/lib/validation/http';
import { requireRole } from '@/lib/auth/guards';

const prisma = new PrismaClient();

const PutSchema = z.object({
  role: z.enum(['requester', 'staff', 'manager', 'admin']),
  modules: z.array(z.string()).max(64),
});

/**
 * GET /api/admin/role-modules
 * Returns all role-level module assignments
 */
export async function GET() {
  try {
    const rows = await prisma.roleModule.findMany({
      orderBy: { role: 'asc' },
    });
    return json(200, rows);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PUT /api/admin/role-modules
 * Upsert module assignments for a specific role
 * Requires admin role
 */
export async function PUT(req: Request) {
  try {
    // TODO: Extract auth context from request
    // For now, this is a placeholder - auth middleware would set this
    const ctx = { auth: { userId: 'system', email: 'system', role: 'admin' as const, modules: [] } };
    
    requireRole(ctx.auth, 'admin');
    
    const data = parseOrThrow(PutSchema, await req.json());
    
    await prisma.roleModule.upsert({
      where: { role: data.role },
      update: { modules: data.modules },
      create: { role: data.role, modules: data.modules },
    });
    
    return json(200, { ok: true });
  } catch (error) {
    return handleError(error);
  }
}
