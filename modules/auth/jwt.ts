import jwt from 'jsonwebtoken';

// SECURITY: Fail hard if JWT_SECRET is not configured in production
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: JWT_SECRET environment variable must be set in production');
    }
    // Only allow default in development with a warning
    console.warn('⚠️  WARNING: Using default JWT secret. Set JWT_SECRET in production!');
    return 'development_secret_change_me';
  }

  // Validate secret strength
  if (secret.length < 32) {
    console.warn('⚠️  WARNING: JWT_SECRET should be at least 32 characters long');
  }

  return secret;
}

const SECRET = getJWTSecret();

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
