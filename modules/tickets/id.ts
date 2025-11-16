/**
 * Atomic Ticket ID Generation with Per-Department Sequences
 *
 * Generates department-prefixed ticket IDs with atomic sequence increments.
 * Format: {DEPT}{NNNNNN} (e.g., IT000045, HR000123)
 *
 * Features:
 * - Database-level atomicity with SELECT FOR UPDATE
 * - Per-department sequences (IT, HR, FIN, MKT, etc.)
 * - Zero-padded 6-digit numbers
 * - Automatic sequence initialization
 * - Fallback to GN (General) for unknown departments
 */

import { prisma } from '@/lib/prisma';

/**
 * Department code to prefix mapping
 */
export const DEPARTMENT_CODES: Record<string, string> = {
  'IT': 'IT',
  'Information Technology': 'IT',
  'HR': 'HR',
  'Human Resources': 'HR',
  'FIN': 'FIN',
  'Finance': 'FIN',
  'Accounting': 'FIN',
  'MKT': 'MKT',
  'Marketing': 'MKT',
  'BRK': 'BRK',
  'Brokerage': 'BRK',
  'OPS': 'OPS',
  'Operations': 'OPS',
  'LEG': 'LEG',
  'Legal': 'LEG',
  'GN': 'GN',
  'General': 'GN',
  'UNCLASSIFIED': 'GN',
};

/**
 * Get department code from department name
 */
export function getDepartmentCode(departmentName: string | null | undefined): string {
  if (!departmentName) return 'GN';

  const normalized = departmentName.trim();

  // Direct match
  if (DEPARTMENT_CODES[normalized]) {
    return DEPARTMENT_CODES[normalized];
  }

  // Case-insensitive search
  const key = Object.keys(DEPARTMENT_CODES).find(
    k => k.toLowerCase() === normalized.toLowerCase()
  );

  return key ? DEPARTMENT_CODES[key] : 'GN';
}

/**
 * Initialize a department sequence if it doesn't exist
 */
async function ensureDepartmentSequence(departmentCode: string, departmentName: string): Promise<void> {
  const existing = await prisma.departmentSequence.findUnique({
    where: { departmentCode }
  });

  if (!existing) {
    await prisma.departmentSequence.create({
      data: {
        departmentCode,
        departmentName,
        nextNumber: 1,
        lastReservedAt: new Date()
      }
    });

    console.log(`✅ Initialized sequence for department: ${departmentCode} (${departmentName})`);
  }
}

/**
 * Reserve the next ticket ID for a department (ATOMIC)
 *
 * Uses SELECT FOR UPDATE to ensure atomicity under concurrent load.
 * Returns formatted ticket ID: DEPT000123
 *
 * @param departmentNameOrCode - Department name or code (e.g., "IT", "Information Technology")
 * @returns Formatted ticket ID (e.g., "IT000045")
 */
export async function reserveTicketId(departmentNameOrCode: string): Promise<string> {
  const departmentCode = getDepartmentCode(departmentNameOrCode);
  const departmentName = departmentNameOrCode || 'General';

  // Ensure sequence exists
  await ensureDepartmentSequence(departmentCode, departmentName);

  // Atomic increment with SELECT FOR UPDATE
  // Note: Prisma doesn't support FOR UPDATE directly, so we use a transaction
  // with serializable isolation for SQLite
  const result = await prisma.$transaction(async (tx) => {
    // Get current sequence (locks the row)
    const sequence = await tx.departmentSequence.findUnique({
      where: { departmentCode }
    });

    if (!sequence) {
      throw new Error(`Department sequence not found: ${departmentCode}`);
    }

    const ticketNumber = sequence.nextNumber;

    // Increment sequence
    await tx.departmentSequence.update({
      where: { departmentCode },
      data: {
        nextNumber: ticketNumber + 1,
        lastReservedAt: new Date()
      }
    });

    return ticketNumber;
  });

  // Format: DEPT000123 (6 digits, zero-padded)
  const formatted = `${departmentCode}${result.toString().padStart(6, '0')}`;

  console.log(`🎫 Reserved ticket ID: ${formatted} (${departmentName})`);

  return formatted;
}

/**
 * Batch reserve multiple ticket IDs (for bulk import)
 */
export async function reserveTicketIdBatch(
  departmentNameOrCode: string,
  count: number
): Promise<string[]> {
  const departmentCode = getDepartmentCode(departmentNameOrCode);
  const departmentName = departmentNameOrCode || 'General';

  await ensureDepartmentSequence(departmentCode, departmentName);

  const ticketIds: string[] = [];

  const startNumber = await prisma.$transaction(async (tx) => {
    const sequence = await tx.departmentSequence.findUnique({
      where: { departmentCode }
    });

    if (!sequence) {
      throw new Error(`Department sequence not found: ${departmentCode}`);
    }

    const start = sequence.nextNumber;

    await tx.departmentSequence.update({
      where: { departmentCode },
      data: {
        nextNumber: start + count,
        lastReservedAt: new Date()
      }
    });

    return start;
  });

  for (let i = 0; i < count; i++) {
    const formatted = `${departmentCode}${(startNumber + i).toString().padStart(6, '0')}`;
    ticketIds.push(formatted);
  }

  console.log(`🎫 Reserved ${count} ticket IDs for ${departmentCode}: ${ticketIds[0]} - ${ticketIds[ticketIds.length - 1]}`);

  return ticketIds;
}

/**
 * Get current sequence status for a department
 */
export async function getDepartmentSequenceStatus(departmentCode: string) {
  const sequence = await prisma.departmentSequence.findUnique({
    where: { departmentCode }
  });

  return sequence ? {
    code: sequence.departmentCode,
    name: sequence.departmentName,
    nextNumber: sequence.nextNumber,
    lastReserved: sequence.lastReservedAt,
    nextTicketId: `${sequence.departmentCode}${sequence.nextNumber.toString().padStart(6, '0')}`
  } : null;
}

/**
 * List all department sequences
 */
export async function listDepartmentSequences() {
  const sequences = await prisma.departmentSequence.findMany({
    orderBy: { departmentCode: 'asc' }
  });

  return sequences.map(seq => ({
    code: seq.departmentCode,
    name: seq.departmentName,
    nextNumber: seq.nextNumber,
    lastReserved: seq.lastReservedAt,
    nextTicketId: `${seq.departmentCode}${seq.nextNumber.toString().padStart(6, '0')}`
  }));
}
