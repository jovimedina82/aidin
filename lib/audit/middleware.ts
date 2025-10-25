import { writeAudit, AuditEntry } from './logger';
import { AuthContext } from '../auth/guards';

export type RequestContext = {
  auth: AuthContext;
  before?: any;
  after?: any;
  entityId?: string;
  ip?: string;
  ua?: string;
};

export type MutatingHandler = (args: {
  req: Request;
  ctx: RequestContext;
}) => Promise<Response>;

/**
 * Wrap a mutating API handler with audit logging
 * Automatically logs the operation after successful completion
 */
export function withAudit(
  action: string,
  entity: string,
  handler: MutatingHandler
): MutatingHandler {
  return async ({ req, ctx }) => {
    const before = ctx.before ?? null;
    
    // Execute the handler
    const res = await handler({ req, ctx });
    
    // Only log if successful (2xx status)
    if (res.status >= 200 && res.status < 300) {
      try {
        const after = ctx.after ?? null;
        
        await writeAudit({
          actorId: ctx.auth.userId,
          actorEmail: ctx.auth.email,
          role: ctx.auth.role,
          action,
          entity,
          entityId: ctx.entityId,
          before,
          after,
          ip: ctx.ip,
          ua: ctx.ua,
        });
      } catch (auditError) {
        // Log audit failure but don't fail the request
        console.error('Audit logging failed:', auditError);
      }
    }
    
    return res;
  };
}

/**
 * Extract IP and User-Agent from request headers
 */
export function extractRequestMeta(req: Request): { ip?: string; ua?: string } {
  return {
    ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
    ua: req.headers.get('user-agent') || undefined,
  };
}
