import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'development_secret_change_me';

export function signToken(payload: Record<string, any>, expiresIn = '7d') {
  return jwt.sign(payload, SECRET, { expiresIn });
}

export function verifyToken<T = any>(token: string): T | null {
  try {
    return jwt.verify(token, SECRET) as T;
  } catch {
    return null;
  }
}
