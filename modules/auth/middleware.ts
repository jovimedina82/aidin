import { NextRequest } from 'next/server';
import { verifyTokenEdge } from './jwt-edge';

export interface CurrentUser {
  id: string;
  email: string;
  roles: string[];
  name?: string;
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const h = req.headers.get('authorization');
  if (h?.toLowerCase().startsWith('bearer ')) return h.slice(7);
  const cookie = req.cookies.get('aidin_token');
  return cookie?.value || null;
}

export async function getCurrentUser(req: NextRequest): Promise<CurrentUser | null> {
  const tok = getTokenFromRequest(req);
  if (!tok) return null;
  const payload = await verifyTokenEdge<any>(tok);
  if (!payload) return null;
  return {
    id: payload.id || payload.email,
    email: payload.email,
    roles: payload.roles || [],
    name: payload.name,
  };
}
