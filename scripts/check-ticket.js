import { PrismaClient } from '../lib/generated/prisma/index.js';
const prisma = new PrismaClient();

async function main() {
  const ticketNumber = 'GN000011';

  // Get ticket
  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber },
    include: {
      requester: true,
      assignee: true,
    }
  });

  if (!ticket) {
    console.log(`Ticket ${ticketNumber} not found`);
    return;
  }

  console.log('\n=== TICKET ===');
  console.log(`Number: ${ticket.ticketNumber}`);
  console.log(`Title: ${ticket.title}`);
  console.log(`Status: ${ticket.status}`);
  console.log(`Requester: ${ticket.requester?.email}`);
  console.log(`Created: ${ticket.createdAt}`);

  // Get ticket messages
  const messages = await prisma.ticketMessage.findMany({
    where: { ticketId: ticket.id },
    orderBy: { createdAt: 'asc' }
  });

  console.log('\n=== TICKET MESSAGES ===');
  messages.forEach((msg, idx) => {
    console.log(`\n[${idx + 1}] ${msg.kind} - ${msg.authorEmail || msg.authorName}`);
    console.log(`    Created: ${msg.createdAt}`);
    console.log(`    Subject: ${msg.subject || 'N/A'}`);
    console.log(`    Text: ${msg.text?.substring(0, 150)}...`);
  });

  // Get email ingest records
  const emails = await prisma.emailIngest.findMany({
    where: {
      OR: [
        { ticketId: ticket.id },
        {
          inReplyTo: {
            in: await prisma.emailIngest.findMany({
              where: { ticketId: ticket.id },
              select: { messageId: true }
            }).then(msgs => msgs.map(m => m.messageId))
          }
        }
      ]
    },
    orderBy: { receivedAt: 'asc' }
  });

  console.log('\n=== EMAIL INGEST RECORDS ===');
  emails.forEach((email, idx) => {
    console.log(`\n[${idx + 1}] From: ${email.from}`);
    console.log(`    MessageID: ${email.messageId}`);
    console.log(`    InReplyTo: ${email.inReplyTo || 'N/A'}`);
    console.log(`    Subject: ${email.subject}`);
    console.log(`    Received: ${email.receivedAt}`);
    console.log(`    Processed: ${email.processedAt || 'NOT PROCESSED'}`);
    console.log(`    TicketId: ${email.ticketId || 'NO TICKET'}`);
    console.log(`    Error: ${email.processingError || 'None'}`);
    console.log(`    Text: ${email.text?.substring(0, 150)}...`);
  });

  // Get inbound messages
  const inboundMessages = await prisma.inboundMessage.findMany({
    where: { ticketId: ticket.id },
    orderBy: { receivedAt: 'asc' }
  });

  console.log('\n=== INBOUND MESSAGES ===');
  inboundMessages.forEach((msg, idx) => {
    console.log(`\n[${idx + 1}] From: ${msg.from}`);
    console.log(`    MessageID: ${msg.messageId}`);
    console.log(`    Subject: ${msg.subject}`);
    console.log(`    Received: ${msg.receivedAt}`);
    console.log(`    Text: ${msg.textPlain?.substring(0, 150)}...`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
