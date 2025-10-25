import { prisma } from '../lib/prisma.js';

async function main() {
  try {
    // Search Email DLQ for GN000011-related failures
    const dlqEntries = await prisma.emailDLQ.findMany({
      where: {
        OR: [
          { subject: { contains: 'GN000011' } },
          { rawPayload: { contains: 'GN000011' } }
        ],
        resolved: false
      },
      orderBy: { failedAt: 'desc' },
      take: 10
    });

    console.log(`Found ${dlqEntries.length} unresolved DLQ entries for GN000011:\n`);

    dlqEntries.forEach((entry, idx) => {
      console.log(`[${idx + 1}] DLQ Entry:`);
      console.log(`  ID: ${entry.id}`);
      console.log(`  Failed At: ${entry.failedAt}`);
      console.log(`  From: ${entry.from || 'N/A'}`);
      console.log(`  Subject: ${entry.subject || 'N/A'}`);
      console.log(`  Message ID: ${entry.messageId || 'N/A'}`);
      console.log(`  Error: ${entry.error}`);
      console.log(`  Retry Count: ${entry.retryCount}`);

      // Try to parse raw payload to get Graph email ID
      try {
        const payload = JSON.parse(entry.rawPayload);
        if (payload.id) {
          console.log(`  Graph Email ID: ${payload.id}`);
        }
      } catch (e) {
        console.log(`  Raw Payload (first 200 chars): ${entry.rawPayload?.substring(0, 200)}...`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
