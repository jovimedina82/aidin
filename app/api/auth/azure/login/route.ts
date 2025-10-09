import { NextRequest, NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Get base URL from environment or request origin
  const BASE_URL = getBaseUrl(request);

  // Check if Azure AD is configured
  if (!process.env.AZURE_AD_CLIENT_ID || !process.env.AZURE_AD_TENANT_ID) {
    return NextResponse.redirect(`${BASE_URL}/login?error=azure_not_configured`);
  }

  // Build Azure AD authorization URL
  const authUrl = new URL(
    `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/authorize`
  );

  authUrl.searchParams.set('client_id', process.env.AZURE_AD_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', `${BASE_URL}/api/auth/azure-callback`);
  authUrl.searchParams.set('scope', 'openid profile email User.Read');
  authUrl.searchParams.set('response_mode', 'query');

  // Redirect to Azure AD login
  return NextResponse.redirect(authUrl.toString());
}
