/**
 * GET /api/presence/options
 *
 * Returns active status types and office locations for planning UI.
 * Public endpoint - no authentication required.
 */

import { NextResponse } from 'next/server'
import { getPresenceOptions } from '@/lib/presence/registry'

export async function GET() {
  try {
    const options = await getPresenceOptions()

    return NextResponse.json(options)
  } catch (error: any) {
    console.error('❌ Error fetching presence options:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch presence options',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
