import { NextRequest } from 'next/server';
import { getCSRFTokenEndpoint } from '@/lib/security/csrf';

/**
 * GET /api/auth/csrf-token
 *
 * Returns a CSRF token for use in state-changing requests.
 * Frontend should call this and include the token in X-CSRF-Token header.
 */
export async function GET(request: NextRequest) {
  return getCSRFTokenEndpoint(request);
}
