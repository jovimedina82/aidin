import { NextResponse } from 'next/server';
import { cookieOptions } from '@/lib/config';
import { getCurrentUser } from '@/lib/auth';
import { logEvent } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    // Get user before logging out
    const user = await getCurrentUser(request);

    // Log logout event if user is authenticated
    if (user) {
      await logEvent({
        action: 'logout.success',
        actorId: user.id,
        actorEmail: user.email,
        actorType: 'human',
        entityType: 'user',
        entityId: user.email,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || null,
        metadata: {
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    console.error('Error logging logout event:', error);
    // Continue with logout even if audit logging fails
  }

  const res = NextResponse.json({ ok: true });
  const opts = cookieOptions();
  res.cookies.set('aidin_token', '', { ...opts, maxAge: 0 });
  return res;
}
