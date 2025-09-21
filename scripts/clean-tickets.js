import { PrismaClient } from '../lib/generated/prisma/index.js'

const prisma = new PrismaClient()

async function cleanTicketsAndComments() {
  try {
    console.log('🧹 Starting cleanup of tickets and comments...')

    // Get counts before cleanup
    const ticketCount = await prisma.ticket.count()
    const commentCount = await prisma.ticketComment.count()
    const aiDecisionCount = await prisma.aIDecision.count()
    const kbUsageCount = await prisma.ticketKBUsage.count()
    const statsCount = await prisma.weeklyTicketStats.count()

    console.log(`📊 Current counts:`)
    console.log(`  - Tickets: ${ticketCount}`)
    console.log(`  - Comments: ${commentCount}`)
    console.log(`  - AI Decisions: ${aiDecisionCount}`)
    console.log(`  - KB Usage: ${kbUsageCount}`)
    console.log(`  - Weekly Stats: ${statsCount}`)

    if (ticketCount === 0 && commentCount === 0) {
      console.log('✅ No tickets or comments to clean!')
      return
    }

    console.log('\n🗑️ Deleting data...')

    // Delete in correct order to respect foreign key constraints

    // 1. Delete ticket KB usage records
    if (kbUsageCount > 0) {
      const deletedKbUsage = await prisma.ticketKBUsage.deleteMany({})
      console.log(`  ✓ Deleted ${deletedKbUsage.count} KB usage records`)
    }

    // 2. Delete AI decisions
    if (aiDecisionCount > 0) {
      const deletedAiDecisions = await prisma.aIDecision.deleteMany({})
      console.log(`  ✓ Deleted ${deletedAiDecisions.count} AI decisions`)
    }

    // 3. Delete ticket comments
    if (commentCount > 0) {
      const deletedComments = await prisma.ticketComment.deleteMany({})
      console.log(`  ✓ Deleted ${deletedComments.count} comments`)
    }

    // 4. Delete tickets
    if (ticketCount > 0) {
      const deletedTickets = await prisma.ticket.deleteMany({})
      console.log(`  ✓ Deleted ${deletedTickets.count} tickets`)
    }

    // 5. Delete weekly stats
    if (statsCount > 0) {
      const deletedStats = await prisma.weeklyTicketStats.deleteMany({})
      console.log(`  ✓ Deleted ${deletedStats.count} weekly stats records`)
    }

    console.log('\n✨ Cleanup completed successfully!')
    console.log('🎯 All tickets, comments, and related data have been removed.')

  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the cleanup
cleanTicketsAndComments()
  .catch((error) => {
    console.error('💥 Cleanup failed:', error)
    process.exit(1)
  })