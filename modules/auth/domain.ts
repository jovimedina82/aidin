/**
 * Authentication Domain Types and DTOs
 * Phase 2 Scaffold - Types only, no implementation
 */

export enum Provider {
  LOCAL = 'local',
  AZURE_AD = 'azure_ad',
}

export interface LoginDTO {
  email: string
  password: string
  provider?: Provider
}

export interface TokenPair {
  accessToken: string
  refreshToken?: string
  expiresIn: number
}

export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  roles: string[]
  provider: Provider
}

export interface AzureADConfig {
  tenantId: string
  clientId: string
  clientSecret: string
  redirectUri: string
}

/**
 * User session data extracted from JWT
 * Phase 3: Used for request-level authentication
 */
export interface UserSession {
  userId: string
  email: string
  roles: string[]
}
