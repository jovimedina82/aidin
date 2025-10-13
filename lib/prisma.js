import { PrismaClient } from './generated/prisma/index.js'

const globalForPrisma = globalThis

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Only log errors and warnings in development, nothing in production
    log: process.env.NODE_ENV === 'development'
      ? ['error', 'warn']
      : ['error'],
    // Connection pool configuration for better performance
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

// Ensure single instance in development
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})