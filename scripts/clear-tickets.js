#!/usr/bin/env node

import { prisma } from '../lib/prisma.js'

async function clearAllTickets() {
  try {
    console.log('🗑️  Starting to clear all tickets...')
    
    // Delete in correct order due to foreign key constraints
    console.log('Deleting ticket comments...')
    const commentCount = await prisma.ticketComment.deleteMany({})
    console.log(`✅ Deleted ${commentCount.count} ticket comments`)
    
    console.log('Deleting audit logs related to tickets...')
    const auditCount = await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entityType: 'ticket' },
          { action: { contains: 'TICKET' } }
        ]
      }
    })
    console.log(`✅ Deleted ${auditCount.count} audit log entries`)
    
    console.log('Deleting all tickets...')
    const ticketCount = await prisma.ticket.deleteMany({})
    console.log(`✅ Deleted ${ticketCount.count} tickets`)
    
    console.log('🎉 All tickets cleared successfully!')
    console.log('You can now create fresh tickets for testing.')
    
  } catch (error) {
    console.error('❌ Error clearing tickets:', error)
  } finally {
    await prisma.$disconnect()
  }
}

clearAllTickets()