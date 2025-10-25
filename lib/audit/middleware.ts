/**
 * HTTP Middleware for audit logging
 * Captures request context for Next.js API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
import { setAuditContext, runWithAuditContext } from './context';

/**
 * Next.js middleware for Edge/App Router
 */
export function auditMiddleware(request: NextRequest) {
  const requestId =
    request.headers.get('x-request-id') ||
    request.headers.get('x-correlation-id') ||
    randomUUID();

  const correlationId =
    request.headers.get('x-correlation-id') || randomUUID();

  // Extract IP from various headers (Cloudflare, nginx, etc.)
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.ip ||
    null;

  const userAgent = request.headers.get('user-agent') || null;

  // Set context
  setAuditContext({
    requestId,
    correlationId,
    ip,
    userAgent,
  });

  // Add request ID to response headers for tracing
  const response = NextResponse.next();
  response.headers.set('x-request-id', requestId);
  response.headers.set('x-correlation-id', correlationId);

  return response;
}

/**
 * API route wrapper for Pages Router
 */
export function withAudit(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const requestId =
      (req.headers['x-request-id'] as string) ||
      (req.headers['x-correlation-id'] as string) ||
      randomUUID();

    const correlationId =
      (req.headers['x-correlation-id'] as string) || randomUUID();

    // Extract IP
    const ip =
      (req.headers['cf-connecting-ip'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress ||
      null;

    const userAgent = (req.headers['user-agent'] as string) || null;

    // Extract actor from session/auth (if available)
    // This assumes you have auth middleware that sets req.user
    const actorEmail = (req as any).user?.email || null;
    const actorId = (req as any).user?.id || null;
    const actorType = actorEmail ? 'human' : undefined;

    // Set response headers
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-correlation-id', correlationId);

    // Run handler in audit context
    return runWithAuditContext(
      {
        requestId,
        correlationId,
        ip,
        userAgent,
        actorEmail: actorEmail || undefined,
        actorId: actorId || undefined,
        actorType,
      },
      () => handler(req, res)
    );
  };
}

/**
 * Express/Fastify-style middleware
 */
export function expressAuditMiddleware(
  req: any,
  res: any,
  next: () => void
) {
  const requestId =
    req.headers['x-request-id'] ||
    req.headers['x-correlation-id'] ||
    randomUUID();

  const correlationId = req.headers['x-correlation-id'] || randomUUID();

  const ip =
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.ip ||
    req.connection?.remoteAddress ||
    null;

  const userAgent = req.headers['user-agent'] || null;

  const actorEmail = req.user?.email || null;
  const actorId = req.user?.id || null;
  const actorType = actorEmail ? 'human' : undefined;

  // Set response headers
  res.setHeader('x-request-id', requestId);
  res.setHeader('x-correlation-id', correlationId);

  // Set context
  setAuditContext({
    requestId,
    correlationId,
    ip,
    userAgent,
    actorEmail: actorEmail || undefined,
    actorId: actorId || undefined,
    actorType,
  });

  next();
}

/**
 * App Router handler wrapper with audit context
 * Sets audit context based on request headers and user
 */
export function withAppRouterAudit<T>(
  handler: (request: Request, user: any) => Promise<T>
) {
  return async (request: Request, user: any): Promise<T> => {
    const requestId =
      request.headers.get('x-request-id') ||
      request.headers.get('x-correlation-id') ||
      randomUUID();

    const correlationId =
      request.headers.get('x-correlation-id') || randomUUID();

    const ip =
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      null;

    const userAgent = request.headers.get('user-agent') || null;

    const actorEmail = user?.email || null;
    const actorId = user?.id || null;
    const actorType = actorEmail ? 'human' : undefined;

    return runWithAuditContext(
      {
        requestId,
        correlationId,
        ip,
        userAgent,
        actorEmail: actorEmail || undefined,
        actorId: actorId || undefined,
        actorType,
      },
      () => handler(request, user)
    );
  };
}

export default auditMiddleware;
