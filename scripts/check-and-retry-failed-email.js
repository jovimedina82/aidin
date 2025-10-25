import { prisma } from '../lib/prisma.js';

async function main() {
  try {
    // Find email ingest record for GN000011 that might not be fully processed
    const ticket = await prisma.ticket.findUnique({
      where: { ticketNumber: 'GN000011' }
    });

    if (!ticket) {
      console.log('Ticket GN000011 not found!');
      return;
    }

    console.log(`Found ticket: ${ticket.ticketNumber} (ID: ${ticket.id})`);

    // Check for email ingest records related to this ticket
    const emailIngests = await prisma.emailIngest.findMany({
      where: {
        OR: [
          { ticketId: ticket.id },
          { subject: { contains: 'GN000011' } }
        ]
      },
      orderBy: { receivedAt: 'desc' }
    });

    console.log(`\nFound ${emailIngests.length} email ingest records:`);
    emailIngests.forEach((email, idx) => {
      console.log(`\n[${idx + 1}]:`);
      console.log(`  ID: ${email.id}`);
      console.log(`  From: ${email.from}`);
      console.log(`  Subject: ${email.subject}`);
      console.log(`  Received: ${email.receivedAt}`);
      console.log(`  Processed: ${email.processedAt ? 'Yes' : 'NO'}`);
      console.log(`  Ticket ID: ${email.ticketId || 'NULL'}`);
    });

    // Check for ticket messages
    const ticketMessages = await prisma.ticketMessage.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`\n\nFound ${ticketMessages.length} ticket messages:`);
    ticketMessages.forEach((msg, idx) => {
      console.log(`\n[${idx + 1}]:`);
      console.log(`  Kind: ${msg.kind}`);
      console.log(`  From: ${msg.authorEmail}`);
      console.log(`  Subject: ${msg.subject || 'N/A'}`);
      console.log(`  Created: ${msg.createdAt}`);
      console.log(`  Text preview: ${msg.text?.substring(0, 100)}...`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
