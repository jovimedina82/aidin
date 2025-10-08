/**
 * JWT Provider Interface and Stub Implementation
 * Phase 2 Scaffold - Interface definition only
 */

import type { TokenPair, AuthUser } from '../domain'

export interface JWTProvider {
  /**
   * Generate JWT token pair for user
   */
  generateTokens(user: AuthUser): Promise<TokenPair>

  /**
   * Verify and decode JWT access token
   */
  verifyAccessToken(token: string): Promise<AuthUser>

  /**
   * Verify and decode JWT refresh token
   */
  verifyRefreshToken(token: string): Promise<{ userId: string }>

  /**
   * Revoke a token (add to blacklist)
   */
  revokeToken(token: string): Promise<void>
}

/**
 * Stub JWT Provider Implementation
 * TODO: Implement in Phase 3 - use jsonwebtoken library
 */
export class JWTProviderImpl implements JWTProvider {
  async generateTokens(user: AuthUser): Promise<TokenPair> {
    // TODO: Sign JWT with secret
    // TODO: Set expiration times
    // TODO: Return token pair
    throw new Error('NotImplemented: JWTProvider.generateTokens() - Phase 3')
  }

  async verifyAccessToken(token: string): Promise<AuthUser> {
    // TODO: Verify JWT signature
    // TODO: Check expiration
    // TODO: Decode and return user
    throw new Error('NotImplemented: JWTProvider.verifyAccessToken() - Phase 3')
  }

  async verifyRefreshToken(token: string): Promise<{ userId: string }> {
    // TODO: Verify JWT signature
    // TODO: Check expiration
    // TODO: Return userId
    throw new Error('NotImplemented: JWTProvider.verifyRefreshToken() - Phase 3')
  }

  async revokeToken(token: string): Promise<void> {
    // TODO: Add token to blacklist/cache
    throw new Error('NotImplemented: JWTProvider.revokeToken() - Phase 3')
  }
}
