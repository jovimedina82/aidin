import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Force this route to be dynamic (not cached)
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // Check if Azure credentials are properly configured
    const isConfigured = !!(
      process.env.AZURE_AD_CLIENT_ID &&
      process.env.AZURE_AD_CLIENT_SECRET &&
      process.env.AZURE_AD_TENANT_ID &&
      process.env.MICROSOFT_GRAPH_SYNC_GROUP
    )

    // Get the last sync information from audit logs
    const lastSyncLog = await prisma.auditLog.findFirst({
      where: {
        action: { in: ['AZURE_SYNC_AUTO', 'AZURE_SYNC_MANUAL'] }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Count users synced from Azure (users with azureId)
    const azureUserCount = await prisma.user.count({
      where: {
        azureId: { not: null }
      }
    })

    const status = {
      enabled: isConfigured,
      configured: isConfigured,
      lastSync: lastSyncLog?.createdAt || null,
      syncStatus: isConfigured ? 'ready' : 'not_configured',
      userCount: azureUserCount,
      groupName: process.env.MICROSOFT_GRAPH_SYNC_GROUP || null,
      syncInterval: parseInt(process.env.SYNC_INTERVAL_MINUTES || '30'),
      lastSyncDetails: lastSyncLog ? JSON.parse(lastSyncLog.newValues || '{}') : null,
      missingConfig: []
    }

    // Check what's missing in configuration
    if (!process.env.AZURE_AD_CLIENT_ID) status.missingConfig.push('AZURE_AD_CLIENT_ID')
    if (!process.env.AZURE_AD_CLIENT_SECRET) status.missingConfig.push('AZURE_AD_CLIENT_SECRET')
    if (!process.env.AZURE_AD_TENANT_ID) status.missingConfig.push('AZURE_AD_TENANT_ID')
    if (!process.env.MICROSOFT_GRAPH_SYNC_GROUP) status.missingConfig.push('MICROSOFT_GRAPH_SYNC_GROUP')

    return NextResponse.json(status)
  } catch (error) {
    console.error('Error fetching Azure sync status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sync status' },
      { status: 500 }
    )
  }
}