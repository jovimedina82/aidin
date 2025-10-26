const { PrismaClient } = require('./lib/generated/prisma');
const prisma = new PrismaClient();

async function checkTicket() {
  try {
    const ticket = await prisma.ticket.findFirst({
      where: { ticketNumber: 'IT000006' },
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
      console.log('❌ Ticket IT000006 not found');
      return;
    }

    console.log('📋 Ticket:', ticket.ticketNumber, '-', ticket.title);
    console.log('📧 Requester:', ticket.requester.email);
    console.log('📅 Created:', ticket.createdAt);
    console.log('📅 Updated:', ticket.updatedAt);
    console.log('💬 Comments in database:', ticket.comments.length);
    console.log('');

    if (ticket.comments.length === 0) {
      console.log('⚠️  No comments found in database!');
    } else {
      ticket.comments.forEach((comment, i) => {
        console.log(`Comment ${i + 1}:`);
        console.log('  ID:', comment.id);
        console.log('  Author:', comment.user?.email || 'Unknown');
        console.log('  Created:', comment.createdAt);
        console.log('  Public:', comment.isPublic);
        console.log('  Content:', comment.content.substring(0, 150));
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTicket();
