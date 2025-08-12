import { 
  validatePattern, 
  validateRegexPattern, 
  validateGlobPattern,
  sanitizePattern,
  isValidDomain,
  PatternValidationResult
} from '@/shared/utils/patternValidator';
import { MatchType } from '@/shared/types';

describe('Pattern Validator', () => {
  describe('validatePattern', () => {
    describe('domain patterns', () => {
      it('should accept valid domain patterns', () => {
        const validDomains = [
          'example.com',
          'sub.example.com',
          'very.long.subdomain.example.com',
          'test-site.com',
          'site123.org',
          'example.co.uk',
          '*.example.com',
          '*.sub.example.com',
        ];

        for (const domain of validDomains) {
          const result = validatePattern(domain, MatchType.DOMAIN);
          expect(result.isValid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      });

      it('should reject invalid domain patterns', () => {
        const invalidDomains = [
          '',
          ' ',
          'http://example.com',
          'https://example.com',
          'ftp://example.com',
          'example.com/',
          'example',
          '.com',
          'example..com',
          'example-.com',
          '-example.com',
          'exam ple.com',
          'example.c',
          'very-very-long-subdomain-name-that-exceeds-limits.example.com',
          'javascript:alert(1)',
          'data:text/html,<script>',
        ];

        for (const domain of invalidDomains) {
          const result = validatePattern(domain, MatchType.DOMAIN);
          expect(result.isValid).toBe(false);
          expect(result.error).toBeDefined();
        }
      });

      it('should accept domains with paths', () => {
        const domainsWithPaths = [
          'example.com/path',
          'example.com/path/to/resource',
          'example.com/path?query=1',
          'example.com/path#fragment',
          '*.example.com/admin/*',
          'sub.example.com/api/v1/*',
        ];

        for (const pattern of domainsWithPaths) {
          const result = validatePattern(pattern, MatchType.DOMAIN);
          expect(result.isValid).toBe(true);
        }
      });
    });

    describe('exact patterns', () => {
      it('should accept valid exact URL patterns', () => {
        const validUrls = [
          'https://example.com',
          'http://test.org/path',
          'https://sub.example.com/path/to/resource?query=1#fragment',
          'https://localhost:3000/dev',
          'http://192.168.1.1:8080/admin',
        ];

        for (const url of validUrls) {
          const result = validatePattern(url, MatchType.EXACT);
          expect(result.isValid).toBe(true);
        }
      });

      it('should reject invalid exact URL patterns', () => {
        const invalidUrls = [
          '',
          'not-a-url',
          'example.com', // Missing protocol
          'ftp://example.com', // Unsupported protocol
          'javascript:alert(1)',
          'data:text/html,<script>',
          'file:///etc/passwd',
        ];

        for (const url of invalidUrls) {
          const result = validatePattern(url, MatchType.EXACT);
          expect(result.isValid).toBe(false);
          expect(result.error).toBeDefined();
        }
      });
    });

    describe('glob patterns', () => {
      it('should accept valid glob patterns', () => {
        const validGlobs = [
          '*.example.com',
          'sub.*.example.com',
          'example.com/*',
          '*.example.com/admin/*',
          'test*.example.com',
          '*test.example.com',
          'example.com/path/*/resource',
          'api.example.com/v?/users',
          'site[123].example.com',
        ];

        for (const glob of validGlobs) {
          const result = validatePattern(glob, MatchType.GLOB);
          expect(result.isValid).toBe(true);
        }
      });

      it('should reject invalid glob patterns', () => {
        const invalidGlobs = [
          '',
          '**',
          'example.com/**', // Double asterisk not supported
          'http://*.example.com', // Protocol not allowed
          '*.', // Invalid domain
          '*..com', // Double dots
        ];

        for (const glob of invalidGlobs) {
          const result = validatePattern(glob, MatchType.GLOB);
          expect(result.isValid).toBe(false);
          expect(result.error).toBeDefined();
        }
      });
    });

    describe('regex patterns', () => {
      it('should accept valid regex patterns', () => {
        const validRegexes = [
          '.*\\.example\\.com',
          'test\\d+\\.example\\.com',
          '^https?://.*\\.example\\.com/api/.*$',
          '(sub1|sub2)\\.example\\.com',
          'example\\.com/user/\\d+',
          '[a-z]+\\.example\\.com',
        ];

        for (const regex of validRegexes) {
          const result = validatePattern(regex, MatchType.REGEX);
          expect(result.isValid).toBe(true);
        }
      });

      it('should reject invalid regex patterns', () => {
        const invalidRegexes = [
          '',
          '[',
          '(',
          '*',
          '?',
          '+',
          '{',
          'test[a-z',
          'test(unclosed',
          '(?invalid)',
        ];

        for (const regex of invalidRegexes) {
          const result = validatePattern(regex, MatchType.REGEX);
          expect(result.isValid).toBe(false);
          expect(result.error).toBeDefined();
        }
      });

      it('should detect potentially dangerous regex patterns', () => {
        const dangerousRegexes = [
          '(a+)+',
          '(a|a)*',
          '(a*)*',
          'a{1000000}',
          '(?:(?:(?:(?:a)))))', // Deep nesting
        ];

        for (const regex of dangerousRegexes) {
          const result = validatePattern(regex, MatchType.REGEX);
          expect(result.isValid).toBe(false);
          expect(result.error).toContain('potentially dangerous');
        }
      });
    });
  });

  describe('validateRegexPattern', () => {
    it('should validate regex syntax', () => {
      expect(validateRegexPattern('valid.*regex')).toBe(true);
      expect(validateRegexPattern('[invalid')).toBe(false);
    });

    it('should detect catastrophic backtracking', () => {
      const backtrackingPatterns = [
        '(a+)+',
        '(a|a)*',
        '(a*)*',
        '([a-zA-Z]+)*',
      ];

      for (const pattern of backtrackingPatterns) {
        expect(validateRegexPattern(pattern)).toBe(false);
      }
    });

    it('should limit regex complexity', () => {
      const complexPattern = 'a'.repeat(10000);
      expect(validateRegexPattern(complexPattern)).toBe(false);
    });

    it('should allow reasonable complexity', () => {
      const reasonablePattern = '(test|demo|staging)\\.(example|test)\\.com';
      expect(validateRegexPattern(reasonablePattern)).toBe(true);
    });
  });

  describe('validateGlobPattern', () => {
    it('should validate glob syntax', () => {
      expect(validateGlobPattern('*.example.com')).toBe(true);
      expect(validateGlobPattern('test?.example.com')).toBe(true);
      expect(validateGlobPattern('site[123].com')).toBe(true);
    });

    it('should reject unsupported glob features', () => {
      expect(validateGlobPattern('**')).toBe(false);
      expect(validateGlobPattern('example.com/**')).toBe(false);
      expect(validateGlobPattern('*.{com,org}')).toBe(false);
    });

    it('should validate underlying domain', () => {
      expect(validateGlobPattern('*.valid.com')).toBe(true);
      expect(validateGlobPattern('*.invalid..com')).toBe(false);
      expect(validateGlobPattern('http://*.com')).toBe(false);
    });
  });

  describe('sanitizePattern', () => {
    it('should trim whitespace', () => {
      expect(sanitizePattern('  example.com  ')).toBe('example.com');
    });

    it('should convert to lowercase', () => {
      expect(sanitizePattern('EXAMPLE.COM')).toBe('example.com');
    });

    it('should remove protocol from domain patterns', () => {
      expect(sanitizePattern('https://example.com')).toBe('example.com');
      expect(sanitizePattern('http://test.org/path')).toBe('test.org/path');
    });

    it('should preserve regex patterns', () => {
      expect(sanitizePattern('.*\\.EXAMPLE\\.COM')).toBe('.*\\.example\\.com');
    });

    it('should preserve glob patterns', () => {
      expect(sanitizePattern('*.EXAMPLE.COM')).toBe('*.example.com');
    });

    it('should remove trailing slashes from domains', () => {
      expect(sanitizePattern('example.com/')).toBe('example.com');
      expect(sanitizePattern('example.com/path/')).toBe('example.com/path');
    });

    it('should normalize Unicode domains', () => {
      expect(sanitizePattern('xn--nxasmq6b.com')).toBe('xn--nxasmq6b.com');
      expect(sanitizePattern('测试.com')).toContain('xn--'); // Punycode
    });
  });

  describe('isValidDomain', () => {
    it('should accept valid domains', () => {
      const validDomains = [
        'example.com',
        'sub.example.com',
        'test-site.org',
        'site123.net',
        'example.co.uk',
        'very.long.domain.example.com',
      ];

      for (const domain of validDomains) {
        expect(isValidDomain(domain)).toBe(true);
      }
    });

    it('should reject invalid domains', () => {
      const invalidDomains = [
        '',
        'com',
        '.com',
        'example.',
        'example..com',
        '-example.com',
        'example-.com',
        'exam ple.com',
        'example.c',
        'very-long-label-that-exceeds-sixty-three-characters-limit.com',
      ];

      for (const domain of invalidDomains) {
        expect(isValidDomain(domain)).toBe(false);
      }
    });

    it('should handle internationalized domains', () => {
      expect(isValidDomain('xn--nxasmq6b.com')).toBe(true); // 测试.com in punycode
      expect(isValidDomain('müller.com')).toBe(true);
      expect(isValidDomain('café.fr')).toBe(true);
    });

    it('should validate domain length limits', () => {
      // Domain longer than 253 characters should be invalid
      const longDomain = 'a'.repeat(250) + '.com';
      expect(isValidDomain(longDomain)).toBe(false);

      // Label longer than 63 characters should be invalid
      const longLabel = 'a'.repeat(64) + '.com';
      expect(isValidDomain(longLabel)).toBe(false);
    });
  });

  describe('security considerations', () => {
    it('should reject XSS attempts', () => {
      const xssPatterns = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        '<script>alert(1)</script>',
        'onload=alert(1)',
      ];

      for (const pattern of xssPatterns) {
        const result = validatePattern(pattern, MatchType.DOMAIN);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Invalid');
      }
    });

    it('should reject file protocol URLs', () => {
      const fileUrls = [
        'file:///etc/passwd',
        'file://localhost/etc/passwd',
        'file:///C:/Windows/System32/',
      ];

      for (const url of fileUrls) {
        const result = validatePattern(url, MatchType.EXACT);
        expect(result.isValid).toBe(false);
      }
    });

    it('should reject malicious regex patterns', () => {
      const maliciousPatterns = [
        '(?:(?:(?:(?:(?:(?:a))))))', // Excessive nesting
        'a{999999999}', // Huge quantifier
        '([a-zA-Z]+)*$', // Catastrophic backtracking
        '(a|a)*b', // Alternation backtracking
      ];

      for (const pattern of maliciousPatterns) {
        const result = validatePattern(pattern, MatchType.REGEX);
        expect(result.isValid).toBe(false);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty patterns', () => {
      const result = validatePattern('', MatchType.DOMAIN);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });

    it('should handle null/undefined patterns', () => {
      const resultNull = validatePattern(null as any, MatchType.DOMAIN);
      const resultUndefined = validatePattern(undefined as any, MatchType.DOMAIN);
      
      expect(resultNull.isValid).toBe(false);
      expect(resultUndefined.isValid).toBe(false);
    });

    it('should handle very long patterns', () => {
      const longPattern = 'a'.repeat(10000) + '.com';
      const result = validatePattern(longPattern, MatchType.DOMAIN);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should handle patterns with special characters', () => {
      const specialPatterns = [
        'example.com\n',
        'example.com\t',
        'example.com\r',
        'example.com\0',
      ];

      for (const pattern of specialPatterns) {
        const result = validatePattern(pattern, MatchType.DOMAIN);
        expect(result.isValid).toBe(false);
      }
    });

    it('should provide helpful error messages', () => {
      const cases = [
        { pattern: '', expected: 'cannot be empty' },
        { pattern: 'http://example.com', expected: 'protocol not allowed' },
        { pattern: '[invalid', expected: 'Invalid regex' },
        { pattern: 'example..com', expected: 'Invalid domain' },
      ];

      for (const { pattern, expected } of cases) {
        const result = validatePattern(pattern, MatchType.DOMAIN);
        expect(result.error).toContain(expected);
      }
    });

    it('should handle performance edge cases', () => {
      const start = Date.now();
      
      // Should complete quickly even for complex patterns
      validatePattern('(a+)+', MatchType.REGEX);
      validatePattern('*.'.repeat(100) + 'com', MatchType.GLOB);
      validatePattern('example.com/' + 'a'.repeat(1000), MatchType.DOMAIN);
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});