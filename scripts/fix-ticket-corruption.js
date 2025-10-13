#!/usr/bin/env node

/**
 * Fix corrupted ticket data - specifically ticket 9b82dc5f-91c7-4e57-9264-4fbbbf7003d9
 * This script identifies and fixes NULL user references in TicketComment and Attachment tables
 */

import { PrismaClient } from '../lib/generated/prisma/index.js'
const prisma = new PrismaClient()

const TICKET_ID = '9b82dc5f-91c7-4e57-9264-4fbbbf7003d9'

async function main() {
  console.log('🔍 Investigating ticket:', TICKET_ID)
  console.log('=' .repeat(60))

  // Check if ticket exists
  const ticket = await prisma.ticket.findUnique({
    where: { id: TICKET_ID },
    select: {
      id: true,
      ticketNumber: true,
      title: true,
      requesterId: true,
      assigneeId: true
    }
  })

  if (!ticket) {
    console.log('❌ Ticket not found')
    return
  }

  console.log('✅ Ticket found:', {
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    requesterId: ticket.requesterId,
    assigneeId: ticket.assigneeId
  })
  console.log('')

  // Check TicketComment records
  console.log('📝 Checking TicketComment records...')
  const comments = await prisma.ticketComment.findMany({
    where: { ticketId: TICKET_ID },
    select: {
      id: true,
      userId: true,
      content: true,
      createdAt: true
    }
  })

  const commentsWithNullUser = comments.filter(c => c.userId === null)
  console.log(`  Total comments: ${comments.length}`)
  console.log(`  Comments with NULL userId: ${commentsWithNullUser.length}`)

  if (commentsWithNullUser.length > 0) {
    console.log('  🔴 Found comments with NULL userId:')
    commentsWithNullUser.forEach(c => {
      console.log(`    - Comment ID: ${c.id}, Created: ${c.createdAt}`)
    })
  }
  console.log('')

  // Check Attachment records
  console.log('📎 Checking Attachment records...')
  const attachments = await prisma.attachment.findMany({
    where: { ticketId: TICKET_ID },
    select: {
      id: true,
      userId: true,
      fileName: true,
      expiresAt: true
    }
  })

  const attachmentsWithNullUser = attachments.filter(a => a.userId === null)
  console.log(`  Total attachments: ${attachments.length}`)
  console.log(`  Attachments with NULL userId: ${attachmentsWithNullUser.length}`)

  if (attachmentsWithNullUser.length > 0) {
    console.log('  🔴 Found attachments with NULL userId:')
    attachmentsWithNullUser.forEach(a => {
      console.log(`    - Attachment ID: ${a.id}, File: ${a.fileName}, Expires: ${a.expiresAt}`)
    })
  }
  console.log('')

  // Check for invalid user references
  console.log('👤 Checking for invalid user references...')

  // Get all unique user IDs from comments and attachments
  const userIds = new Set([
    ...comments.map(c => c.userId).filter(Boolean),
    ...attachments.map(a => a.userId).filter(Boolean),
    ticket.requesterId,
    ticket.assigneeId
  ].filter(Boolean))

  const existingUsers = await prisma.user.findMany({
    where: {
      id: { in: Array.from(userIds) }
    },
    select: { id: true, email: true, firstName: true, lastName: true }
  })

  const existingUserIds = new Set(existingUsers.map(u => u.id))
  const invalidUserIds = Array.from(userIds).filter(id => !existingUserIds.has(id))

  if (invalidUserIds.length > 0) {
    console.log(`  🔴 Found ${invalidUserIds.length} invalid user references:`)
    invalidUserIds.forEach(id => {
      console.log(`    - ${id}`)

      // Show which fields have this invalid reference
      if (ticket.requesterId === id) console.log(`      ↳ ticket.requesterId`)
      if (ticket.assigneeId === id) console.log(`      ↳ ticket.assigneeId`)

      comments.forEach(c => {
        if (c.userId === id) console.log(`      ↳ comment ${c.id}`)
      })

      attachments.forEach(a => {
        if (a.userId === id) console.log(`      ↳ attachment ${a.id} (${a.fileName})`)
      })
    })
  } else {
    console.log('  ✅ All user references are valid')
  }
  console.log('')

  // Show available valid users that could be used as replacement
  if (invalidUserIds.length > 0 && existingUsers.length > 0) {
    console.log('📋 Available valid users:')
    existingUsers.slice(0, 5).forEach(u => {
      console.log(`  - ${u.id} (${u.email} - ${u.firstName} ${u.lastName})`)
    })
    if (existingUsers.length > 5) {
      console.log(`  ... and ${existingUsers.length - 5} more`)
    }
    console.log('')
  }

  // Provide fix options
  console.log('=' .repeat(60))
  console.log('🔧 FIX OPTIONS:')
  console.log('')

  if (commentsWithNullUser.length > 0) {
    console.log('Option 1: Delete comments with NULL userId')
    console.log(`  This will delete ${commentsWithNullUser.length} comment(s)`)
    console.log('')
    console.log('  Run: node scripts/fix-ticket-corruption.js --delete-null-comments')
    console.log('')
  }

  if (attachmentsWithNullUser.length > 0) {
    console.log('Option 2: Delete attachments with NULL userId')
    console.log(`  This will delete ${attachmentsWithNullUser.length} attachment(s)`)
    console.log('')
    console.log('  Run: node scripts/fix-ticket-corruption.js --delete-null-attachments')
    console.log('')
  }

  if (invalidUserIds.length > 0 && ticket.assigneeId && existingUserIds.has(ticket.assigneeId)) {
    console.log('Option 3: Fix invalid user references by reassigning to ticket assignee')
    console.log(`  This will reassign all invalid user references to:`)
    const assignee = existingUsers.find(u => u.id === ticket.assigneeId)
    console.log(`  ${assignee.email} (${assignee.firstName} ${assignee.lastName})`)
    console.log('')
    console.log('  Run: node scripts/fix-ticket-corruption.js --fix-invalid-users')
    console.log('')
  } else if (invalidUserIds.length > 0) {
    console.log('Option 3: Handle invalid user references')
    console.log('  This requires manual intervention to either:')
    console.log('  - Reassign to a valid user ID')
    console.log('  - Delete the related records')
    console.log('')
  }

  if (commentsWithNullUser.length === 0 && attachmentsWithNullUser.length === 0 && invalidUserIds.length === 0) {
    console.log('✅ No corruption found! The issue might be elsewhere.')
    console.log('')
    console.log('Trying to load the ticket with full relations...')

    try {
      const fullTicket = await prisma.ticket.findUnique({
        where: { id: TICKET_ID },
        include: {
          requester: true,
          assignee: true,
          department: true,
          comments: {
            include: {
              user: true
            }
          },
          attachments: {
            include: {
              user: true
            }
          }
        }
      })
      console.log('✅ Ticket loaded successfully!')
      console.log('  Comments:', fullTicket.comments.length)
      console.log('  Attachments:', fullTicket.attachments.length)
    } catch (error) {
      console.log('❌ Error loading ticket:', error.message)
      if (error.message.includes('Field user is required')) {
        console.log('')
        console.log('🔍 The error suggests NULL user references exist.')
        console.log('This might be in a relation not checked above (e.g., childTickets)')
      }
    }
  }
}

// Handle command line arguments for applying fixes
async function applyFixes() {
  const args = process.argv.slice(2)

  if (args.includes('--delete-null-comments')) {
    console.log('🗑️  Deleting comments with NULL userId...')
    const result = await prisma.ticketComment.deleteMany({
      where: {
        ticketId: TICKET_ID,
        userId: null
      }
    })
    console.log(`✅ Deleted ${result.count} comment(s)`)
    return
  }

  if (args.includes('--delete-null-attachments')) {
    console.log('🗑️  Deleting attachments with NULL userId...')
    const result = await prisma.attachment.deleteMany({
      where: {
        ticketId: TICKET_ID,
        userId: null
      }
    })
    console.log(`✅ Deleted ${result.count} attachment(s)`)
    return
  }

  if (args.includes('--fix-invalid-users')) {
    console.log('🔧 Fixing invalid user references...')

    // Get the ticket to find the assignee
    const ticket = await prisma.ticket.findUnique({
      where: { id: TICKET_ID },
      select: {
        id: true,
        ticketNumber: true,
        assigneeId: true
      }
    })

    if (!ticket || !ticket.assigneeId) {
      console.log('❌ Cannot fix: Ticket not found or has no assignee')
      return
    }

    // Get all user IDs that should exist
    const comments = await prisma.ticketComment.findMany({
      where: { ticketId: TICKET_ID },
      select: { id: true, userId: true }
    })

    const attachments = await prisma.attachment.findMany({
      where: { ticketId: TICKET_ID },
      select: { id: true, userId: true }
    })

    const allUserIds = [
      ...comments.map(c => c.userId).filter(Boolean),
      ...attachments.map(a => a.userId).filter(Boolean),
      ticket.assigneeId
    ]

    const existingUsers = await prisma.user.findMany({
      where: { id: { in: allUserIds } },
      select: { id: true }
    })

    const existingUserIds = new Set(existingUsers.map(u => u.id))

    // Find and fix invalid attachments
    let fixedCount = 0
    for (const attachment of attachments) {
      if (attachment.userId && !existingUserIds.has(attachment.userId)) {
        console.log(`  Fixing attachment ${attachment.id}: ${attachment.userId} → ${ticket.assigneeId}`)
        await prisma.attachment.update({
          where: { id: attachment.id },
          data: { userId: ticket.assigneeId }
        })
        fixedCount++
      }
    }

    // Find and fix invalid comments
    for (const comment of comments) {
      if (comment.userId && !existingUserIds.has(comment.userId)) {
        console.log(`  Fixing comment ${comment.id}: ${comment.userId} → ${ticket.assigneeId}`)
        await prisma.ticketComment.update({
          where: { id: comment.id },
          data: { userId: ticket.assigneeId }
        })
        fixedCount++
      }
    }

    console.log(`✅ Fixed ${fixedCount} invalid user reference(s)`)
    return
  }

  // No fix flags provided, just run investigation
  await main()
}

applyFixes()
  .catch(error => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
