/**
 * Unit tests for hash utilities
 */

import { describe, it, expect } from 'vitest';
import { sha256, sha256String, createAssetToken, parseAssetToken } from '@/lib/email-images/hash';

describe('Hash Utilities', () => {
  describe('sha256', () => {
    it('should compute SHA-256 hash of buffer', () => {
      const buffer = Buffer.from('hello world', 'utf8');
      const hash = sha256(buffer);
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = sha256(Buffer.from('test1'));
      const hash2 = sha256(Buffer.from('test2'));
      expect(hash1).not.toBe(hash2);
    });

    it('should produce consistent hashes for same input', () => {
      const buffer = Buffer.from('consistent');
      const hash1 = sha256(buffer);
      const hash2 = sha256(buffer);
      expect(hash1).toBe(hash2);
    });
  });

  describe('sha256String', () => {
    it('should compute SHA-256 hash of string', () => {
      const hash = sha256String('hello world');
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });
  });

  describe('createAssetToken / parseAssetToken', () => {
    it('should create and parse valid token', () => {
      const payload = {
        assetId: 'test-asset-123',
        variant: 'web',
        audience: 'ticket-456',
        exp: Math.floor(Date.now() / 1000) + 900, // 15 min from now
      };

      const token = createAssetToken(payload);
      expect(token).toBeTruthy();
      expect(token).toContain('.');

      const parsed = parseAssetToken(token);
      expect(parsed).toEqual(payload);
    });

    it('should reject expired token', () => {
      const payload = {
        assetId: 'test-asset-123',
        exp: Math.floor(Date.now() / 1000) - 10, // Expired 10 sec ago
      };

      const token = createAssetToken(payload);
      const parsed = parseAssetToken(token);
      expect(parsed).toBeNull();
    });

    it('should reject tampered token', () => {
      const payload = {
        assetId: 'test-asset-123',
        exp: Math.floor(Date.now() / 1000) + 900,
      };

      const token = createAssetToken(payload);
      const [payloadPart, signature] = token.split('.');

      // Tamper with payload
      const tamperedPayload = Buffer.from(JSON.stringify({
        ...payload,
        assetId: 'different-asset',
      })).toString('base64url');

      const tamperedToken = `${tamperedPayload}.${signature}`;
      const parsed = parseAssetToken(tamperedToken);
      expect(parsed).toBeNull();
    });

    it('should reject malformed token', () => {
      expect(parseAssetToken('invalid-token')).toBeNull();
      expect(parseAssetToken('')).toBeNull();
      expect(parseAssetToken('a.b.c')).toBeNull();
    });
  });
});
