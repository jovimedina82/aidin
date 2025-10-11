/**
 * Forwarded Email Parser
 *
 * Extracts original message content from forwarded emails.
 * Handles multiple forward formats (Outlook, Gmail, Apple Mail, etc.)
 */

interface ForwardedEmail {
  isForwarded: boolean;
  originalFrom?: string;
  originalSubject?: string;
  originalDate?: string;
  originalBody: string;
  forwarderNotes?: string;
}

/**
 * Parse forwarded email to extract original content
 */
export function parseForwardedEmail(text: string, html: string): ForwardedEmail {
  const result: ForwardedEmail = {
    isForwarded: false,
    originalBody: text || html || ''
  };

  // Check if email is forwarded
  const forwardIndicators = [
    /^-+\s*Forwarded [Mm]essage\s*-+/m,
    /^From:\s*.+$/m,
    /^Sent:\s*.+$/m,
    /^Subject:\s*.+$/m,
    /^To:\s*.+$/m,
    /^>+\s*From:/m, // Quote-style forwards
  ];

  const hasForwardIndicator = forwardIndicators.some(regex => regex.test(text));

  if (!hasForwardIndicator) {
    return result;
  }

  result.isForwarded = true;

  // Try to extract forwarded content using common patterns

  // Pattern 1: Outlook/Office 365 format
  // ________________________________
  // From: Name <email>
  // Sent: Date
  // To: recipient
  // Subject: subject
  //
  // Body...
  const outlookMatch = text.match(
    /_{10,}\s*\n\s*From:\s*([^\n]+)\s*\n\s*(?:Sent|Date):\s*([^\n]+)\s*\n.*?Subject:\s*([^\n]+)\s*\n\s*\n([\s\S]+)/i
  );

  if (outlookMatch) {
    result.originalFrom = outlookMatch[1].trim();
    result.originalDate = outlookMatch[2].trim();
    result.originalSubject = outlookMatch[3].trim();
    result.originalBody = outlookMatch[4].trim();

    // Extract forwarder's notes (text before the forward marker)
    const beforeForward = text.split(/_{10,}/)[0];
    if (beforeForward && beforeForward.trim()) {
      result.forwarderNotes = beforeForward.trim();
    }

    return result;
  }

  // Pattern 2: Gmail format
  // ---------- Forwarded message ---------
  // From: Name <email>
  // Date: date
  // Subject: subject
  // To: recipient
  //
  // Body...
  const gmailMatch = text.match(
    /-+ Forwarded message -+\s*\n\s*From:\s*([^\n]+)\s*\n\s*Date:\s*([^\n]+)\s*\n\s*Subject:\s*([^\n]+)\s*\n.*?\n\s*\n([\s\S]+)/i
  );

  if (gmailMatch) {
    result.originalFrom = gmailMatch[1].trim();
    result.originalDate = gmailMatch[2].trim();
    result.originalSubject = gmailMatch[3].trim();
    result.originalBody = gmailMatch[4].trim();

    const beforeForward = text.split(/-+ Forwarded message -+/)[0];
    if (beforeForward && beforeForward.trim()) {
      result.forwarderNotes = beforeForward.trim();
    }

    return result;
  }

  // Pattern 3: Apple Mail / Generic format
  // Begin forwarded message:
  //
  // From: Name <email>
  // Subject: subject
  // Date: date
  // To: recipient
  //
  // Body...
  const appleMatch = text.match(
    /Begin forwarded message:\s*\n\s*(?:From:\s*([^\n]+)\s*\n)?.*?Subject:\s*([^\n]+)\s*\n.*?(?:Date|Sent):\s*([^\n]+)\s*\n.*?\n\s*\n([\s\S]+)/i
  );

  if (appleMatch) {
    result.originalFrom = appleMatch[1]?.trim();
    result.originalSubject = appleMatch[2].trim();
    result.originalDate = appleMatch[3].trim();
    result.originalBody = appleMatch[4].trim();

    const beforeForward = text.split(/Begin forwarded message:/i)[0];
    if (beforeForward && beforeForward.trim()) {
      result.forwarderNotes = beforeForward.trim();
    }

    return result;
  }

  // Pattern 4: Simple quoted forward (>From:, >Sent:, etc.)
  const quotedMatch = text.match(
    />+\s*From:\s*([^\n]+)\s*\n>+\s*(?:Sent|Date):\s*([^\n]+)\s*\n>+\s*Subject:\s*([^\n]+)\s*\n>*\s*\n([\s\S]+)/i
  );

  if (quotedMatch) {
    result.originalFrom = quotedMatch[1].trim();
    result.originalDate = quotedMatch[2].trim();
    result.originalSubject = quotedMatch[3].trim();

    // Remove quote markers from body
    const bodyLines = quotedMatch[4].split('\n').map(line => line.replace(/^>+\s*/, ''));
    result.originalBody = bodyLines.join('\n').trim();

    const beforeForward = text.split(/>+\s*From:/)[0];
    if (beforeForward && beforeForward.trim()) {
      result.forwarderNotes = beforeForward.trim();
    }

    return result;
  }

  // Fallback: Try to find "From:" as a simple marker
  const simpleMatch = text.match(
    /(?:^|\n)From:\s*([^\n]+)[\s\S]*?(?:^|\n)Subject:\s*([^\n]+)[\s\S]*?\n\n([\s\S]+)/i
  );

  if (simpleMatch) {
    result.originalFrom = simpleMatch[1].trim();
    result.originalSubject = simpleMatch[2].trim();
    result.originalBody = simpleMatch[3].trim();

    const beforeFrom = text.split(/(?:^|\n)From:/)[0];
    if (beforeFrom && beforeFrom.trim()) {
      result.forwarderNotes = beforeFrom.trim();
    }

    return result;
  }

  // No pattern matched, return original text
  return result;
}

/**
 * Clean up forwarder notes to extract actionable content
 */
export function extractForwarderContext(notes: string): string {
  if (!notes) return '';

  // Remove common email signature patterns
  const cleaned = notes
    .replace(/^-+$/gm, '') // Remove separator lines
    .replace(/_{10,}/g, '') // Remove underscores
    .replace(/^>+\s*/gm, '') // Remove quote markers
    .trim();

  return cleaned;
}
