import { NextResponse } from 'next/server'
import { MicrosoftGraphService, getAppOnlyAccessToken } from '@/lib/services/MicrosoftGraphService'

export async function GET() {
  try {
    // Check if Azure credentials are configured
    if (!process.env.AZURE_AD_CLIENT_ID || !process.env.AZURE_AD_CLIENT_SECRET || !process.env.AZURE_AD_TENANT_ID) {
      return NextResponse.json({
        success: false,
        message: 'Azure AD credentials not fully configured',
        timestamp: new Date().toISOString(),
        missingConfig: [
          !process.env.AZURE_AD_CLIENT_ID && 'AZURE_AD_CLIENT_ID',
          !process.env.AZURE_AD_CLIENT_SECRET && 'AZURE_AD_CLIENT_SECRET',
          !process.env.AZURE_AD_TENANT_ID && 'AZURE_AD_TENANT_ID'
        ].filter(Boolean)
      })
    }

    // Test actual Azure AD connection
    try {
      console.log('Testing Azure AD connection...')
      const accessToken = await getAppOnlyAccessToken()
      const graphService = new MicrosoftGraphService(accessToken)

      // Test the connection and permissions
      const connectionTest = await graphService.testConnection()

      return NextResponse.json({
        ...connectionTest,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Azure connection test failed:', error)

      return NextResponse.json({
        success: false,
        message: `Connection test failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        error: error.message
      })
    }
  } catch (error) {
    console.error('Error testing Azure connection:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to test Azure connection',
        timestamp: new Date().toISOString(),
        error: error.message
      },
      { status: 500 }
    )
  }
}