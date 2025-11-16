import * as jose from 'jose';

const jwtSecret = process.env.JWT_SECRET || 'development_secret_change_me';
console.log('[JWT-Edge] Using secret:', jwtSecret ? jwtSecret.substring(0, 10) + '...' : 'NOT SET');

const SECRET = new TextEncoder().encode(jwtSecret);

export async function signTokenEdge(payload: Record<string, any>, expiresIn = '7d'): Promise<string> {
  const jwt = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(SECRET);
  return jwt;
}

export async function verifyTokenEdge<T = any>(token: string): Promise<T | null> {
  try {
    const { payload } = await jose.jwtVerify(token, SECRET);
    console.log('[JWT-Edge] Token verification SUCCESS');
    return payload as T;
  } catch (err: any) {
    console.log('[JWT-Edge] Token verification FAILED:', err.message);
    return null;
  }
}
