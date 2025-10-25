const { PrismaClient } = require('./lib/generated/prisma');
const prisma = new PrismaClient();

async function checkEmailIngests() {
  try {
    // Find the ticket first
    const ticket = await prisma.ticket.findFirst({
      where: { ticketNumber: 'IT000006' },
      select: { id: true, ticketNumber: true, title: true }
    });

    if (!ticket) {
      console.log('❌ Ticket IT000006 not found');
      return;
    }

    console.log('📋 Ticket:', ticket.ticketNumber, '-', ticket.title);
    console.log('🆔 Ticket ID:', ticket.id);
    console.log('');

    // Check for recent email ingests related to this ticket
    const recentIngests = await prisma.emailIngest.findMany({
      where: {
        OR: [
          { ticketId: ticket.id },
          { subject: { contains: 'IT000006' } },
          { subject: { contains: 'Corey Anthony' } }
        ]
      },
      orderBy: { receivedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        messageId: true,
        subject: true,
        from: true,
        to: true,
        receivedAt: true,
        processedAt: true,
        processingError: true,
        ticketId: true,
        inReplyTo: true
      }
    });

    console.log('📧 Email Ingests found:', recentIngests.length);
    console.log('');

    recentIngests.forEach((ingest, i) => {
      console.log(`Email ${i + 1}:`);
      console.log('  ID:', ingest.id);
      console.log('  From:', ingest.from);
      console.log('  Subject:', ingest.subject);
      console.log('  In-Reply-To:', ingest.inReplyTo || 'NONE');
      console.log('  Received:', ingest.receivedAt);
      console.log('  Processed:', ingest.processedAt || 'NOT PROCESSED');
      console.log('  Ticket ID:', ingest.ticketId || 'NONE');
      if (ingest.processingError) {
        console.log('  Error:', ingest.processingError);
      }
      console.log('');
    });

    // Also check for ANY recent unprocessed emails
    const unprocessed = await prisma.emailIngest.findMany({
      where: {
        processedAt: null
      },
      orderBy: { receivedAt: 'desc' },
      take: 5
    });

    if (unprocessed.length > 0) {
      console.log('⚠️  Unprocessed Emails:', unprocessed.length);
      unprocessed.forEach((email, i) => {
        console.log(`  ${i + 1}. ${email.from} - ${email.subject}`);
        if (email.processingError) {
          console.log(`     Error: ${email.processingError}`);
        }
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkEmailIngests();
