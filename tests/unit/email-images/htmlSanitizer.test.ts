/**
 * Unit tests for HTML sanitizer
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeHtml,
  extractCidReferences,
  extractDataUriImages,
  rewriteCidReferences,
  rewriteDataUriImages,
} from '@/lib/email-images/htmlSanitizer';

describe('HTML Sanitizer', () => {
  describe('extractCidReferences', () => {
    it('should extract CID references from HTML', () => {
      const html = `
        <img src="cid:image001.png@01DC3955.DFB42200">
        <img src="cid:logo@example.com">
      `;
      const cids = extractCidReferences(html);
      expect(cids).toEqual([
        'image001.png@01DC3955.DFB42200',
        'logo@example.com',
      ]);
    });

    it('should return empty array if no CID refs', () => {
      const html = '<p>No images here</p>';
      const cids = extractCidReferences(html);
      expect(cids).toEqual([]);
    });
  });

  describe('extractDataUriImages', () => {
    it('should extract data URI images from HTML', () => {
      const html = `
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA">
        <img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA">
      `;
      const dataUris = extractDataUriImages(html);
      expect(dataUris).toHaveLength(2);
      expect(dataUris[0].mime).toBe('image/png');
      expect(dataUris[0].base64).toBe('iVBORw0KGgoAAAANSUhEUgAAAAUA');
      expect(dataUris[1].mime).toBe('image/jpeg');
    });
  });

  describe('rewriteCidReferences', () => {
    it('should rewrite CID references to URLs', () => {
      const html = '<img src="cid:logo@example.com" alt="Logo">';
      const cidMap = new Map([
        ['logo@example.com', '/api/assets/123?token=xxx'],
      ]);

      const rewritten = rewriteCidReferences(html, cidMap);
      expect(rewritten).toBe('<img src="/api/assets/123?token=xxx" alt="Logo">');
    });

    it('should leave unresolved CIDs unchanged', () => {
      const html = '<img src="cid:unknown@example.com">';
      const cidMap = new Map();

      const rewritten = rewriteCidReferences(html, cidMap);
      expect(rewritten).toBe('<img src="cid:unknown@example.com">');
    });
  });

  describe('rewriteDataUriImages', () => {
    it('should rewrite data URI images to URLs', () => {
      const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
      const html = `<img src="${dataUri}">`;
      const dataUriMap = new Map([
        [dataUri, '/api/assets/456?token=yyy'],
      ]);

      const rewritten = rewriteDataUriImages(html, dataUriMap);
      expect(rewritten).toBe('<img src="/api/assets/456?token=yyy">');
    });
  });

  describe('sanitizeHtml', () => {
    it('should allow safe tags', () => {
      const html = '<p>Hello <strong>world</strong></p>';
      const clean = sanitizeHtml(html);
      expect(clean).toBe('<p>Hello <strong>world</strong></p>');
    });

    it('should strip script tags', () => {
      const html = '<p>Safe</p><script>alert("XSS")</script>';
      const clean = sanitizeHtml(html);
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('<p>Safe</p>');
    });

    it('should strip event handlers', () => {
      const html = '<img src="x" onerror="alert(1)">';
      const clean = sanitizeHtml(html);
      expect(clean).not.toContain('onerror');
    });

    it('should allow CID URLs', () => {
      const html = '<img src="cid:logo@example.com">';
      const clean = sanitizeHtml(html);
      expect(clean).toContain('cid:logo@example.com');
    });

    it('should allow data URIs', () => {
      const html = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA">';
      const clean = sanitizeHtml(html);
      expect(clean).toContain('data:image/png;base64');
    });

    it('should block javascript: URLs', () => {
      const html = '<a href="javascript:alert(1)">Click</a>';
      const clean = sanitizeHtml(html);
      expect(clean).not.toContain('javascript:');
    });
  });
});
