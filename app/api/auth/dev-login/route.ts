import { NextResponse } from 'next/server';
import { signToken } from '@/modules/auth/jwt';
import { cookieOptions } from '@/lib/config';

export async function POST() {
  if (process.env.DEV_LOGIN_ENABLED !== 'true') {
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

  const res = NextResponse.json({ ok: true });
  const opts = cookieOptions();
  res.cookies.set('aidin_token', token, opts);
  return res;
}
