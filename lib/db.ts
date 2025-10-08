import { PrismaClient } from '@/lib/generated/prisma'

/**
 * Prisma Client singleton to prevent connection pool exhaustion
 * Handles hot-reload in development without creating multiple instances
 */

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

/**
 * Test database connection (dev-only helper)
 * Returns true if connection is healthy, false otherwise
 */
export async function testConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('[DB] Connection test failed:', error)
    return false
  }
}

/**
 * Gracefully disconnect Prisma client
 * Call during application shutdown
 */
export async function disconnect(): Promise<void> {
  await prisma.$disconnect()
}
