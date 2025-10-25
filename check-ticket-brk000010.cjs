const { PrismaClient } = require('./lib/generated/prisma');
const prisma = new PrismaClient();

async function check() {
  try {
    // Find ticket BRK000010
    const ticket = await prisma.ticket.findFirst({
      where: { ticketNumber: 'BRK000010' },
      include: {
        requester: { select: { email: true, firstName: true, lastName: true } },
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            user: { select: { email: true, firstName: true, lastName: true } }
          }
        }
      }
    });

    if (!ticket) {
      console.log('❌ Ticket BRK000010 not found');
      return;
    }

    console.log('📋 Ticket:', ticket.ticketNumber, '-', ticket.title);
    console.log('🆔 Ticket ID:', ticket.id);
    console.log('📧 Requester:', ticket.requester?.email);
    console.log('💬 Comments:', ticket.comments.length);
    console.log('');

    if (ticket.comments.length > 0) {
      console.log('Comments:');
      ticket.comments.forEach((comment, i) => {
        console.log(`  ${i + 1}. ${comment.user?.email || 'Unknown'} - ${comment.createdAt}`);
        console.log(`     ${comment.content.substring(0, 100)}`);
      });
      console.log('');
    }

    // Find emails related to this ticket
    const emails = await prisma.emailIngest.findMany({
      where: {
        OR: [
          { ticketId: ticket.id },
          { subject: { contains: 'BRK000010' } },
          { subject: { contains: 'Amanda Huntsman' } }
        ]
      },
      orderBy: { receivedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        subject: true,
        from: true,
        to: true,
        receivedAt: true,
        processedAt: true,
        ticketId: true,
        inReplyTo: true,
        processingError: true
      }
    });

    console.log('📧 Email Ingests found:', emails.length);
    console.log('');

    emails.forEach((email, i) => {
      console.log(`Email ${i + 1}:`);
      console.log('  Subject:', email.subject);
      console.log('  From:', email.from);
      console.log('  To:', email.to);
      console.log('  Received:', email.receivedAt);
      console.log('  Processed:', email.processedAt || 'NOT PROCESSED');
      console.log('  Ticket ID:', email.ticketId || 'NONE');
      console.log('  In-Reply-To:', email.inReplyTo || 'NONE');
      if (email.processingError) {
        console.log('  ERROR:', email.processingError);
      }
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
