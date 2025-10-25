import { PrismaClient } from '../lib/generated/prisma/index.js';
import { readFileSync } from 'fs';

const prisma = new PrismaClient();
const sql = readFileSync('./scripts/create-module-tables.sql', 'utf-8');

async function run() {
  try {
    const statements = sql.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        await prisma.$executeRawUnsafe(statement);
      }
    }
    console.log('✅ Tables created successfully');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
