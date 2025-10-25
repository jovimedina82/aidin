import { z } from 'zod';
import { PrismaClient } from '@/lib/generated/prisma';
import { json, parseOrThrow, handleError } from '@/lib/validation/http';
import { requireRole } from '@/lib/auth/guards';

const prisma = new PrismaClient();

const PutSchema = z.object({
  userId: z.string().min(1),
  modules: z.array(z.string()).max(128),
});

/**
 * GET /api/admin/user-modules?userId=xxx
 * Get module assignments for a specific user
 * Requires admin role
 */
export async function GET(req: Request) {
  try {
    // TODO: Extract auth context from request
    const ctx = { auth: { userId: 'system', email: 'system', role: 'admin' as const, modules: [] } };
    
    requireRole(ctx.auth, 'admin');
    
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return json(400, { error: 'userId query parameter required' });
    }
    
    const row = await prisma.userModule.findUnique({
      where: { userId },
    });
    
    return json(200, row ?? { userId, modules: [] });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PUT /api/admin/user-modules
 * Upsert module assignments for a specific user
 * Requires admin role
 */
export async function PUT(req: Request) {
  try {
    // TODO: Extract auth context from request
    const ctx = { auth: { userId: 'system', email: 'system', role: 'admin' as const, modules: [] } };
    
    requireRole(ctx.auth, 'admin');
    
    const data = parseOrThrow(PutSchema, await req.json());
    
    await prisma.userModule.upsert({
      where: { userId: data.userId },
      update: { modules: data.modules },
      create: { userId: data.userId, modules: data.modules },
    });
    
    return json(200, { ok: true });
  } catch (error) {
    return handleError(error);
  }
}
