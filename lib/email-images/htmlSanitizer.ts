/**
 * HTML sanitizer for email content
 * - Strips dangerous tags and attributes
 * - Rewrites CID references and data URIs to signed asset URLs
 */

import { JSDOM } from 'jsdom';
import DOMPurify from 'isomorphic-dompurify';

// Allowed tags for email HTML
const ALLOWED_TAGS = [
  'p', 'div', 'span', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'em', 'b', 'i', 'u', 's', 'strike', 'del',
  'ul', 'ol', 'li',
  'a', 'img',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'blockquote', 'pre', 'code',
];

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'width', 'height',
  'target', 'rel', 'class', 'id', 'loading',
  'colspan', 'rowspan', 'align', 'valign',
];

export interface SanitizeOptions {
  allowedTags?: string[];
  allowedAttributes?: string[];
  urlRewriter?: (url: string, tagName: string, attrName: string) => string;
}

/**
 * Sanitize HTML with DOMPurify
 */
export function sanitizeHtml(
  html: string,
  options: SanitizeOptions = {}
): string {
  const { allowedTags = ALLOWED_TAGS, allowedAttributes = ALLOWED_ATTR, urlRewriter } = options;

  const config: any = {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttributes,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|data|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  };

  // Custom hook to rewrite URLs
  if (urlRewriter) {
    DOMPurify.addHook('afterSanitizeAttributes', (node: any) => {
      // Rewrite src attributes (for images)
      if (node.hasAttribute && node.hasAttribute('src')) {
        const src = node.getAttribute('src');
        const newSrc = urlRewriter(src, node.tagName.toLowerCase(), 'src');
        node.setAttribute('src', newSrc);
      }

      // Rewrite href attributes (for links)
      if (node.hasAttribute && node.hasAttribute('href')) {
        const href = node.getAttribute('href');
        // Only rewrite mailto and tel links, block javascript:
        if (href.startsWith('javascript:')) {
          node.removeAttribute('href');
        } else if (!href.startsWith('mailto:') && !href.startsWith('tel:')) {
          const newHref = urlRewriter(href, node.tagName.toLowerCase(), 'href');
          node.setAttribute('href', newHref);
        }
      }

      // Add loading="lazy" to images
      if (node.tagName === 'IMG') {
        node.setAttribute('loading', 'lazy');
      }

      // Add rel="noopener noreferrer" to external links
      if (node.tagName === 'A' && node.hasAttribute('href')) {
        const href = node.getAttribute('href');
        if (href.startsWith('http://') || href.startsWith('https://')) {
          node.setAttribute('rel', 'noopener noreferrer');
          node.setAttribute('target', '_blank');
        }
      }
    });
  }

  const clean = DOMPurify.sanitize(html, config);

  // Remove hook after use
  if (urlRewriter) {
    DOMPurify.removeAllHooks();
  }

  return clean;
}

/**
 * Extract CID references from HTML
 * Returns array of CID values (without the cid: prefix)
 */
export function extractCidReferences(html: string): string[] {
  const cids = new Set<string>();
  const cidRegex = /src\s*=\s*["']cid:([^"']+)["']/gi;

  let match;
  while ((match = cidRegex.exec(html)) !== null) {
    cids.add(match[1]);
  }

  return Array.from(cids);
}

/**
 * Extract data URI images from HTML
 * Returns array of {dataUri, mime, base64}
 */
export function extractDataUriImages(html: string): Array<{
  dataUri: string;
  mime: string;
  base64: string;
}> {
  const dataUris: Array<{ dataUri: string; mime: string; base64: string }> = [];
  const dataUriRegex = /src\s*=\s*["'](data:image\/([^;]+);base64,([^"']+))["']/gi;

  let match;
  while ((match = dataUriRegex.exec(html)) !== null) {
    dataUris.push({
      dataUri: match[1],
      mime: `image/${match[2]}`,
      base64: match[3],
    });
  }

  return dataUris;
}

/**
 * Rewrite CID references in HTML to signed URLs
 */
export function rewriteCidReferences(
  html: string,
  cidMap: Map<string, string>
): string {
  return html.replace(/src\s*=\s*["']cid:([^"']+)["']/gi, (match, cid) => {
    const url = cidMap.get(cid);
    if (url) {
      return `src="${url}"`;
    }
    console.warn(`⚠️  Unresolved CID reference: cid:${cid}`);
    return match;
  });
}

/**
 * Rewrite data URI images in HTML to signed URLs
 */
export function rewriteDataUriImages(
  html: string,
  dataUriMap: Map<string, string>
): string {
  return html.replace(/src\s*=\s*["'](data:image\/[^;]+;base64,[^"']+)["']/gi, (match, dataUri) => {
    const url = dataUriMap.get(dataUri);
    if (url) {
      return `src="${url}"`;
    }
    return match;
  });
}

/**
 * Wrap images in a container with max-width constraint
 */
export function wrapImagesInContainer(html: string): string {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const images = document.querySelectorAll('img');

  images.forEach((img) => {
    if (!img.parentElement || img.parentElement.tagName === 'BODY') {
      const wrapper = document.createElement('div');
      wrapper.style.maxWidth = '100%';
      wrapper.style.overflow = 'hidden';
      img.parentNode?.insertBefore(wrapper, img);
      wrapper.appendChild(img);
    }

    // Add max-width style to image
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
  });

  return document.body.innerHTML;
}
