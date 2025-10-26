const { PrismaClient } = require('./lib/generated/prisma');
const prisma = new PrismaClient();

async function checkRecentEmails() {
  try {
    // Get last 20 email ingests
    const recentEmails = await prisma.emailIngest.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        subject: true,
        from: true,
        receivedAt: true,
        processedAt: true,
        ticketId: true
      }
    });

    console.log(`📧 Last 20 Email Ingests:\n`);

    recentEmails.forEach((email, i) => {
      console.log(`${i + 1}. ${email.subject}`);
      console.log(`   From: ${email.from}`);
      console.log(`   Received: ${email.receivedAt}`);
      console.log(`   Ticket ID: ${email.ticketId || 'NONE'}`);
      console.log('');
    });

    // Search for BRK000010 or Amanda Huntsman
    const brk000010Emails = await prisma.emailIngest.findMany({
      where: {
        OR: [
          { subject: { contains: 'BRK000010', mode: 'insensitive' } },
          { subject: { contains: 'Amanda Huntsman', mode: 'insensitive' } }
        ]
      },
      orderBy: { receivedAt: 'desc' }
    });

    console.log(`\n🔍 Emails matching "BRK000010" or "Amanda Huntsman": ${brk000010Emails.length}\n`);

    brk000010Emails.forEach((email, i) => {
      console.log(`${i + 1}. ${email.subject}`);
      console.log(`   From: ${email.from}`);
      console.log(`   Received: ${email.receivedAt}`);
      console.log(`   Ticket ID: ${email.ticketId || 'NONE'}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecentEmails();
