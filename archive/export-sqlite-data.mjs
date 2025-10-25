import { PrismaClient } from '../lib/generated/prisma/index.js';
import fs from 'fs';

console.log('Exporting data from SQLite database...\n');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:../prisma/dev.db'
    }
  }
});

try {
  const data = {};

  console.log('Exporting roles...');
  data.roles = await prisma.role.findMany();
  console.log(`  ✓ ${data.roles.length} roles`);

  console.log('Exporting users...');
  data.users = await prisma.user.findMany();
  console.log(`  ✓ ${data.users.length} users`);

  console.log('Exporting user roles...');
  data.userRoles = await prisma.userRole.findMany();
  console.log(`  ✓ ${data.userRoles.length} user roles`);

  console.log('Exporting departments...');
  data.departments = await prisma.department.findMany();
  console.log(`  ✓ ${data.departments.length} departments`);

  console.log('Exporting user departments...');
  data.userDepartments = await prisma.userDepartment.findMany();
  console.log(`  ✓ ${data.userDepartments.length} user departments`);

  console.log('Exporting department keywords...');
  data.departmentKeywords = await prisma.departmentKeyword.findMany();
  console.log(`  ✓ ${data.departmentKeywords.length} department keywords`);

  console.log('Exporting knowledge base...');
  data.knowledgeBase = await prisma.knowledgeBase.findMany();
  console.log(`  ✓ ${data.knowledgeBase.length} knowledge base articles`);

  console.log('Exporting tickets...');
  data.tickets = await prisma.ticket.findMany();
  console.log(`  ✓ ${data.tickets.length} tickets`);

  console.log('Exporting ticket comments...');
  data.ticketComments = await prisma.ticketComment.findMany();
  console.log(`  ✓ ${data.ticketComments.length} ticket comments`);

  console.log('Exporting AI decisions...');
  data.aiDecisions = await prisma.aIDecision.findMany();
  console.log(`  ✓ ${data.aiDecisions.length} AI decisions`);

  console.log('Exporting user preferences...');
  data.userPreferences = await prisma.userPreference.findMany();
  console.log(`  ✓ ${data.userPreferences.length} user preferences`);

  console.log('Exporting weekly stats...');
  data.weeklyStats = await prisma.weeklyTicketStats.findMany();
  console.log(`  ✓ ${data.weeklyStats.length} weekly stats`);

  console.log('Exporting blocked domains...');
  data.blockedDomains = await prisma.blockedEmailDomain.findMany();
  console.log(`  ✓ ${data.blockedDomains.length} blocked domains`);

  console.log('Exporting audit logs...');
  data.auditLogs = await prisma.auditLog.findMany();
  console.log(`  ✓ ${data.auditLogs.length} audit logs`);

  // Save to JSON file
  fs.writeFileSync('./migration-data.json', JSON.stringify(data, null, 2));
  console.log(`\n✅ Data exported to migration-data.json`);

  await prisma.$disconnect();
} catch (error) {
  console.error('\n❌ Export failed:', error);
  await prisma.$disconnect();
  process.exit(1);
}
