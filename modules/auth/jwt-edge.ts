import * as jose from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'development_secret_change_me'
);

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
    return payload as T;
  } catch {
    return null;
  }
}
