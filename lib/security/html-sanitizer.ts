/**
 * HTML Sanitizer for Email Content
 *
 * DOMPurify-style sanitization to prevent XSS attacks from email HTML.
 *
 * Features:
 * - Removes dangerous tags (<script>, <iframe>, <object>, <embed>)
 * - Strips event handlers (onclick, onload, etc.)
 * - Whitelist safe tags only
 * - Sanitizes data: URLs in images
 * - Preserves inline images with cid: URLs
 * - Configurable strict mode
 */

// Safe HTML tags whitelist
const ALLOWED_TAGS = [
  'p', 'div', 'span', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'em', 'b', 'i', 'u', 's', 'strike',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'a', 'img',
  'blockquote', 'pre', 'code',
  'dl', 'dt', 'dd'
];

// Safe attributes whitelist per tag
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  'a': ['href', 'title', 'target'],
  'img': ['src', 'alt', 'title', 'width', 'height'],
  'td': ['colspan', 'rowspan'],
  'th': ['colspan', 'rowspan'],
  '*': ['class', 'id'], // Allowed on all tags
};

// Dangerous tag patterns
const DANGEROUS_TAGS = [
  'script', 'iframe', 'object', 'embed', 'applet',
  'link', 'style', 'meta', 'base', 'form', 'input',
  'button', 'textarea', 'select', 'option'
];

// Event handler attributes (XSS vectors)
const EVENT_HANDLERS = [
  'onclick', 'ondblclick', 'onmousedown', 'onmouseup', 'onmouseover', 'onmousemove', 'onmouseout',
  'onkeydown', 'onkeyup', 'onkeypress',
  'onload', 'onerror', 'onabort', 'onunload', 'onbeforeunload',
  'onsubmit', 'onreset', 'onchange', 'onfocus', 'onblur',
  'ontouchstart', 'ontouchend', 'ontouchmove',
  'onpointerdown', 'onpointerup', 'onpointermove'
];

/**
 * Sanitize HTML content from emails
 */
export function sanitizeHtml(html: string, options?: {
  strict?: boolean;
  allowDataUrls?: boolean;
  maxImageDataUrlSize?: number;
}): string {
  if (!html) return '';

  const strict = options?.strict ?? (process.env.HTML_SANITIZER_STRICT === 'true');
  const allowDataUrls = options?.allowDataUrls ?? true;
  const maxImageDataUrlSize = options?.maxImageDataUrlSize ?? 50000; // 50KB

  let sanitized = html;

  // 1. Remove dangerous tags completely (including content)
  for (const tag of DANGEROUS_TAGS) {
    const regex = new RegExp(`<${tag}\\b[^>]*>.*?<\\/${tag}>`, 'gis');
    sanitized = sanitized.replace(regex, '');

    // Also remove self-closing versions
    const selfClosing = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi');
    sanitized = sanitized.replace(selfClosing, '');
  }

  // 2. Remove event handlers from all tags
  for (const handler of EVENT_HANDLERS) {
    const regex = new RegExp(`\\s${handler}\\s*=\\s*["'][^"']*["']`, 'gi');
    sanitized = sanitized.replace(regex, '');

    // Also handle non-quoted values
    const regex2 = new RegExp(`\\s${handler}\\s*=\\s*[^\\s>]+`, 'gi');
    sanitized = sanitized.replace(regex2, '');
  }

  // 3. Remove javascript: protocol from hrefs
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""');

  // 4. Sanitize data: URLs in images
  if (allowDataUrls) {
    // Replace large data URLs with placeholder
    sanitized = sanitized.replace(/src\s*=\s*["'](data:image\/[^;]+;base64,[^"']+)["']/gi, (match, dataUrl) => {
      if (dataUrl.length > maxImageDataUrlSize) {
        return 'src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" title="Image too large"';
      }
      return match;
    });
  } else {
    // Remove all data URLs except cid: (inline images)
    sanitized = sanitized.replace(/src\s*=\s*["']data:[^"']+["']/gi, 'src=""');
  }

  // 5. Preserve cid: URLs for inline images (Microsoft/Outlook)
  // These are safe and necessary for inline image display
  // Pattern: src="cid:image001.png@01DA1234.5678ABCD"
  // Keep as-is, they'll be resolved later

  // 6. Remove style attributes in strict mode
  if (strict) {
    sanitized = sanitized.replace(/\sstyle\s*=\s*["'][^"']*["']/gi, '');
  }

  // 7. Remove all tags not in whitelist
  if (strict) {
    // This is a simplified approach - for production, consider using a proper HTML parser
    const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
    sanitized = sanitized.replace(tagPattern, (match, tagName) => {
      if (ALLOWED_TAGS.includes(tagName.toLowerCase())) {
        return match;
      }
      return ''; // Remove tag
    });
  }

  // 8. Sanitize remaining attributes
  sanitized = sanitizeAttributes(sanitized);

  // 9. Remove comments
  sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '');

  // 10. Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ');

  return sanitized.trim();
}

/**
 * Sanitize attributes on remaining tags
 */
function sanitizeAttributes(html: string): string {
  // For each tag, check if attributes are allowed
  const tagPattern = /<([a-z][a-z0-9]*)\s+([^>]*)>/gi;

  return html.replace(tagPattern, (match, tagName, attrs) => {
    const tag = tagName.toLowerCase();
    const allowedAttrs = [
      ...(ALLOWED_ATTRIBUTES[tag] || []),
      ...(ALLOWED_ATTRIBUTES['*'] || [])
    ];

    if (allowedAttrs.length === 0) {
      // No attributes allowed for this tag
      return `<${tag}>`;
    }

    // Parse and filter attributes
    const attrPattern = /([a-z][a-z0-9-]*)\s*=\s*["']([^"']*)["']/gi;
    const filteredAttrs: string[] = [];

    let attrMatch;
    while ((attrMatch = attrPattern.exec(attrs)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      const attrValue = attrMatch[2];

      if (allowedAttrs.includes(attrName)) {
        // Additional validation for href/src
        if (attrName === 'href' || attrName === 'src') {
          if (isSafeUrl(attrValue)) {
            filteredAttrs.push(`${attrName}="${escapeHtml(attrValue)}"`);
          }
        } else {
          filteredAttrs.push(`${attrName}="${escapeHtml(attrValue)}"`);
        }
      }
    }

    if (filteredAttrs.length === 0) {
      return `<${tag}>`;
    }

    return `<${tag} ${filteredAttrs.join(' ')}>`;
  });
}

/**
 * Check if URL is safe (not javascript:, data:, etc.)
 */
function isSafeUrl(url: string): boolean {
  if (!url) return false;

  const trimmed = url.trim().toLowerCase();

  // Allow http, https, cid (inline images), and relative URLs
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('cid:') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../') ||
    trimmed.startsWith('#')
  ) {
    return true;
  }

  // Allow mailto:
  if (trimmed.startsWith('mailto:')) {
    return true;
  }

  // Allow data: URLs for images (already size-checked)
  if (trimmed.startsWith('data:image/')) {
    return true;
  }

  // Block everything else (javascript:, vbscript:, etc.)
  return false;
}

/**
 * Escape HTML entities
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Strip all HTML tags (convert to plain text)
 */
export function stripAllHtml(html: string): string {
  if (!html) return '';

  let text = html;

  // Remove script and style tags with content
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Convert common block elements to newlines
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');

  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = decodeHtmlEntities(text);

  // Normalize whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/ {2,}/g, ' ');

  return text.trim();
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&apos;': "'",
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '...',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
  };

  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }

  // Decode numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => {
    return String.fromCharCode(parseInt(dec, 10));
  });

  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  return decoded;
}

/**
 * Get text preview from HTML (for snippets)
 */
export function getTextPreview(html: string, maxLength: number = 200): string {
  const text = stripAllHtml(html);
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength).trim() + '...';
}
