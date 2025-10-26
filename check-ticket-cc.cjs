const { PrismaClient } = require('./lib/generated/prisma');
const prisma = new PrismaClient();

async function checkTicket() {
  try {
    // Find ticket GN000012
    const ticket = await prisma.ticket.findFirst({
      where: { ticketNumber: 'GN000012' },
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        requester: {
          select: { email: true, firstName: true, lastName: true }
        }
      }
    });

    if (!ticket) {
      console.log('❌ Ticket GN000012 not found');
      return;
    }

    console.log('📋 Ticket:', ticket);
    console.log('');

    // Get CC recipients for this ticket
    const ccRecipients = await prisma.ticketCC.findMany({
      where: { ticketId: ticket.id },
      select: {
        id: true,
        email: true,
        name: true,
        source: true,
        addedAt: true
      }
    });

    console.log('📧 CC Recipients:');
    ccRecipients.forEach(cc => {
      console.log(`  - ${cc.email} (${cc.name || 'no name'}) - source: ${cc.source}`);
    });
    console.log('');
    console.log('📊 Total CC recipients:', ccRecipients.length);

    // Check if doyoung@irvinecompany.com is in the list
    const doyoung = ccRecipients.find(cc => cc.email.includes('doyoung'));
    if (doyoung) {
      console.log('✅ Found doyoung@irvinecompany.com in CC recipients');
    } else {
      console.log('❌ doyoung@irvinecompany.com NOT found in CC recipients');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTicket();
