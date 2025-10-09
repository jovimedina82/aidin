/**
 * Unit tests for audit log redaction utilities
 */

import {
  redactEmail,
  redactPhone,
  maskToken,
  redactIP,
  redactData,
  sanitizeMetadata,
} from '@/lib/audit/redaction';

describe('Audit Log Redaction', () => {
  describe('redactEmail', () => {
    it('should not redact at level 0', () => {
      expect(redactEmail('user@example.com', 0)).toBe('user@example.com');
    });

    it('should hash local part at level 1', () => {
      const redacted = redactEmail('user@example.com', 1);
      expect(redacted).toMatch(/@example\.com$/);
      expect(redacted).not.toContain('user');
      expect(redacted.split('@')[0]).toHaveLength(8); // SHA-256 truncated to 8 chars
    });

    it('should mask local part at level 2', () => {
      expect(redactEmail('user@example.com', 2)).toBe('***@example.com');
    });

    it('should preserve domain at all levels', () => {
      expect(redactEmail('admin@surterreproperties.com', 1)).toContain('@surterreproperties.com');
      expect(redactEmail('admin@surterreproperties.com', 2)).toContain('@surterreproperties.com');
    });
  });

  describe('redactPhone', () => {
    it('should not redact at level 0', () => {
      expect(redactPhone('555-1234', 0)).toBe('555-1234');
    });

    it('should mask middle digits at level 1', () => {
      const redacted = redactPhone('555-123-4567', 1);
      expect(redacted).toContain('555');
      expect(redacted).toContain('67');
      expect(redacted).toContain('*');
    });

    it('should fully mask at level 2', () => {
      const redacted = redactPhone('555-123-4567', 2);
      expect(redacted).toMatch(/^\*+$/);
    });
  });

  describe('maskToken', () => {
    it('should mask short tokens completely', () => {
      expect(maskToken('abc')).toBe('****');
    });

    it('should show first and last 4 chars', () => {
      const token = 'abcd1234567890wxyz';
      const masked = maskToken(token);
      expect(masked).toContain('abcd');
      expect(masked).toContain('wxyz');
      expect(masked).toContain('*');
    });
  });

  describe('redactIP', () => {
    it('should not redact at level 0', () => {
      expect(redactIP('192.168.1.100', 0)).toBe('192.168.1.100');
    });

    it('should mask last octet at level 1', () => {
      expect(redactIP('192.168.1.100', 1)).toBe('192.168.1.***');
    });

    it('should mask last two octets at level 2', () => {
      expect(redactIP('192.168.1.100', 2)).toBe('192.168.***.***');
    });

    it('should handle IPv6', () => {
      const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      const redacted = redactIP(ipv6, 1);
      expect(redacted).toContain('****');
    });
  });

  describe('sanitizeMetadata', () => {
    it('should remove sensitive keys', () => {
      const metadata = {
        user: 'john',
        password: 'secret123',
        apiKey: 'key-123',
        safe: 'data',
      };

      const sanitized = sanitizeMetadata(metadata, 0);
      expect(sanitized).toHaveProperty('user');
      expect(sanitized).toHaveProperty('safe');
      expect(sanitized).not.toHaveProperty('password');
      expect(sanitized).not.toHaveProperty('apiKey');
    });

    it('should redact nested emails at level 1', () => {
      const metadata = {
        user: { email: 'test@example.com' },
      };

      const sanitized = sanitizeMetadata(metadata, 1) as any;
      expect(sanitized.user.email).not.toBe('test@example.com');
      expect(sanitized.user.email).toContain('@example.com');
    });
  });

  describe('redactData', () => {
    it('should handle null and undefined', () => {
      expect(redactData(null, 1)).toBeNull();
      expect(redactData(undefined, 1)).toBeUndefined();
    });

    it('should redact arrays', () => {
      const data = ['user@test.com', 'admin@test.com'];
      const redacted = redactData(data, 2) as string[];
      expect(redacted[0]).toBe('***@test.com');
      expect(redacted[1]).toBe('***@test.com');
    });

    it('should redact nested objects', () => {
      const data = {
        contact: {
          email: 'user@test.com',
          phone: '555-1234',
        },
      };

      const redacted = redactData(data, 1) as any;
      expect(redacted.contact.email).not.toBe('user@test.com');
      expect(redacted.contact.phone).toContain('*');
    });

    it('should not redact at level 0', () => {
      const data = { email: 'test@example.com' };
      const redacted = redactData(data, 0);
      expect(redacted).toEqual(data);
    });
  });
});
