/**
 * Email parser - unify Microsoft Graph and MIME/raw email formats
 * Extracts HTML, text, and parts (attachments/inline images)
 */

import { simpleParser, ParsedMail, Attachment } from 'mailparser';

export interface EmailPart {
  contentId?: string;
  filename: string;
  contentType: string;
  disposition?: 'inline' | 'attachment';
  buffer: Buffer;
  size: number;
}

export interface ParsedEmail {
  messageId: string;
  from: string;
  subject: string;
  html?: string;
  text?: string;
  parts: EmailPart[];
}

/**
 * Parse Microsoft Graph email format
 */
export async function parseGraphEmail(graphPayload: any): Promise<ParsedEmail> {
  const {
    id,
    internetMessageId,
    from,
    subject,
    body,
    bodyPreview,
    hasAttachments,
    attachments = [],
  } = graphPayload;

  const parts: EmailPart[] = [];

  // Process attachments from Graph API
  for (const att of attachments) {
    if (att['@odata.type'] === '#microsoft.graph.fileAttachment') {
      const buffer = Buffer.from(att.contentBytes || '', 'base64');
      parts.push({
        contentId: att.contentId || undefined,
        filename: att.name,
        contentType: att.contentType,
        disposition: att.isInline ? 'inline' : 'attachment',
        buffer,
        size: att.size || buffer.length,
      });
    }
  }

  return {
    messageId: internetMessageId || id,
    from: from?.emailAddress?.address || from,
    subject: subject || '(No Subject)',
    html: body?.contentType === 'html' ? body.content : undefined,
    text: body?.contentType === 'text' ? body.content : bodyPreview,
    parts,
  };
}

/**
 * Parse raw MIME email
 */
export async function parseMimeEmail(mimeContent: string | Buffer): Promise<ParsedEmail> {
  const parsed: ParsedMail = await simpleParser(mimeContent);

  const parts: EmailPart[] = [];

  // Extract attachments
  if (parsed.attachments) {
    for (const att of parsed.attachments) {
      parts.push({
        contentId: att.contentId ? att.contentId.replace(/^<|>$/g, '') : undefined,
        filename: att.filename || 'unnamed',
        contentType: att.contentType,
        disposition: att.contentDisposition === 'inline' ? 'inline' : 'attachment',
        buffer: att.content,
        size: att.size,
      });
    }
  }

  return {
    messageId: parsed.messageId || '',
    from: parsed.from?.value?.[0]?.address || parsed.from?.text || '',
    subject: parsed.subject || '(No Subject)',
    html: parsed.html ? parsed.html.toString() : undefined,
    text: parsed.text || parsed.textAsHtml || undefined,
    parts,
  };
}

/**
 * Universal email parser - auto-detect format
 */
export async function parseEmail(input: any): Promise<ParsedEmail> {
  // Check if it's Microsoft Graph format
  if (input && typeof input === 'object' && (input.internetMessageId || input.from?.emailAddress)) {
    return parseGraphEmail(input);
  }

  // Check if it's raw MIME
  if (typeof input === 'string' || Buffer.isBuffer(input)) {
    return parseMimeEmail(input);
  }

  // Check if it's pre-parsed with 'parts' array (custom format)
  if (input && typeof input === 'object' && Array.isArray(input.parts)) {
    return input as ParsedEmail;
  }

  throw new Error('Unsupported email format');
}

/**
 * Extract inline images (parts with Content-ID)
 */
export function extractInlineImages(parts: EmailPart[]): EmailPart[] {
  return parts.filter((p) => p.contentId && p.disposition === 'inline' && p.contentType.startsWith('image/'));
}

/**
 * Extract attachments (non-inline parts)
 */
export function extractAttachments(parts: EmailPart[]): EmailPart[] {
  return parts.filter((p) => p.disposition !== 'inline' || !p.contentId);
}

/**
 * Extract all image attachments (inline or not)
 */
export function extractImageAttachments(parts: EmailPart[]): EmailPart[] {
  return parts.filter((p) => p.contentType.startsWith('image/'));
}
