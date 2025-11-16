import { NextResponse } from 'next/server';
import { signToken } from '@/modules/auth/jwt';
import { cookieOptions } from '@/lib/config';
import logger from '@/lib/logger';

export async function POST(request: Request) {
  // SECURITY: CRITICAL - Double-check production guard
  if (process.env.NODE_ENV === 'production') {
    logger.error('CRITICAL: Dev login attempted in production environment', {
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (process.env.DEV_LOGIN_ENABLED !== 'true') {
    logger.warn('Dev login attempt when disabled', {
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    });
    return NextResponse.json({ error: 'Dev login disabled' }, { status: 403 });
  }

  const email = process.env.DEV_ADMIN_EMAIL || 'admin@surterreproperties.com';
  const token = signToken({
    email,
    id: email,
    roles: ['Admin'],
    name: 'System Administrator',
    firstName: 'System',
    lastName: 'Administrator',
  }, '7d');

  logger.warn('Dev login used - ONLY FOR DEVELOPMENT', {
    email,
    ip: request.headers.get('x-forwarded-for') || 'unknown'
  });

  const res = NextResponse.json({ ok: true });
  const opts = cookieOptions();
  res.cookies.set('aidin_token', token, opts);
  return res;
}
