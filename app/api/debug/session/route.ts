import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/modules/auth/middleware';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  return NextResponse.json({ user });
}
