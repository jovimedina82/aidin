#!/usr/bin/env node

/**
 * Cleanup Expired AidIN Chat Sessions
 *
 * This script deletes chat sessions that have expired (expiresAt < now).
 * Should be run daily via cron job.
 *
 * Usage:
 *   node scripts/cleanup-expired-chats.js
 *
 * Cron job example (run daily at 2 AM):
 *   0 2 * * * cd /path/to/aidin && node scripts/cleanup-expired-chats.js
 */

import { PrismaClient } from '../lib/generated/prisma/index.js'

const prisma = new PrismaClient()

async function cleanupExpiredChats() {
  try {
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
      return
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

  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the cleanup
cleanupExpiredChats()
