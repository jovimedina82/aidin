import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/cron/cleanup-chats
 * Delete expired AidIN chat sessions
 *
 * This endpoint should be called by a cron service (e.g., Vercel Cron, GitHub Actions, etc.)
 * to automatically clean up expired chat sessions.
 *
 * Security: Requires CRON_SECRET environment variable to match the Authorization header
 */
export async function POST(request) {
  try {
    // Verify the request is from an authorized cron service
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('CRON_SECRET environment variable is not set')
      return NextResponse.json(
        { error: 'Cron job not configured' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron request')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('🧹 Starting cleanup of expired AidIN chat sessions...')

    const now = new Date()

    // Find all expired sessions
    const expiredSessions = await prisma.aidinChatSession.findMany({
      where: {
        expiresAt: {
          lt: now
        }
      },
      include: {
        _count: {
          select: { messages: true }
        }
      }
    })

    if (expiredSessions.length === 0) {
      console.log('✅ No expired chat sessions found.')
      return NextResponse.json({
        success: true,
        deletedSessions: 0,
        deletedMessages: 0,
        message: 'No expired chat sessions found'
      })
    }

    console.log(`📊 Found ${expiredSessions.length} expired chat session(s)`)

    // Delete expired sessions (messages will cascade delete)
    const deleteResult = await prisma.aidinChatSession.deleteMany({
      where: {
        expiresAt: {
          lt: now
        }
      }
    })

    const totalMessages = expiredSessions.reduce((sum, session) => sum + session._count.messages, 0)

    console.log(`✅ Cleanup complete!`)
    console.log(`   - Deleted ${deleteResult.count} chat session(s)`)
    console.log(`   - Removed ${totalMessages} message(s)`)

    return NextResponse.json({
      success: true,
      deletedSessions: deleteResult.count,
      deletedMessages: totalMessages,
      message: `Cleanup complete. Deleted ${deleteResult.count} session(s) and ${totalMessages} message(s).`
    })

  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    return NextResponse.json(
      {
        error: 'Cleanup failed',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// Allow GET for testing (but still requires auth)
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Just return info about expired sessions without deleting
  const now = new Date()
  const expiredCount = await prisma.aidinChatSession.count({
    where: {
      expiresAt: {
        lt: now
      }
    }
  })

  return NextResponse.json({
    expiredSessions: expiredCount,
    message: `There are ${expiredCount} expired session(s) ready to be cleaned up.`
  })
}
