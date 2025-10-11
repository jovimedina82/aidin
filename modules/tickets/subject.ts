/**
 * Ticket Subject Formatting and Token Extraction
 *
 * Manages canonical subject format: [DEPT######] Original Subject
 *
 * Features:
 * - Formats subjects with department-prefixed ticket IDs
 * - Extracts ticket IDs from subjects (for threading)
 * - Strips existing tokens to avoid duplication
 * - Validates ticket ID format
 * - Preserves original subject text
 */

/**
 * Ticket ID format: 2-5 uppercase letters + 6 digits
 * Examples: IT000045, HR000123, BRK000456
 */
const TICKET_ID_PATTERN = /\[([A-Z]{2,5}\d{6})\]/g;

/**
 * Extract all ticket IDs from a subject line
 *
 * Returns array of ticket IDs found in the subject.
 * Example: "[IT000045] Re: [HR000123] Question" => ["IT000045", "HR000123"]
 *
 * @param subject - Email subject line
 * @returns Array of ticket IDs (may be empty)
 */
export function extractTicketIds(subject: string): string[] {
  if (!subject) return [];

  const matches = subject.matchAll(TICKET_ID_PATTERN);
  const ids: string[] = [];

  for (const match of matches) {
    if (match[1]) {
      ids.push(match[1]);
    }
  }

  return ids;
}

/**
 * Extract the first ticket ID from subject (for threading)
 *
 * @param subject - Email subject line
 * @returns First ticket ID or null
 */
export function extractTicketId(subject: string): string | null {
  const ids = extractTicketIds(subject);
  return ids.length > 0 ? ids[0] : null;
}

/**
 * Strip all ticket ID tokens from subject
 *
 * Removes [DEPT######] patterns and normalizes whitespace.
 * Example: "[IT000045] Re: [HR000123] Question" => "Re: Question"
 *
 * @param subject - Email subject line
 * @returns Subject without ticket tokens
 */
export function stripTicketTokens(subject: string): string {
  if (!subject) return '';

  let cleaned = subject.replace(TICKET_ID_PATTERN, '');

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Remove leading "Re:", "Fwd:", etc. artifacts
  cleaned = cleaned.replace(/^(Re|Fwd|RE|FW|FWD):\s*/i, '');

  return cleaned;
}

/**
 * Format a subject with ticket ID token
 *
 * Adds [DEPT######] prefix to subject, stripping any existing tokens first.
 * Preserves Re:/Fwd: prefixes after the token.
 *
 * Format: [DEPT######] Original Subject
 *
 * Examples:
 * - formatTicketSubject("IT000045", "Printer not working")
 *   => "[IT000045] Printer not working"
 *
 * - formatTicketSubject("IT000045", "Re: [IT000045] Printer not working")
 *   => "[IT000045] Re: Printer not working" (no duplication)
 *
 * @param ticketId - Ticket ID (e.g., "IT000045")
 * @param originalSubject - Original email subject
 * @returns Formatted subject with ticket token
 */
export function formatTicketSubject(ticketId: string, originalSubject: string): string {
  if (!ticketId || !originalSubject) {
    return originalSubject || '';
  }

  // Validate ticket ID format
  if (!isValidTicketId(ticketId)) {
    console.warn(`Invalid ticket ID format: ${ticketId}`);
    return originalSubject;
  }

  // Check if subject already starts with this ticket ID
  if (originalSubject.startsWith(`[${ticketId}]`)) {
    return originalSubject;
  }

  // Strip any existing ticket tokens
  const cleanSubject = stripTicketTokens(originalSubject);

  // Preserve Re:/Fwd: prefixes
  const replyPrefix = originalSubject.match(/^(Re|Fwd|RE|FW|FWD):\s*/i);
  const prefix = replyPrefix ? `${replyPrefix[1]}: ` : '';

  return `[${ticketId}] ${prefix}${cleanSubject}`;
}

/**
 * Validate ticket ID format
 *
 * Format: 2-5 uppercase letters + 6 digits
 * Examples: IT000045 ✓, HR000123 ✓, INVALID ✗
 *
 * @param ticketId - Ticket ID to validate
 * @returns True if valid format
 */
export function isValidTicketId(ticketId: string): boolean {
  if (!ticketId) return false;
  return /^[A-Z]{2,5}\d{6}$/.test(ticketId);
}

/**
 * Parse department code from ticket ID
 *
 * Example: "IT000045" => "IT"
 *
 * @param ticketId - Ticket ID
 * @returns Department code or null
 */
export function getDepartmentCode(ticketId: string): string | null {
  if (!isValidTicketId(ticketId)) return null;
  return ticketId.match(/^([A-Z]{2,5})\d{6}$/)?.[1] || null;
}

/**
 * Parse ticket number from ticket ID
 *
 * Example: "IT000045" => 45
 *
 * @param ticketId - Ticket ID
 * @returns Ticket number or null
 */
export function getTicketNumber(ticketId: string): number | null {
  if (!isValidTicketId(ticketId)) return null;
  const match = ticketId.match(/^[A-Z]{2,5}(\d{6})$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Generate reply subject (adds Re: if not present)
 *
 * @param originalSubject - Original subject with ticket token
 * @returns Reply subject
 */
export function formatReplySubject(originalSubject: string): string {
  if (!originalSubject) return '';

  // Already has Re: prefix
  if (/^Re:/i.test(originalSubject)) {
    return originalSubject;
  }

  return `Re: ${originalSubject}`;
}

/**
 * Check if subject indicates a reply
 *
 * @param subject - Email subject
 * @returns True if subject indicates reply/forward
 */
export function isReplySubject(subject: string): boolean {
  if (!subject) return false;
  return /^(Re|Fwd|RE|FW|FWD):/i.test(subject);
}

/**
 * Normalize subject for comparison (for threading fallback)
 *
 * Removes ticket tokens, reply prefixes, and normalizes whitespace.
 * Used for fuzzy subject-based threading when headers are missing.
 *
 * @param subject - Email subject
 * @returns Normalized subject
 */
export function normalizeSubject(subject: string): string {
  if (!subject) return '';

  let normalized = subject;

  // Strip ticket tokens
  normalized = stripTicketTokens(normalized);

  // Remove reply/forward prefixes
  normalized = normalized.replace(/^(Re|Fwd|RE|FW|FWD):\s*/gi, '');

  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Lowercase for comparison
  normalized = normalized.toLowerCase();

  return normalized;
}
