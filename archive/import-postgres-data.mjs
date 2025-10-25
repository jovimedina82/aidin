import { PrismaClient } from '../lib/generated/prisma/index.js';
import fs from 'fs';

console.log('Importing data to PostgreSQL database...\n');

const prisma = new PrismaClient();

try {
  // Read exported data
  const data = JSON.parse(fs.readFileSync('./migration-data.json', 'utf8'));

  // Import roles
  if (data.roles && data.roles.length > 0) {
    console.log('Importing roles...');
    for (const role of data.roles) {
      try {
        await prisma.role.create({ data: role });
      } catch (error) {
        if (!error.message.includes('Unique constraint')) {
          console.error(`  ✗ Error importing role: ${error.message}`);
        }
      }
    }
    console.log(`  ✓ ${data.roles.length} roles processed`);
  }

  // Import users
  if (data.users && data.users.length > 0) {
    console.log('Importing users...');
    for (const user of data.users) {
      try {
        await prisma.user.create({ data: user });
      } catch (error) {
        if (!error.message.includes('Unique constraint')) {
          console.error(`  ✗ Error importing user: ${error.message}`);
        }
      }
    }
    console.log(`  ✓ ${data.users.length} users processed`);
  }

  // Import user roles
  if (data.userRoles && data.userRoles.length > 0) {
    console.log('Importing user roles...');
    for (const userRole of data.userRoles) {
      try {
        await prisma.userRole.create({ data: userRole });
      } catch (error) {
        if (!error.message.includes('Unique constraint')) {
          console.error(`  ✗ Error importing user role: ${error.message}`);
        }
      }
    }
    console.log(`  ✓ ${data.userRoles.length} user roles processed`);
  }

  // Import departments
  if (data.departments && data.departments.length > 0) {
    console.log('Importing departments...');
    for (const dept of data.departments) {
      try {
        await prisma.department.create({ data: dept });
      } catch (error) {
        if (!error.message.includes('Unique constraint')) {
          console.error(`  ✗ Error importing department: ${error.message}`);
        }
      }
    }
    console.log(`  ✓ ${data.departments.length} departments processed`);
  }

  // Import user departments
  if (data.userDepartments && data.userDepartments.length > 0) {
    console.log('Importing user departments...');
    for (const userDept of data.userDepartments) {
      try {
        await prisma.userDepartment.create({ data: userDept });
      } catch (error) {
        if (!error.message.includes('Unique constraint')) {
          console.error(`  ✗ Error importing user department: ${error.message}`);
        }
      }
    }
    console.log(`  ✓ ${data.userDepartments.length} user departments processed`);
  }

  // Import department keywords
  if (data.departmentKeywords && data.departmentKeywords.length > 0) {
    console.log('Importing department keywords...');
    for (const keyword of data.departmentKeywords) {
      try {
        await prisma.departmentKeyword.create({ data: keyword });
      } catch (error) {
        if (!error.message.includes('Unique constraint')) {
          console.error(`  ✗ Error importing keyword: ${error.message}`);
        }
      }
    }
    console.log(`  ✓ ${data.departmentKeywords.length} keywords processed`);
  }

  // Import knowledge base
  if (data.knowledgeBase && data.knowledgeBase.length > 0) {
    console.log('Importing knowledge base...');
    for (const kb of data.knowledgeBase) {
      try {
        await prisma.knowledgeBase.create({ data: kb });
      } catch (error) {
        if (!error.message.includes('Unique constraint')) {
          console.error(`  ✗ Error importing KB: ${error.message}`);
        }
      }
    }
    console.log(`  ✓ ${data.knowledgeBase.length} KB articles processed`);
  }

  // Import tickets
  if (data.tickets && data.tickets.length > 0) {
    console.log('Importing tickets...');
    for (const ticket of data.tickets) {
      try {
        await prisma.ticket.create({ data: ticket });
      } catch (error) {
        if (!error.message.includes('Unique constraint')) {
          console.error(`  ✗ Error importing ticket: ${error.message}`);
        }
      }
    }
    console.log(`  ✓ ${data.tickets.length} tickets processed`);
  }

  // Import ticket comments
  if (data.ticketComments && data.ticketComments.length > 0) {
    console.log('Importing ticket comments...');
    for (const comment of data.ticketComments) {
      try {
        await prisma.ticketComment.create({ data: comment });
      } catch (error) {
        if (!error.message.includes('Unique constraint')) {
          console.error(`  ✗ Error importing comment: ${error.message}`);
        }
      }
    }
    console.log(`  ✓ ${data.ticketComments.length} comments processed`);
  }

  // Import AI decisions
  if (data.aiDecisions && data.aiDecisions.length > 0) {
    console.log('Importing AI decisions...');
    for (const decision of data.aiDecisions) {
      try {
        await prisma.aIDecision.create({ data: decision });
      } catch (error) {
        if (!error.message.includes('Unique constraint')) {
          console.error(`  ✗ Error importing AI decision: ${error.message}`);
        }
      }
    }
    console.log(`  ✓ ${data.aiDecisions.length} AI decisions processed`);
  }

  // Import user preferences
  if (data.userPreferences && data.userPreferences.length > 0) {
    console.log('Importing user preferences...');
    for (const pref of data.userPreferences) {
      try {
        await prisma.userPreference.create({ data: pref });
      } catch (error) {
        if (!error.message.includes('Unique constraint')) {
          console.error(`  ✗ Error importing preference: ${error.message}`);
        }
      }
    }
    console.log(`  ✓ ${data.userPreferences.length} preferences processed`);
  }

  // Import weekly stats
  if (data.weeklyStats && data.weeklyStats.length > 0) {
    console.log('Importing weekly stats...');
    for (const stat of data.weeklyStats) {
      try {
        await prisma.weeklyTicketStats.create({ data: stat });
      } catch (error) {
        if (!error.message.includes('Unique constraint')) {
          console.error(`  ✗ Error importing stat: ${error.message}`);
        }
      }
    }
    console.log(`  ✓ ${data.weeklyStats.length} stats processed`);
  }

  // Import blocked domains
  if (data.blockedDomains && data.blockedDomains.length > 0) {
    console.log('Importing blocked domains...');
    for (const domain of data.blockedDomains) {
      try {
        await prisma.blockedEmailDomain.create({ data: domain });
      } catch (error) {
        if (!error.message.includes('Unique constraint')) {
          console.error(`  ✗ Error importing domain: ${error.message}`);
        }
      }
    }
    console.log(`  ✓ ${data.blockedDomains.length} domains processed`);
  }

  // Import audit logs
  if (data.auditLogs && data.auditLogs.length > 0) {
    console.log('Importing audit logs...');
    for (const log of data.auditLogs) {
      try {
        await prisma.auditLog.create({ data: log });
      } catch (error) {
        if (!error.message.includes('Unique constraint')) {
          console.error(`  ✗ Error importing audit log: ${error.message}`);
        }
      }
    }
    console.log(`  ✓ ${data.auditLogs.length} audit logs processed`);
  }

  console.log('\n✅ Migration completed successfully!');
  console.log('Your data has been imported to PostgreSQL.');

  await prisma.$disconnect();
} catch (error) {
  console.error('\n❌ Import failed:', error);
  await prisma.$disconnect();
  process.exit(1);
}
