import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/health
 *
 * Health check endpoint for load balancers and monitoring.
 * Returns system health status including database connectivity.
 */
export async function GET() {
  const startTime = Date.now();

  const health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    version: string;
    checks: {
      database: { status: string; responseTime?: number; error?: string };
      memory: { status: string; usage: NodeJS.MemoryUsage };
    };
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '0.1.0',
    checks: {
      database: { status: 'unknown' },
      memory: { status: 'unknown', usage: process.memoryUsage() },
    },
  };

  // Check database connectivity
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbResponseTime = Date.now() - dbStart;

    health.checks.database = {
      status: 'healthy',
      responseTime: dbResponseTime,
    };

    // Warn if database is slow
    if (dbResponseTime > 1000) {
      health.checks.database.status = 'degraded';
      health.status = 'degraded';
    }
  } catch (error: any) {
    health.checks.database = {
      status: 'unhealthy',
      error: error.message,
    };
    health.status = 'unhealthy';
  }

  // Check memory usage
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
  const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
  const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;

  if (heapUsagePercent > 90) {
    health.checks.memory.status = 'critical';
    health.status = 'degraded';
  } else if (heapUsagePercent > 75) {
    health.checks.memory.status = 'warning';
  } else {
    health.checks.memory.status = 'healthy';
  }

  // Response time
  const totalResponseTime = Date.now() - startTime;

  // Return appropriate status code
  const statusCode = health.status === 'unhealthy' ? 503 : 200;

  return NextResponse.json(
    {
      ...health,
      responseTime: totalResponseTime,
    },
    { status: statusCode }
  );
}

// Also support HEAD requests for simple uptime checks
export async function HEAD() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
