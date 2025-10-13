/**
 * CID (Content-ID) Resolver for Inline Images
 *
 * Replaces cid: references in HTML with actual CDN URLs from email attachments
 */

interface EmailAttachment {
  cid: string | null;
  storageUrl: string;
  filename: string;
}

/**
 * Resolve CID references in HTML to actual CDN URLs
 *
 * Example:
 * Input HTML: <img src="cid:image001.png@01DA1234.5678ABCD">
 * Output HTML: <img src="https://cdn.example.com/attachments/abc123.png">
 *
 * @param html - HTML content with cid: references
 * @param attachments - Array of email attachments with CID and CDN URLs
 * @returns HTML with cid: references replaced with CDN URLs
 */
export function resolveCidReferences(html: string, attachments: EmailAttachment[]): string {
  console.log(`🔍 CID Resolver called with ${attachments?.length || 0} attachments`);

  if (!html || !attachments || attachments.length === 0) {
    console.log(`⚠️  CID Resolver: No HTML or attachments provided`);
    return html;
  }

  let resolved = html;

  // Build a map of CID -> CDN URL for quick lookup
  const cidMap = new Map<string, string>();

  for (const att of attachments) {
    console.log(`📎 Attachment: cid=${att.cid}, storageUrl=${att.storageUrl}, filename=${att.filename}`);

    if (att.cid && att.storageUrl) {
      // Normalize CID: remove angle brackets if present
      // Email CIDs can be: "image001.png@01DA1234" or "<image001.png@01DA1234>"
      const normalizedCid = att.cid.replace(/^<|>$/g, '');
      cidMap.set(normalizedCid, att.storageUrl);
      console.log(`✅ Added to CID map: ${normalizedCid} -> ${att.storageUrl}`);
    }
  }

  console.log(`📊 CID map size: ${cidMap.size}`);

  if (cidMap.size === 0) {
    console.warn(`⚠️  No inline images found in attachments (all attachments missing CID or storageUrl)`);
    return html; // No inline images
  }

  // Replace all cid: references with CDN URLs
  // Pattern: src="cid:image001.png@01DA1234.5678ABCD"
  resolved = resolved.replace(/src\s*=\s*["']cid:([^"']+)["']/gi, (match, cid) => {
    const normalizedCid = cid.trim();
    let cdnUrl = cidMap.get(normalizedCid);

    // If exact match not found, try partial match (before @)
    // Microsoft Graph often returns CID without domain part
    // HTML: cid:abc@domain.com, Attachment CID: abc
    if (!cdnUrl && normalizedCid.includes('@')) {
      const shortCid = normalizedCid.split('@')[0];
      cdnUrl = cidMap.get(shortCid);

      if (cdnUrl) {
        console.log(`✅ Resolved CID (partial match): cid:${normalizedCid} -> ${cdnUrl}`);
        return `src="${cdnUrl}"`;
      }
    }

    if (cdnUrl) {
      console.log(`✅ Resolved CID: cid:${normalizedCid} -> ${cdnUrl}`);
      return `src="${cdnUrl}"`;
    }

    // CID not found - log warning and leave as-is
    console.warn(`⚠️  Unresolved CID reference: cid:${normalizedCid}`);
    return match;
  });

  return resolved;
}

/**
 * Extract all CID references from HTML
 * Useful for debugging/logging
 */
export function extractCidReferences(html: string): string[] {
  if (!html) return [];

  const cidPattern = /src\s*=\s*["']cid:([^"']+)["']/gi;
  const cids: string[] = [];
  let match;

  while ((match = cidPattern.exec(html)) !== null) {
    cids.push(match[1]);
  }

  return cids;
}
