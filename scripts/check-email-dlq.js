import { PrismaClient } from '../lib/generated/prisma/index.js';
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: ['error']
});

async function main() {
  try {
    // Get all DLQ entries that might be related to GN000011
    const dlqEntries = await prisma.emailDLQ.findMany({
      where: {
        OR: [
          { subject: { contains: 'GN000011' } },
          { rawPayload: { contains: 'GN000011' } }
        ]
      },
      orderBy: { failedAt: 'desc' },
      take: 10
    });

    console.log('\n=== EMAIL DLQ ENTRIES FOR GN000011 ===');
    if (dlqEntries.length === 0) {
      console.log('No DLQ entries found for GN000011');
    } else {
      dlqEntries.forEach((entry, idx) => {
        console.log(`\n[${idx + 1}] Failed at: ${entry.failedAt}`);
        console.log(`    From: ${entry.from || 'N/A'}`);
        console.log(`    Subject: ${entry.subject || 'N/A'}`);
        console.log(`    Error: ${entry.error}`);
        console.log(`    Retry Count: ${entry.retryCount}`);
        console.log(`    Resolved: ${entry.resolved}`);
        console.log(`    Stack Trace: ${entry.stackTrace?.substring(0, 300)}...`);
      });
    }

    // Also check recent DLQ entries regardless of ticket number
    const recentDLQ = await prisma.emailDLQ.findMany({
      orderBy: { failedAt: 'desc' },
      take: 5
    });

    console.log('\n\n=== RECENT EMAIL DLQ ENTRIES (Last 5) ===');
    recentDLQ.forEach((entry, idx) => {
      console.log(`\n[${idx + 1}] Failed at: ${entry.failedAt}`);
      console.log(`    From: ${entry.from || 'N/A'}`);
      console.log(`    Subject: ${entry.subject || 'N/A'}`);
      console.log(`    Error: ${entry.error}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
