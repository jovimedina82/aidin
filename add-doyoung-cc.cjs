const { PrismaClient } = require('./lib/generated/prisma');
const prisma = new PrismaClient();

async function addDoyoungCC() {
  try {
    // Find ticket GN000012
    const ticket = await prisma.ticket.findFirst({
      where: { ticketNumber: 'GN000012' }
    });

    if (!ticket) {
      console.log('❌ Ticket GN000012 not found');
      return;
    }

    console.log(`📋 Found ticket: ${ticket.ticketNumber} (ID: ${ticket.id})`);

    // Check if doyoung is already CC'd
    const existing = await prisma.ticketCC.findUnique({
      where: {
        ticketId_email: {
          ticketId: ticket.id,
          email: 'doyoung@irvinecompany.com'
        }
      }
    });

    if (existing) {
      console.log('✅ doyoung@irvinecompany.com is already CC\'d on this ticket');
      return;
    }

    // Add doyoung as CC recipient
    const ccRecipient = await prisma.ticketCC.create({
      data: {
        ticketId: ticket.id,
        email: 'doyoung@irvinecompany.com',
        name: 'Doyoung Park',
        addedBy: 'system',
        source: 'manual'
      }
    });

    console.log('✅ Successfully added doyoung@irvinecompany.com as CC recipient');
    console.log(`   Name: ${ccRecipient.name}`);
    console.log(`   Source: ${ccRecipient.source}`);
    console.log(`   Added at: ${ccRecipient.addedAt}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

addDoyoungCC();
