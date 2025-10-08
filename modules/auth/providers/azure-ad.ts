/**
 * Azure AD Provider Interface and Stub Implementation
 * Phase 2 Scaffold - Interface definition only
 */

import type { AzureADConfig, AuthUser } from '../domain'

export interface AzureADProvider {
  /**
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl(redirectUri: string, state: string): Promise<string>

  /**
   * Exchange authorization code for access token
   */
  exchangeCodeForToken(code: string, redirectUri: string): Promise<string>

  /**
   * Get user profile from Azure AD
   */
  getUserProfile(accessToken: string): Promise<AuthUser>

  /**
   * Validate Azure AD token
   */
  validateToken(token: string): Promise<boolean>
}

/**
 * Stub Azure AD Provider Implementation
 * TODO: Implement in Phase 3 - use @azure/msal-node
 */
export class AzureADProviderImpl implements AzureADProvider {
  constructor(private config: AzureADConfig) {}

  async getAuthorizationUrl(redirectUri: string, state: string): Promise<string> {
    // TODO: Build authorization URL with config
    // TODO: Include scopes (openid, profile, email)
    throw new Error('NotImplemented: AzureADProvider.getAuthorizationUrl() - Phase 3')
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
    // TODO: Call Azure AD token endpoint
    // TODO: Exchange code for access token
    // TODO: Return access token
    throw new Error('NotImplemented: AzureADProvider.exchangeCodeForToken() - Phase 3')
  }

  async getUserProfile(accessToken: string): Promise<AuthUser> {
    // TODO: Call Microsoft Graph API
    // TODO: Fetch user profile
    // TODO: Map to AuthUser
    throw new Error('NotImplemented: AzureADProvider.getUserProfile() - Phase 3')
  }

  async validateToken(token: string): Promise<boolean> {
    // TODO: Verify token signature
    // TODO: Validate issuer and audience
    // TODO: Check expiration
    throw new Error('NotImplemented: AzureADProvider.validateToken() - Phase 3')
  }
}
