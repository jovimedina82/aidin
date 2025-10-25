import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get the hash of the last audit log entry for chaining
 */
async function lastHash(): Promise<string> {
  try {
    const last = await prisma.auditLog.findFirst({
      orderBy: { id: 'desc' },
      select: { hash: true },
    });
    return last?.hash ?? 'GENESIS';
  } catch (error) {
    console.error('Error fetching last audit hash:', error);
    return 'GENESIS';
  }
}

export type AuditEntry = {
  actorId: string;
  actorEmail: string;
  role: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: any;
  after?: any;
  ip?: string;
  ua?: string;
};

/**
 * Write an audit log entry with tamper-evident chaining
 */
export async function writeAudit(entry: AuditEntry): Promise<{ hash: string }> {
  try {
    const prev = await lastHash();
    
    // Create payload for hashing
    const payload = {
      ...entry,
      prev,
      timestamp: new Date().toISOString(),
    };
    
    const payloadStr = JSON.stringify(payload);
    const hash = crypto.createHash('sha256').update(payloadStr).digest('hex');
    
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        actorEmail: entry.actorEmail,
        role: entry.role,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId || null,
        before: entry.before ? JSON.parse(JSON.stringify(entry.before)) : null,
        after: entry.after ? JSON.parse(JSON.stringify(entry.after)) : null,
        ip: entry.ip || null,
        ua: entry.ua || null,
        prevHash: prev,
        hash,
        payload: payloadStr,
      },
    });
    
    return { hash };
  } catch (error) {
    console.error('Error writing audit log:', error);
    throw error;
  }
}

/**
 * Verify audit log chain integrity
 */
export async function verifyAuditChain(): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  let prevHash = 'GENESIS';
  
  const logs = await prisma.auditLog.findMany({
    orderBy: { id: 'asc' },
  });
  
  for (const log of logs) {
    if (log.prevHash \!== prevHash) {
      errors.push(`Chain break at log ${log.id}: expected prevHash ${prevHash}, got ${log.prevHash}`);
    }
    prevHash = log.hash;
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
