import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Basic Azure sync status - in a real app this would check actual sync status
    const status = {
      enabled: process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET,
      lastSync: null,
      syncStatus: 'idle',
      userCount: 0,
      errors: []
    }

    return NextResponse.json(status)
  } catch (error) {
    console.error('Error fetching Azure sync status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sync status' },
      { status: 500 }
    )
  }
}