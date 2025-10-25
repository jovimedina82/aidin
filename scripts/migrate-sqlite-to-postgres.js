import { PrismaClient as SqlitePrisma } from '@prisma/client';
import { PrismaClient as PostgresPrisma } from '../lib/generated/prisma/index.js';
import Database from 'better-sqlite3';

// SQLite connection (direct)
const sqliteDb = new Database('./prisma/dev.db');

// PostgreSQL connection (via Prisma)
const pgPrisma = new PostgresPrisma();

async function migrateData() {
  console.log('Starting migration from SQLite to PostgreSQL...\n');

  try {
    // Define migration order (respecting foreign key constraints)
    const tables = [
      'roles',
      'users',
      'user_roles',
      'departments',
      'user_departments',
      'department_keywords',
      'knowledge_base',
      'tickets',
      'ticket_comments',
      'ai_decisions',
      'ticket_kb_usage',
      'user_preferences',
      'weekly_ticket_stats',
      'audit_log',
      'audit_log_dlq',
      'audit_chain_verification',
      'attachments',
      'attachment_deletion_logs',
      'classifier_feedback',
      'email_ingest',
      'email_attachments',
      'ticket_messages',
      'department_sequences',
      'tags',
      'ticket_tags',
      'rate_limit_entries',
      'email_dlq',
      'inbound_messages',
      'message_assets',
      'blocked_email_domains'
    ];

    for (const table of tables) {
      console.log(`\nMigrating table: ${table}`);

      // Get count
      const countResult = sqliteDb.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
      const count = countResult.count;

      if (count === 0) {
        console.log(`  ✓ Skipped (empty table)`);
        continue;
      }

      console.log(`  Found ${count} records`);

      // Get all data from SQLite
      const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();

      // Insert into PostgreSQL using raw SQL
      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const columnNames = columns.join(', ');

        let inserted = 0;
        for (const row of rows) {
          try {
            const values = columns.map(col => {
              const val = row[col];
              // Handle booleans and null values
              if (val === null || val === undefined) return null;
              if (typeof val === 'boolean') return val;
              return val;
            });

            await pgPrisma.$executeRawUnsafe(
              `INSERT INTO ${table} (${columnNames}) VALUES (${placeholders})`,
              ...values
            );
            inserted++;
          } catch (error) {
            console.error(`  ✗ Error inserting row:`, error.message);
          }
        }
        console.log(`  ✓ Migrated ${inserted}/${rows.length} records`);
      }
    }

    console.log('\n✓ Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await pgPrisma.$disconnect();
    sqliteDb.close();
  }
}

migrateData()
  .then(() => {
    console.log('\nAll done! Your data has been migrated to PostgreSQL.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
