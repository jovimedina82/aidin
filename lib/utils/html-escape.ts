/**
 * HTML Escaping Utilities
 *
 * Prevents XSS attacks by escaping user-generated content before
 * inserting into HTML contexts (emails, templates, etc.)
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escape HTML special characters to prevent XSS
 *
 * @param text - User-generated text to escape
 * @returns Escaped HTML-safe string
 */
export function escapeHtml(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text.replace(/[&<>"'`=\/]/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Escape HTML and convert newlines to <br> tags
 * Safe for inserting into HTML email content
 *
 * @param text - User-generated text
 * @returns HTML-safe string with line breaks preserved
 */
export function escapeHtmlWithBreaks(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

/**
 * Sanitize text for safe display in HTML attributes
 *
 * @param text - Text to use in HTML attribute
 * @returns Safe string for HTML attribute value
 */
export function escapeHtmlAttribute(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Validate and sanitize a file path to prevent directory traversal
 *
 * @param userPath - User-provided path segment
 * @param baseDir - Allowed base directory
 * @returns Sanitized path or null if invalid
 */
export function sanitizeFilePath(userPath: string, baseDir: string): string | null {
  if (!userPath || typeof userPath !== 'string') {
    return null;
  }

  // Remove any path traversal attempts
  const sanitized = userPath
    .replace(/\.\./g, '') // Remove ..
    .replace(/[\/\\]+/g, '/') // Normalize slashes
    .replace(/^\/+/, '') // Remove leading slashes
    .split('/')
    .filter((segment) => {
      // Allow only safe filename characters
      return /^[a-zA-Z0-9._-]+$/.test(segment);
    })
    .join('/');

  if (!sanitized) {
    return null;
  }

  // Ensure the final path is within baseDir
  const path = require('path');
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(baseDir, sanitized);

  if (!resolvedPath.startsWith(resolvedBase)) {
    return null; // Path traversal detected
  }

  return sanitized;
}

/**
 * Validate input bounds
 *
 * @param value - Number to validate
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param defaultValue - Default if out of bounds
 * @returns Bounded value
 */
export function boundNumber(value: number, min: number, max: number, defaultValue: number): number {
  if (isNaN(value) || value < min) {
    return defaultValue;
  }
  if (value > max) {
    return max;
  }
  return value;
}
